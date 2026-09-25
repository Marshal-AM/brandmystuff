/// Paid "Sponsored" tag for objects. Never affects scores or organic ranking.
module brandmystuff::sponsor;

use sui::clock::Clock;
use sui::coin::Coin;
use sui::event;
use brandmystuff::admin::{Self, Config, OperatorCap};
use brandmystuff::asset::{Self, ListedObject};

#[error]
const ENotOwner: vector<u8> = b"Only the object owner can sponsor it";
#[error]
const EInvalidTier: vector<u8> = b"Tier must be 1 or 2";
#[error]
const EInvalidDays: vector<u8> = b"Days must be 1-90";
#[error]
const ENotEligible: vector<u8> = b"Object must be live with at least one space";
#[error]
const EWrongAmount: vector<u8> = b"Payment must equal price per day x days";

public struct Sponsored has copy, drop {
    object_id: ID,
    payer: address,
    tier: u8,
    days: u64,
    paid: u64,
    sponsored_until_ms: u64,
}

public fun buy_sponsorship<C>(
    cfg: &Config,
    obj: &mut ListedObject,
    pay: Coin<C>,
    tier: u8,
    days: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(ctx.sender() == asset::object_owner(obj), ENotOwner);
    sponsor_internal(cfg, obj, pay, tier, days, ctx.sender(), clock);
}

/// x402 path: payment was received by the platform treasury.
public fun buy_sponsorship_for<C>(
    _: &OperatorCap,
    cfg: &Config,
    obj: &mut ListedObject,
    pay: Coin<C>,
    tier: u8,
    days: u64,
    payer: address,
    clock: &Clock,
) {
    sponsor_internal(cfg, obj, pay, tier, days, payer, clock);
}

fun sponsor_internal<C>(cfg: &Config, obj: &mut ListedObject, pay: Coin<C>, tier: u8, days: u64, payer: address, clock: &Clock) {
    admin::assert_active(cfg);
    admin::assert_payment<C>(cfg);
    assert!(tier == 1 || tier == 2, EInvalidTier);
    assert!(days >= 1 && days <= 90, EInvalidDays);
    assert!(asset::object_is_live(obj) && asset::object_space_count(obj) > 0, ENotEligible);
    let price = admin::sponsor_price_per_day(cfg, tier) * days;
    assert!(pay.value() == price, EWrongAmount);
    transfer::public_transfer(pay, admin::treasury(cfg));
    let day_ms = admin::week_ms(cfg) / 7;
    let now = clock.timestamp_ms();
    let current = asset::sponsored_until_ms(obj);
    let base = if (current > now) current else now;
    let until = base + days * day_ms;
    asset::set_sponsored_until(obj, until);
    event::emit(Sponsored { object_id: object::id(obj), payer, tier, days, paid: price, sponsored_until_ms: until });
}
