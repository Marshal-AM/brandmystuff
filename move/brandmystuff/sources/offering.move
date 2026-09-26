/// Tokenisation of an ad space's future lease revenue into 10,000 revenue units.
/// Units live in a verification-gated ledger; revenue is distributed with a reward-per-unit accumulator.
module brandmystuff::offering;

use std::string::String;
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;
use sui::table::{Self, Table};
use brandmystuff::admin::{Self, Config};
use brandmystuff::asset::{Self, AdSpace};
use brandmystuff::kyc::{Self, KycRegistry};

const PRECISION: u128 = 1_000_000_000_000_000_000;
const TOTAL_UNITS: u64 = 10_000;
const MIN_RETAINED: u64 = 1_000;
const MIN_SALE_MS: u64 = 5 * 60 * 1000;
const MAX_SALE_MS: u64 = 30 * 24 * 60 * 60 * 1000;

const STATUS_OPEN: u8 = 0;
const STATUS_TOKENISED: u8 = 1;
const STATUS_REFUNDING: u8 = 2;

const GRADE_B: u8 = 2;

#[error]
const ENotOwner: vector<u8> = b"Only the space owner can tokenise it";
#[error]
const ENotAvailable: vector<u8> = b"Space must be listed and available";
#[error]
const EGradeTooLow: vector<u8> = b"Space grade must be B or better";
#[error]
const EAlreadyTokenised: vector<u8> = b"Space already has an offering";
#[error]
const ENoTrackRecord: vector<u8> = b"Space needs a completed lease or an accepted proof";
#[error]
const EInvalidParams: vector<u8> = b"Offering parameters out of range";
#[error]
const EWrongSpace: vector<u8> = b"Offering does not belong to this space";
#[error]
const ENotOpen: vector<u8> = b"Offering is not open";
#[error]
const ESaleEnded: vector<u8> = b"Sale window has ended";
#[error]
const ESaleNotEnded: vector<u8> = b"Sale window has not ended and units remain";
#[error]
const ENotEnoughUnits: vector<u8> = b"Not enough units available";
#[error]
const EOverInvestorMax: vector<u8> = b"Purchase exceeds the per-investor maximum";
#[error]
const EWrongAmount: vector<u8> = b"Payment must equal units x price";
#[error]
const ENotRefunding: vector<u8> = b"Offering is not refunding";
#[error]
const ENoHolding: vector<u8> = b"No holding for this address";
#[error]
const ENothingToClaim: vector<u8> = b"Nothing to claim";
#[error]
const EZeroUnits: vector<u8> = b"Units must be positive";

public struct Holding has store {
    units: u64,
    listed_units: u64,
    reward_debt: u128,
    claimable: u64,
    paid: u64,
}

public struct SpaceOffering<phantom C> has key {
    id: UID,
    seq: u64,
    space_id: ID,
    owner: address,
    revenue_share_bps: u64,
    total_units: u64,
    offered_units: u64,
    retained_units: u64,
    sold_units: u64,
    /// Units currently held by anyone (denominator of the accumulator).
    issued_units: u64,
    min_raise_units: u64,
    price_per_unit: u64,
    per_investor_max: u64,
    sale_end_ms: u64,
    term_months: u64,
    legal_pack_hash: vector<u8>,
    legal_pack_blob_id: String,
    status: u8,
    acc_per_unit: u128,
    dust: u128,
    holders: Table<address, Holding>,
    holder_count: u64,
    raise: Balance<C>,
    rewards: Balance<C>,
    total_distributed: u64,
    created_ms: u64,
}

// === Events ===

public struct OfferingOpened has copy, drop {
    offering_id: ID,
    seq: u64,
    space_id: ID,
    owner: address,
    revenue_share_bps: u64,
    retained_units: u64,
    offered_units: u64,
    price_per_unit: u64,
    min_raise_units: u64,
    per_investor_max: u64,
    sale_end_ms: u64,
    term_months: u64,
    legal_pack_hash: vector<u8>,
    legal_pack_blob_id: String,
    owner_accept_sig_hash: vector<u8>,
}

public struct UnitsPurchased has copy, drop {
    offering_id: ID,
    buyer: address,
    units: u64,
    paid: u64,
    accept_sig_hash: vector<u8>,
}

public struct OfferingClosed has copy, drop {
    offering_id: ID,
    success: bool,
    sold_units: u64,
    raised: u64,
    fee: u64,
    to_owner: u64,
}

public struct Refunded has copy, drop { offering_id: ID, holder: address, amount: u64 }

public struct Distributed has copy, drop {
    offering_id: ID,
    amount: u64,
    acc_per_unit: u128,
    issued_units: u64,
}

public struct Claimed has copy, drop { offering_id: ID, holder: address, amount: u64 }

// === Lifecycle ===

public fun create<C>(
    cfg: &mut Config,
    space: &mut AdSpace,
    reg: &KycRegistry,
    revenue_share_bps: u64,
    retained_units: u64,
    price_per_unit: u64,
    min_raise_units: u64,
    sale_duration_ms: u64,
    per_investor_max: u64,
    term_months: u64,
    legal_pack_hash: vector<u8>,
    legal_pack_blob_id: String,
    owner_accept_sig_hash: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    admin::assert_active(cfg);
    admin::assert_payment<C>(cfg);
    let owner = ctx.sender();
    assert!(owner == asset::owner(space), ENotOwner);
    assert!(asset::is_available(space), ENotAvailable);
    assert!(asset::grade(space) >= GRADE_B, EGradeTooLow);
    assert!(asset::offering_id(space).is_none(), EAlreadyTokenised);
    kyc::assert_verified(reg, owner, clock);
    assert!(
        admin::demo_mode(cfg) || asset::completed_leases(space) >= 1 || asset::accepted_proofs(space) >= 1,
        ENoTrackRecord,
    );
    let max_share = 10_000 - admin::platform_fee_bps(cfg);
    assert!(revenue_share_bps >= 1_000 && revenue_share_bps <= max_share, EInvalidParams);
    assert!(retained_units >= MIN_RETAINED && retained_units < TOTAL_UNITS, EInvalidParams);
    let offered = TOTAL_UNITS - retained_units;
    assert!(min_raise_units <= offered, EInvalidParams);
    assert!(price_per_unit > 0, EInvalidParams);
    assert!(sale_duration_ms >= MIN_SALE_MS && sale_duration_ms <= MAX_SALE_MS, EInvalidParams);
    assert!(per_investor_max > 0 && per_investor_max <= offered, EInvalidParams);
    assert!(term_months >= 6 && term_months <= 36, EInvalidParams);

    let seq = admin::next_offering_seq(cfg);
    let mut holders = table::new<address, Holding>(ctx);
    holders.add(owner, Holding { units: retained_units, listed_units: 0, reward_debt: 0, claimable: 0, paid: 0 });
    let sale_end_ms = clock.timestamp_ms() + sale_duration_ms;
    let o = SpaceOffering<C> {
        id: object::new(ctx),
        seq,
        space_id: object::id(space),
        owner,
        revenue_share_bps,
        total_units: TOTAL_UNITS,
        offered_units: offered,
        retained_units,
        sold_units: 0,
        issued_units: retained_units,
        min_raise_units,
        price_per_unit,
        per_investor_max,
        sale_end_ms,
        term_months,
        legal_pack_hash,
        legal_pack_blob_id,
        status: STATUS_OPEN,
        acc_per_unit: 0,
        dust: 0,
        holders,
        holder_count: 1,
        raise: balance::zero(),
        rewards: balance::zero(),
        total_distributed: 0,
        created_ms: clock.timestamp_ms(),
    };
    asset::set_offering(space, option::some(object::id(&o)));
    event::emit(OfferingOpened {
        offering_id: object::id(&o),
        seq,
        space_id: object::id(space),
        owner,
        revenue_share_bps,
        retained_units,
        offered_units: offered,
        price_per_unit,
        min_raise_units,
        per_investor_max,
        sale_end_ms,
        term_months,
        legal_pack_hash: o.legal_pack_hash,
        legal_pack_blob_id: o.legal_pack_blob_id,
        owner_accept_sig_hash,
    });
    transfer::share_object(o);
}

public fun buy_primary<C>(
    cfg: &Config,
    o: &mut SpaceOffering<C>,
    reg: &KycRegistry,
    pay: Coin<C>,
    units: u64,
    accept_sig_hash: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    admin::assert_active(cfg);
    assert!(o.status == STATUS_OPEN, ENotOpen);
    assert!(clock.timestamp_ms() < o.sale_end_ms, ESaleEnded);
    assert!(units > 0, EZeroUnits);
    let buyer = ctx.sender();
    kyc::assert_verified(reg, buyer, clock);
    assert!(o.sold_units + units <= o.offered_units, ENotEnoughUnits);
    let cost = units * o.price_per_unit;
    assert!(pay.value() == cost, EWrongAmount);

    ensure_holding(o, buyer);
    let acc = o.acc_per_unit;
    let is_owner = buyer == o.owner;
    let max = o.per_investor_max;
    let h = o.holders.borrow_mut(buyer);
    if (!is_owner) {
        assert!(h.units + h.listed_units + units <= max, EOverInvestorMax);
    };
    settle(h, acc);
    h.units = h.units + units;
    h.reward_debt = ((h.units + h.listed_units) as u128) * acc;
    h.paid = h.paid + cost;
    o.sold_units = o.sold_units + units;
    o.issued_units = o.issued_units + units;
    o.raise.join(pay.into_balance());
    event::emit(UnitsPurchased { offering_id: object::id(o), buyer, units, paid: cost, accept_sig_hash });
}

/// Callable by anyone once the sale window ends or the offering sells out.
public fun close<C>(cfg: &Config, o: &mut SpaceOffering<C>, space: &mut AdSpace, clock: &Clock, ctx: &mut TxContext) {
    admin::assert_version(cfg);
    assert!(o.status == STATUS_OPEN, ENotOpen);
    assert!(object::id(space) == o.space_id, EWrongSpace);
    assert!(clock.timestamp_ms() >= o.sale_end_ms || o.sold_units == o.offered_units, ESaleNotEnded);
    let raised = o.raise.value();
    if (o.sold_units >= o.min_raise_units) {
        let fee = admin::bps(raised, admin::origination_fee_bps(cfg));
        let mut all = o.raise.withdraw_all();
        if (fee > 0) {
            transfer::public_transfer(coin::from_balance(all.split(fee), ctx), admin::treasury(cfg));
        };
        let to_owner = all.value();
        pay_or_destroy(all, o.owner, ctx);
        // Unsold units go to the owner.
        let unsold = o.offered_units - o.sold_units;
        if (unsold > 0) {
            let acc = o.acc_per_unit;
            let h = o.holders.borrow_mut(o.owner);
            settle(h, acc);
            h.units = h.units + unsold;
            h.reward_debt = ((h.units + h.listed_units) as u128) * acc;
            o.issued_units = o.issued_units + unsold;
        };
        o.status = STATUS_TOKENISED;
        event::emit(OfferingClosed { offering_id: object::id(o), success: true, sold_units: o.sold_units, raised, fee, to_owner });
    } else {
        o.status = STATUS_REFUNDING;
        asset::set_offering(space, option::none());
        event::emit(OfferingClosed { offering_id: object::id(o), success: false, sold_units: o.sold_units, raised, fee: 0, to_owner: 0 });
    }
}

/// In a failed offering, investors get their payment back. Accrued revenue stays claimable.
public fun refund<C>(o: &mut SpaceOffering<C>, ctx: &mut TxContext) {
    assert!(o.status == STATUS_REFUNDING, ENotRefunding);
    let who = ctx.sender();
    assert!(o.holders.contains(who), ENoHolding);
    let acc = o.acc_per_unit;
    let h = o.holders.borrow_mut(who);
    settle(h, acc);
    let amount = h.paid;
    let units = h.units;
    h.units = 0;
    h.reward_debt = 0;
    h.paid = 0;
    o.issued_units = o.issued_units - units;
    assert!(amount > 0, ENothingToClaim);
    transfer::public_transfer(coin::from_balance(o.raise.split(amount), ctx), who);
    event::emit(Refunded { offering_id: object::id(o), holder: who, amount });
}

public fun claim<C>(o: &mut SpaceOffering<C>, ctx: &mut TxContext) {
    let who = ctx.sender();
    assert!(o.holders.contains(who), ENoHolding);
    let acc = o.acc_per_unit;
    let h = o.holders.borrow_mut(who);
    settle(h, acc);
    let amount = h.claimable;
    assert!(amount > 0, ENothingToClaim);
    h.claimable = 0;
    transfer::public_transfer(coin::from_balance(o.rewards.split(amount), ctx), who);
    event::emit(Claimed { offering_id: object::id(o), holder: who, amount });
}

// === Package: revenue & unit movements ===

public(package) fun distribute<C>(o: &mut SpaceOffering<C>, rev: Balance<C>) {
    let amount = rev.value();
    if (amount == 0) {
        rev.destroy_zero();
        return
    };
    let num = (amount as u128) * PRECISION + o.dust;
    let denom = o.issued_units as u128;
    o.acc_per_unit = o.acc_per_unit + num / denom;
    o.dust = num % denom;
    o.total_distributed = o.total_distributed + amount;
    o.rewards.join(rev);
    event::emit(Distributed { offering_id: object::id(o), amount, acc_per_unit: o.acc_per_unit, issued_units: o.issued_units });
}

public(package) fun revenue_share_bps<C>(o: &SpaceOffering<C>): u64 { o.revenue_share_bps }
public(package) fun is_active<C>(o: &SpaceOffering<C>): bool { o.status != STATUS_REFUNDING }
public(package) fun is_tokenised<C>(o: &SpaceOffering<C>): bool { o.status == STATUS_TOKENISED }
public(package) fun offering_owner<C>(o: &SpaceOffering<C>): address { o.owner }
public(package) fun per_investor_max<C>(o: &SpaceOffering<C>): u64 { o.per_investor_max }

/// Moves `units` of the seller's free units into the listed bucket.
public(package) fun lock_units<C>(o: &mut SpaceOffering<C>, seller: address, units: u64) {
    assert!(o.holders.contains(seller), ENoHolding);
    let h = o.holders.borrow_mut(seller);
    assert!(h.units >= units, ENotEnoughUnits);
    // Listed units keep earning for the seller until sold (accrual counts units + listed_units).
    h.units = h.units - units;
    h.listed_units = h.listed_units + units;
}

public(package) fun unlock_units<C>(o: &mut SpaceOffering<C>, seller: address, units: u64) {
    let h = o.holders.borrow_mut(seller);
    h.listed_units = h.listed_units - units;
    h.units = h.units + units;
}

/// Transfers listed units from seller to buyer, settling both first.
public(package) fun transfer_listed<C>(o: &mut SpaceOffering<C>, seller: address, buyer: address, units: u64) {
    ensure_holding(o, buyer);
    let acc = o.acc_per_unit;
    let max = o.per_investor_max;
    let buyer_is_owner = buyer == o.owner;
    {
        let s = o.holders.borrow_mut(seller);
        settle(s, acc);
        s.listed_units = s.listed_units - units;
        s.reward_debt = ((s.units + s.listed_units) as u128) * acc;
    };
    let b = o.holders.borrow_mut(buyer);
    settle(b, acc);
    b.units = b.units + units;
    if (!buyer_is_owner) {
        assert!(b.units + b.listed_units <= max, EOverInvestorMax);
    };
    b.reward_debt = ((b.units + b.listed_units) as u128) * acc;
}

/// Moves free (unlisted) units between holders, settling both first. Used by bids and transfers.
public(package) fun transfer_free<C>(o: &mut SpaceOffering<C>, from: address, to: address, units: u64) {
    assert!(units > 0, EZeroUnits);
    assert!(o.holders.contains(from), ENoHolding);
    ensure_holding(o, to);
    let acc = o.acc_per_unit;
    let max = o.per_investor_max;
    let to_is_owner = to == o.owner;
    {
        let s = o.holders.borrow_mut(from);
        assert!(s.units >= units, ENotEnoughUnits);
        settle(s, acc);
        s.units = s.units - units;
        s.reward_debt = ((s.units + s.listed_units) as u128) * acc;
    };
    let b = o.holders.borrow_mut(to);
    settle(b, acc);
    b.units = b.units + units;
    if (!to_is_owner) {
        assert!(b.units + b.listed_units <= max, EOverInvestorMax);
    };
    b.reward_debt = ((b.units + b.listed_units) as u128) * acc;
}

public struct UnitsTransferred has copy, drop { offering_id: ID, from: address, to: address, units: u64 }

/// Verified-to-verified transfer of revenue units (restricted security transfer).
public fun transfer_units<C>(
    cfg: &Config,
    o: &mut SpaceOffering<C>,
    reg: &KycRegistry,
    to: address,
    units: u64,
    clock: &Clock,
    ctx: &TxContext,
) {
    admin::assert_active(cfg);
    assert!(o.status == STATUS_TOKENISED, ENotOpen);
    let from = ctx.sender();
    assert!(from != to, EZeroUnits);
    kyc::assert_verified(reg, to, clock);
    transfer_free(o, from, to, units);
    event::emit(UnitsTransferred { offering_id: object::id(o), from, to, units });
}

/// (free units, listed units) held by `who`.
public fun units_of<C>(o: &SpaceOffering<C>, who: address): (u64, u64) {
    if (!o.holders.contains(who)) return (0, 0);
    let h = o.holders.borrow(who);
    (h.units, h.listed_units)
}

public fun offering_owner_addr<C>(o: &SpaceOffering<C>): address { o.owner }
public fun max_per_investor<C>(o: &SpaceOffering<C>): u64 { o.per_investor_max }

fun ensure_holding<C>(o: &mut SpaceOffering<C>, who: address) {
    if (!o.holders.contains(who)) {
        o.holders.add(who, Holding { units: 0, listed_units: 0, reward_debt: 0, claimable: 0, paid: 0 });
        o.holder_count = o.holder_count + 1;
    }
}

/// Accrues pending revenue into `claimable`. Accrual counts free + listed units.
fun settle(h: &mut Holding, acc: u128) {
    let accrued = ((h.units + h.listed_units) as u128) * acc;
    if (accrued > h.reward_debt) {
        h.claimable = h.claimable + (((accrued - h.reward_debt) / PRECISION) as u64);
    };
    h.reward_debt = accrued;
}

fun pay_or_destroy<C>(b: Balance<C>, to: address, ctx: &mut TxContext) {
    if (b.value() > 0) transfer::public_transfer(coin::from_balance(b, ctx), to)
    else b.destroy_zero();
}

// === Getters ===

public fun space_id<C>(o: &SpaceOffering<C>): ID { o.space_id }
public fun status<C>(o: &SpaceOffering<C>): u8 { o.status }
public fun sold_units<C>(o: &SpaceOffering<C>): u64 { o.sold_units }
public fun acc_per_unit<C>(o: &SpaceOffering<C>): u128 { o.acc_per_unit }
public fun total_distributed<C>(o: &SpaceOffering<C>): u64 { o.total_distributed }

public fun holding_of<C>(o: &SpaceOffering<C>, who: address): (u64, u64, u64) {
    if (!o.holders.contains(who)) return (0, 0, 0);
    let h = o.holders.borrow(who);
    let accrued = ((h.units + h.listed_units) as u128) * o.acc_per_unit;
    let pending = if (accrued > h.reward_debt) (((accrued - h.reward_debt) / PRECISION) as u64) else 0;
    (h.units, h.listed_units, h.claimable + pending)
}

// === Package: routed payouts (v3, used by brandmystuff::payout) ===

/// Settles `holder` and takes everything they can claim right now. Only reachable through
/// payout::release_routed, which requires the holder's own on-chain payout route.
public(package) fun take_claimable<C>(o: &mut SpaceOffering<C>, holder: address): Balance<C> {
    assert!(o.holders.contains(holder), ENoHolding);
    let offering_id = object::id(o);
    let acc = o.acc_per_unit;
    let h = o.holders.borrow_mut(holder);
    settle(h, acc);
    let amount = h.claimable;
    h.claimable = 0;
    if (amount > 0) event::emit(Claimed { offering_id, holder, amount });
    o.rewards.split(amount)
}
