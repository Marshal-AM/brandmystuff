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
