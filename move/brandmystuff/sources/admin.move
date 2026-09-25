/// Platform configuration and capabilities.
module brandmystuff::admin;

use std::type_name::{Self, TypeName};
use sui::event;
use sui::package;

const VERSION: u64 = 1;
const BPS: u64 = 10_000;

#[error]
const EWrongVersion: vector<u8> = b"Object version does not match the package version";
#[error]
const EPaused: vector<u8> = b"Platform is paused";
#[error]
const EWrongPaymentType: vector<u8> = b"Payment coin type is not the accepted settlement asset";
#[error]
const EPaymentTypeNotSet: vector<u8> = b"Settlement asset has not been configured";
#[error]
const EInvalidFee: vector<u8> = b"Fee out of range";
#[error]
const EInvalidWeek: vector<u8> = b"Week length out of range";

public struct ADMIN has drop {}

/// Full administrative control (fees, pause, moderation, disputes).
public struct AdminCap has key, store { id: UID }

/// Backend operator: writes AI scores, proof results, verification records, x402 bookings.
public struct OperatorCap has key, store { id: UID }

public struct Config has key {
    id: UID,
    version: u64,
    treasury: address,
    platform_fee_bps: u64,
    origination_fee_bps: u64,
    market_fee_bps: u64,
    /// Sponsorship price per day, atomic units of the settlement asset: [tier1, tier2].
    sponsor_price_per_day: vector<u64>,
    /// Length of a lease "week". 7 days in production, minutes in demo mode.
    week_ms: u64,
    demo_mode: bool,
    paused: bool,
    payment_type: Option<TypeName>,
    lease_seq: u64,
    offering_seq: u64,
}

public struct ConfigUpdated has copy, drop { config_id: ID }

fun init(otw: ADMIN, ctx: &mut TxContext) {
    package::claim_and_keep(otw, ctx);
    transfer::transfer(AdminCap { id: object::new(ctx) }, ctx.sender());
    transfer::transfer(OperatorCap { id: object::new(ctx) }, ctx.sender());
    transfer::share_object(Config {
        id: object::new(ctx),
        version: VERSION,
        treasury: ctx.sender(),
        platform_fee_bps: 1_200,
        origination_fee_bps: 300,
        market_fee_bps: 100,
        sponsor_price_per_day: vector[3_000_000, 10_000_000],
        week_ms: 7 * 24 * 60 * 60 * 1000,
        demo_mode: true,
        paused: false,
        payment_type: option::none(),
        lease_seq: 0,
        offering_seq: 0,
    });
}

// === Admin setters ===

public fun set_payment_type<C>(_: &AdminCap, cfg: &mut Config) {
    cfg.payment_type = option::some(type_name::with_defining_ids<C>());
    emit_updated(cfg);
}

public fun set_treasury(_: &AdminCap, cfg: &mut Config, treasury: address) {
    cfg.treasury = treasury;
    emit_updated(cfg);
}

public fun set_fees(_: &AdminCap, cfg: &mut Config, platform_bps: u64, origination_bps: u64, market_bps: u64) {
    assert!(platform_bps <= 3_000 && origination_bps <= 1_000 && market_bps <= 1_000, EInvalidFee);
    cfg.platform_fee_bps = platform_bps;
    cfg.origination_fee_bps = origination_bps;
    cfg.market_fee_bps = market_bps;
    emit_updated(cfg);
}

public fun set_sponsor_prices(_: &AdminCap, cfg: &mut Config, tier1: u64, tier2: u64) {
    cfg.sponsor_price_per_day = vector[tier1, tier2];
    emit_updated(cfg);
}

/// Changes the week length used by calendars created afterwards (existing calendars keep theirs).
public fun set_week_ms(_: &AdminCap, cfg: &mut Config, week_ms: u64) {
    assert!(week_ms >= 60_000 && week_ms <= 30 * 24 * 60 * 60 * 1000, EInvalidWeek);
    cfg.week_ms = week_ms;
    emit_updated(cfg);
}

public fun set_demo_mode(_: &AdminCap, cfg: &mut Config, demo: bool) {
    cfg.demo_mode = demo;
    emit_updated(cfg);
}

public fun set_paused(_: &AdminCap, cfg: &mut Config, paused: bool) {
    cfg.paused = paused;
    emit_updated(cfg);
}

public fun mint_operator_cap(_: &AdminCap, recipient: address, ctx: &mut TxContext) {
    transfer::transfer(OperatorCap { id: object::new(ctx) }, recipient);
}

public fun destroy_operator_cap(cap: OperatorCap) {
    let OperatorCap { id } = cap;
    id.delete();
}

public fun migrate(_: &AdminCap, cfg: &mut Config) {
    assert!(cfg.version < VERSION, EWrongVersion);
    cfg.version = VERSION;
}

fun emit_updated(cfg: &Config) {
    event::emit(ConfigUpdated { config_id: object::id(cfg) });
}

// === Package helpers ===

public(package) fun assert_active(cfg: &Config) {
    assert!(cfg.version == VERSION, EWrongVersion);
    assert!(!cfg.paused, EPaused);
}

public(package) fun assert_version(cfg: &Config) {
    assert!(cfg.version == VERSION, EWrongVersion);
}

public(package) fun assert_payment<C>(cfg: &Config) {
    assert!(cfg.payment_type.is_some(), EPaymentTypeNotSet);
    assert!(*cfg.payment_type.borrow() == type_name::with_defining_ids<C>(), EWrongPaymentType);
}

public(package) fun next_lease_seq(cfg: &mut Config): u64 {
    cfg.lease_seq = cfg.lease_seq + 1;
    cfg.lease_seq
}

public(package) fun next_offering_seq(cfg: &mut Config): u64 {
    cfg.offering_seq = cfg.offering_seq + 1;
    cfg.offering_seq
}

public(package) fun bps(amount: u64, bps: u64): u64 {
    (((amount as u128) * (bps as u128)) / (BPS as u128)) as u64
}

// === Getters ===

public fun treasury(cfg: &Config): address { cfg.treasury }
public fun platform_fee_bps(cfg: &Config): u64 { cfg.platform_fee_bps }
public fun origination_fee_bps(cfg: &Config): u64 { cfg.origination_fee_bps }
public fun market_fee_bps(cfg: &Config): u64 { cfg.market_fee_bps }
public fun week_ms(cfg: &Config): u64 { cfg.week_ms }
public fun demo_mode(cfg: &Config): bool { cfg.demo_mode }
public fun paused(cfg: &Config): bool { cfg.paused }
public fun sponsor_price_per_day(cfg: &Config, tier: u8): u64 { cfg.sponsor_price_per_day[(tier as u64) - 1] }
public fun version(): u64 { VERSION }
