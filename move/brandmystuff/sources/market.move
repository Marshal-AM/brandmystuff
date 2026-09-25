/// Secondary market for revenue units: fixed-price listings, verified buyers only.
module brandmystuff::market;

use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;
use brandmystuff::admin::{Self, Config};
use brandmystuff::kyc::{Self, KycRegistry};
use brandmystuff::offering::{Self, SpaceOffering};

#[error]
const ENotTokenised: vector<u8> = b"Units can only be traded after the offering closes successfully";
#[error]
const EZeroUnits: vector<u8> = b"Units must be positive";
#[error]
const EZeroPrice: vector<u8> = b"Price must be positive";
#[error]
const EWrongOffering: vector<u8> = b"Listing belongs to another offering";
#[error]
const ENotEnoughListed: vector<u8> = b"Listing has fewer units";
#[error]
const EWrongAmount: vector<u8> = b"Payment must equal units x price";
#[error]
const ENotSeller: vector<u8> = b"Only the seller can cancel";
#[error]
const ESelfTrade: vector<u8> = b"Cannot buy your own listing";

public struct Listing has key {
    id: UID,
    offering_id: ID,
    seller: address,
    units: u64,
    price_per_unit: u64,
}

public struct Listed has copy, drop { listing_id: ID, offering_id: ID, seller: address, units: u64, price_per_unit: u64 }
public struct Trade has copy, drop { listing_id: ID, offering_id: ID, seller: address, buyer: address, units: u64, price_per_unit: u64, fee: u64 }
public struct ListingCancelled has copy, drop { listing_id: ID, offering_id: ID, seller: address, units: u64 }

public fun list<C>(cfg: &Config, o: &mut SpaceOffering<C>, units: u64, price_per_unit: u64, ctx: &mut TxContext) {
    admin::assert_active(cfg);
    assert!(offering::is_tokenised(o), ENotTokenised);
    assert!(units > 0, EZeroUnits);
    assert!(price_per_unit > 0, EZeroPrice);
    let seller = ctx.sender();
    offering::lock_units(o, seller, units);
    let l = Listing { id: object::new(ctx), offering_id: object::id(o), seller, units, price_per_unit };
    event::emit(Listed { listing_id: object::id(&l), offering_id: l.offering_id, seller, units, price_per_unit });
    transfer::share_object(l);
}

public fun fill<C>(
    cfg: &Config,
    o: &mut SpaceOffering<C>,
    l: &mut Listing,
    reg: &KycRegistry,
    pay: Coin<C>,
    units: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    admin::assert_active(cfg);
    assert!(l.offering_id == object::id(o), EWrongOffering);
    assert!(units > 0, EZeroUnits);
    assert!(l.units >= units, ENotEnoughListed);
    let buyer = ctx.sender();
    assert!(buyer != l.seller, ESelfTrade);
    kyc::assert_verified(reg, buyer, clock);
    let cost = units * l.price_per_unit;
    assert!(pay.value() == cost, EWrongAmount);
    offering::transfer_listed(o, l.seller, buyer, units);
    l.units = l.units - units;
    let mut bal = pay.into_balance();
    let fee = admin::bps(cost, admin::market_fee_bps(cfg));
    if (fee > 0) {
        transfer::public_transfer(coin::from_balance(bal.split(fee), ctx), admin::treasury(cfg));
    };
    transfer::public_transfer(coin::from_balance(bal, ctx), l.seller);
    event::emit(Trade { listing_id: object::id(l), offering_id: l.offering_id, seller: l.seller, buyer, units, price_per_unit: l.price_per_unit, fee });
}

public fun cancel<C>(o: &mut SpaceOffering<C>, l: Listing, ctx: &TxContext) {
    assert!(l.offering_id == object::id(o), EWrongOffering);
    assert!(ctx.sender() == l.seller, ENotSeller);
    let Listing { id, offering_id, seller, units, price_per_unit: _ } = l;
    if (units > 0) offering::unlock_units(o, seller, units);
    event::emit(ListingCancelled { listing_id: id.to_inner(), offering_id, seller, units });
    id.delete();
}

// =====================================================================================
// v2: listings with expiry, buy orders (bids) with escrowed USDC, expiry sweeps
// =====================================================================================

#[error]
const EExpired: vector<u8> = b"Order has expired";
#[error]
const ENotExpired: vector<u8> = b"Order has not expired";
#[error]
const ENotBuyer: vector<u8> = b"Only the bidder can cancel";
#[error]
const EBadExpiry: vector<u8> = b"Expiry must be in the future (or 0 for none)";
#[error]
const EOverMax: vector<u8> = b"Order exceeds the per-investor maximum";

/// Sell listing with an optional expiry (0 = good until cancelled).
public struct ListingV2 has key {
    id: UID,
    offering_id: ID,
    seller: address,
    units: u64,
    price_per_unit: u64,
    expires_ms: u64,
}

/// Buy order: USDC is escrowed for `units × price_per_unit`; holders sell into it.
public struct Bid<phantom C> has key {
    id: UID,
    offering_id: ID,
    buyer: address,
    units: u64,
    price_per_unit: u64,
    escrow: sui::balance::Balance<C>,
    expires_ms: u64,
}

public struct ListingExpiry has copy, drop { listing_id: ID, offering_id: ID, expires_ms: u64 }
public struct BidPlaced has copy, drop { bid_id: ID, offering_id: ID, buyer: address, units: u64, price_per_unit: u64, expires_ms: u64 }
public struct BidFilled has copy, drop { bid_id: ID, offering_id: ID, buyer: address, seller: address, units: u64, price_per_unit: u64, fee: u64 }
public struct BidClosed has copy, drop { bid_id: ID, offering_id: ID, buyer: address, units_left: u64, refunded: u64, expired: bool }

fun check_expiry(expires_ms: u64, clock: &Clock) {
    assert!(expires_ms == 0 || expires_ms > clock.timestamp_ms(), EBadExpiry);
}

fun live(expires_ms: u64, clock: &Clock): bool { expires_ms == 0 || clock.timestamp_ms() < expires_ms }

public fun list_v2<C>(cfg: &Config, o: &mut SpaceOffering<C>, units: u64, price_per_unit: u64, expires_ms: u64, clock: &Clock, ctx: &mut TxContext) {
    admin::assert_active(cfg);
    assert!(offering::is_tokenised(o), ENotTokenised);
    assert!(units > 0, EZeroUnits);
    assert!(price_per_unit > 0, EZeroPrice);
    check_expiry(expires_ms, clock);
    let seller = ctx.sender();
    offering::lock_units(o, seller, units);
    let l = ListingV2 { id: object::new(ctx), offering_id: object::id(o), seller, units, price_per_unit, expires_ms };
    event::emit(Listed { listing_id: object::id(&l), offering_id: l.offering_id, seller, units, price_per_unit });
    event::emit(ListingExpiry { listing_id: object::id(&l), offering_id: l.offering_id, expires_ms });
    transfer::share_object(l);
}

public fun fill_v2<C>(
    cfg: &Config,
    o: &mut SpaceOffering<C>,
    l: &mut ListingV2,
    reg: &KycRegistry,
    pay: Coin<C>,
    units: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    admin::assert_active(cfg);
    assert!(l.offering_id == object::id(o), EWrongOffering);
    assert!(live(l.expires_ms, clock), EExpired);
    assert!(units > 0, EZeroUnits);
    assert!(l.units >= units, ENotEnoughListed);
    let buyer = ctx.sender();
    assert!(buyer != l.seller, ESelfTrade);
    kyc::assert_verified(reg, buyer, clock);
    let cost = units * l.price_per_unit;
    assert!(pay.value() == cost, EWrongAmount);
    offering::transfer_listed(o, l.seller, buyer, units);
    l.units = l.units - units;
    let mut bal = pay.into_balance();
    let fee = admin::bps(cost, admin::market_fee_bps(cfg));
    if (fee > 0) transfer::public_transfer(coin::from_balance(bal.split(fee), ctx), admin::treasury(cfg));
    transfer::public_transfer(coin::from_balance(bal, ctx), l.seller);
    event::emit(Trade { listing_id: object::id(l), offering_id: l.offering_id, seller: l.seller, buyer, units, price_per_unit: l.price_per_unit, fee });
}

public fun cancel_v2<C>(o: &mut SpaceOffering<C>, l: ListingV2, ctx: &TxContext) {
    assert!(ctx.sender() == l.seller, ENotSeller);
    close_listing_v2(o, l);
}

/// Anyone can return an expired listing's units to its seller.
public fun expire_listing_v2<C>(o: &mut SpaceOffering<C>, l: ListingV2, clock: &Clock) {
    assert!(!live(l.expires_ms, clock), ENotExpired);
    close_listing_v2(o, l);
}

fun close_listing_v2<C>(o: &mut SpaceOffering<C>, l: ListingV2) {
    assert!(l.offering_id == object::id(o), EWrongOffering);
    let ListingV2 { id, offering_id, seller, units, price_per_unit: _, expires_ms: _ } = l;
    if (units > 0) offering::unlock_units(o, seller, units);
    event::emit(ListingCancelled { listing_id: id.to_inner(), offering_id, seller, units });
    id.delete();
}

public fun place_bid<C>(
    cfg: &Config,
    o: &SpaceOffering<C>,
    reg: &KycRegistry,
    pay: Coin<C>,
    units: u64,
    price_per_unit: u64,
    expires_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    admin::assert_active(cfg);
    admin::assert_payment<C>(cfg);
    assert!(offering::is_tokenised(o), ENotTokenised);
    assert!(units > 0, EZeroUnits);
    assert!(price_per_unit > 0, EZeroPrice);
    check_expiry(expires_ms, clock);
    let buyer = ctx.sender();
    kyc::assert_verified(reg, buyer, clock);
    assert!(pay.value() == units * price_per_unit, EWrongAmount);
    if (buyer != offering::offering_owner_addr(o)) {
        let (free, listed) = offering::units_of(o, buyer);
        assert!(free + listed + units <= offering::max_per_investor(o), EOverMax);
    };
    let b = Bid<C> { id: object::new(ctx), offering_id: object::id(o), buyer, units, price_per_unit, escrow: pay.into_balance(), expires_ms };
    event::emit(BidPlaced { bid_id: object::id(&b), offering_id: b.offering_id, buyer, units, price_per_unit, expires_ms });
    transfer::share_object(b);
}

/// A holder sells free units into a bid; the seller receives price × units minus the market fee.
public fun sell_into_bid<C>(
    cfg: &Config,
    o: &mut SpaceOffering<C>,
    b: &mut Bid<C>,
    reg: &KycRegistry,
    units: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    admin::assert_active(cfg);
    assert!(b.offering_id == object::id(o), EWrongOffering);
    assert!(live(b.expires_ms, clock), EExpired);
    assert!(units > 0 && units <= b.units, ENotEnoughListed);
    let seller = ctx.sender();
    assert!(seller != b.buyer, ESelfTrade);
    kyc::assert_verified(reg, b.buyer, clock);
    offering::transfer_free(o, seller, b.buyer, units);
    let gross = units * b.price_per_unit;
    let mut proceeds = b.escrow.split(gross);
    let fee = admin::bps(gross, admin::market_fee_bps(cfg));
    if (fee > 0) transfer::public_transfer(coin::from_balance(proceeds.split(fee), ctx), admin::treasury(cfg));
    transfer::public_transfer(coin::from_balance(proceeds, ctx), seller);
    b.units = b.units - units;
    event::emit(BidFilled { bid_id: object::id(b), offering_id: b.offering_id, buyer: b.buyer, seller, units, price_per_unit: b.price_per_unit, fee });
}

public fun cancel_bid<C>(b: Bid<C>, ctx: &mut TxContext) {
    assert!(ctx.sender() == b.buyer, ENotBuyer);
    close_bid(b, false, ctx);
}

/// Anyone can refund an expired bid to its buyer.
public fun expire_bid<C>(b: Bid<C>, clock: &Clock, ctx: &mut TxContext) {
    assert!(!live(b.expires_ms, clock), ENotExpired);
    close_bid(b, true, ctx);
}

fun close_bid<C>(b: Bid<C>, expired: bool, ctx: &mut TxContext) {
    let Bid { id, offering_id, buyer, units, price_per_unit: _, escrow, expires_ms: _ } = b;
    let refunded = escrow.value();
    if (refunded > 0) transfer::public_transfer(coin::from_balance(escrow, ctx), buyer) else escrow.destroy_zero();
    event::emit(BidClosed { bid_id: id.to_inner(), offering_id, buyer, units_left: units, refunded, expired });
    id.delete();
}
