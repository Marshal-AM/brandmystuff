/// Leases: upfront USDC escrow, creative approval, proof-of-display tranches, refunds, disputes.
module brandmystuff::lease;

use std::internal;
use std::string::{Self, String};
use sui::balance::Balance;
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::display_registry::{Self, DisplayRegistry};
use sui::event;
use sui::table::{Self, Table};
use brandmystuff::admin::{Self, AdminCap, Config, OperatorCap};
use brandmystuff::asset::{Self, AdSpace, SpaceCalendar};
use brandmystuff::offering::{Self, SpaceOffering};

const PENDING_APPROVAL: u8 = 0;
const AWAITING_INSTALL: u8 = 1;
const LIVE: u8 = 2;
const COMPLETED: u8 = 3;
const DISPUTED: u8 = 4;
const CANCELLED: u8 = 5;
const REFUNDED: u8 = 6;

const PERIOD_ACCEPTED: u8 = 1;
const PERIOD_REFUNDED: u8 = 2;

const MAX_WEEKS: u64 = 52;
const MIN_MATCH_BPS: u16 = 8_000;

#[error]
const ESpaceUnavailable: vector<u8> = b"Space is not available for booking";
#[error]
const EWrongCalendar: vector<u8> = b"Calendar does not belong to this space";
#[error]
const EInvalidWeeks: vector<u8> = b"Duration must be 1-52 weeks";
#[error]
const EStartInPast: vector<u8> = b"Start week is in the past";
#[error]
const EWeekTaken: vector<u8> = b"One of the requested weeks is already booked";
#[error]
const EWrongAmount: vector<u8> = b"Payment must equal price per week x weeks";
#[error]
const ENotOwner: vector<u8> = b"Only the space owner can do this";
#[error]
const ENotAdvertiser: vector<u8> = b"Only the advertiser can do this";
#[error]
const EBadStatus: vector<u8> = b"Lease status does not allow this action";
#[error]
const EDeadlinePassed: vector<u8> = b"Deadline has passed";
#[error]
const EDeadlineNotPassed: vector<u8> = b"Deadline has not passed yet";
#[error]
const EInvalidPeriod: vector<u8> = b"Invalid period";
#[error]
const EPeriodResolved: vector<u8> = b"Period already resolved";
#[error]
const EOutsideWindow: vector<u8> = b"Proof is outside this period's window";
#[error]
const ELowMatch: vector<u8> = b"Proof match scores below threshold";
#[error]
const EWrongSpace: vector<u8> = b"Escrow does not belong to this space";
#[error]
const EWrongOffering: vector<u8> = b"Offering does not match the space";
#[error]
const ETokenised: vector<u8> = b"Space is tokenised: use accept_proof_tokenised";
#[error]
const EDisputeWindow: vector<u8> = b"Dispute window is closed";
#[error]
const EWrongLease: vector<u8> = b"Lease NFT does not match this escrow";

/// Receipt/NFT held by the advertiser. The state machine lives in the shared `LeaseEscrow`.
public struct AdLease has key, store {
    id: UID,
    seq: u64,
    space_id: ID,
    escrow_id: ID,
    advertiser: address,
    start_ms: u64,
    weeks: u64,
    total_paid: u64,
    creative_blob_id: String,
    creative_hash: vector<u8>,
    landing_url: String,
    brand: String,
    ens_label: String,
}

public struct LeaseEscrow<phantom C> has key {
    id: UID,
    seq: u64,
    lease_id: ID,
    space_id: ID,
    calendar_id: ID,
    advertiser: address,
    owner: address,
    escrow: Balance<C>,
    week_ms: u64,
    start_ms: u64,
    weeks: u64,
    /// weeks + 1 (install proof is period 0)
    tranches: u64,
    resolved: u64,
    released: u64,
    total_paid: u64,
    status: u8,
    booked_at_ms: u64,
    approve_deadline_ms: u64,
    dispute_until_ms: u64,
    creative_blob_id: String,
    creative_hash: vector<u8>,
    periods: Table<u64, u8>,
    proofs: Table<u64, String>,
}

// === Events ===

public struct LeaseBooked has copy, drop {
    lease_id: ID,
    escrow_id: ID,
    seq: u64,
    ens_label: String,
    space_id: ID,
    advertiser: address,
    owner: address,
    start_ms: u64,
    week_ms: u64,
    weeks: u64,
    total_paid: u64,
    creative_blob_id: String,
    creative_hash: vector<u8>,
    landing_url: String,
    brand: String,
    via_operator: bool,
}

public struct CreativeApproved has copy, drop { escrow_id: ID, space_id: ID, end_ms: u64 }
public struct CreativeRejected has copy, drop { escrow_id: ID, space_id: ID, refunded: u64 }
public struct LeaseExpired has copy, drop { escrow_id: ID, space_id: ID, reason: u8, refunded: u64 }

public struct ProofAccepted has copy, drop {
    escrow_id: ID,
    space_id: ID,
    period: u64,
    photo_blob_id: String,
    match_score_bps: u16,
    object_match_bps: u16,
}

public struct TrancheReleased has copy, drop {
    escrow_id: ID,
    space_id: ID,
    period: u64,
    gross: u64,
    platform_fee: u64,
    investor_share: u64,
    to_owner: u64,
}

public struct TrancheRefunded has copy, drop { escrow_id: ID, space_id: ID, period: u64, amount: u64 }
public struct DisputeOpened has copy, drop { escrow_id: ID, space_id: ID }
public struct DisputeResolved has copy, drop { escrow_id: ID, space_id: ID, refunded: u64 }
public struct LeaseExtended has copy, drop { escrow_id: ID, space_id: ID, extra_weeks: u64, paid: u64, new_end_ms: u64 }
public struct LeaseCompleted has copy, drop { escrow_id: ID, space_id: ID, released: u64 }

// === Booking ===

public fun book<C>(
    cfg: &mut Config,
    space: &mut AdSpace,
    cal: &mut SpaceCalendar,
    pay: Coin<C>,
    start_week: u64,
    weeks: u64,
    creative_blob_id: String,
    creative_hash: vector<u8>,
    landing_url: String,
    brand: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let advertiser = ctx.sender();
    book_internal(cfg, space, cal, pay, start_week, weeks, creative_blob_id, creative_hash, landing_url, brand, advertiser, false, clock, ctx);
}

/// x402 path: the platform received the agent's payment and books on its behalf.
public fun book_for<C>(
    _: &OperatorCap,
    cfg: &mut Config,
    space: &mut AdSpace,
    cal: &mut SpaceCalendar,
    pay: Coin<C>,
    start_week: u64,
    weeks: u64,
    creative_blob_id: String,
    creative_hash: vector<u8>,
    landing_url: String,
    brand: String,
    advertiser: address,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    book_internal(cfg, space, cal, pay, start_week, weeks, creative_blob_id, creative_hash, landing_url, brand, advertiser, true, clock, ctx);
}

fun book_internal<C>(
    cfg: &mut Config,
    space: &mut AdSpace,
    cal: &mut SpaceCalendar,
    pay: Coin<C>,
    start_week: u64,
    weeks: u64,
    creative_blob_id: String,
    creative_hash: vector<u8>,
    landing_url: String,
    brand: String,
    advertiser: address,
    via_operator: bool,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    admin::assert_active(cfg);
    admin::assert_payment<C>(cfg);
    assert!(asset::is_available(space), ESpaceUnavailable);
    assert!(asset::calendar_id(space) == object::id(cal), EWrongCalendar);
    assert!(weeks >= 1 && weeks <= MAX_WEEKS, EInvalidWeeks);
    let week_ms = asset::calendar_week_ms(cal);
    let now = clock.timestamp_ms();
    assert!(start_week >= now / week_ms, EStartInPast);
    let total = asset::price_per_week(space) * weeks;
    assert!(pay.value() == total, EWrongAmount);

    let seq = admin::next_lease_seq(cfg);
    let mut ens_label = string::utf8(b"l-");
    ens_label.append(seq.to_string());

    let escrow_uid = object::new(ctx);
    let escrow_id = escrow_uid.to_inner();
    let mut i = 0;
    while (i < weeks) {
        let w = start_week + i;
        assert!(asset::is_week_free(cal, w), EWeekTaken);
        asset::book_week(cal, w, escrow_id);
        i = i + 1;
    };

    let start_ms = start_week * week_ms;
    let lease = AdLease {
        id: object::new(ctx),
        seq,
        space_id: object::id(space),
        escrow_id,
        advertiser,
        start_ms,
        weeks,
        total_paid: total,
        creative_blob_id,
        creative_hash,
        landing_url,
        brand,
        ens_label,
    };
    let lease_id = object::id(&lease);
    let esc = LeaseEscrow<C> {
        id: escrow_uid,
        seq,
        lease_id,
        space_id: object::id(space),
        calendar_id: object::id(cal),
        advertiser,
        owner: asset::owner(space),
        escrow: pay.into_balance(),
        week_ms,
        start_ms,
        weeks,
        tranches: weeks + 1,
        resolved: 0,
        released: 0,
        total_paid: total,
        status: PENDING_APPROVAL,
        booked_at_ms: now,
        approve_deadline_ms: now + week_ms * 5 / 7,
        dispute_until_ms: 0,
        creative_blob_id: lease.creative_blob_id,
        creative_hash: lease.creative_hash,
        periods: table::new(ctx),
        proofs: table::new(ctx),
    };
    asset::inc_active(space);
    event::emit(LeaseBooked {
        lease_id,
        escrow_id,
        seq,
        ens_label: lease.ens_label,
        space_id: object::id(space),
        advertiser,
        owner: esc.owner,
        start_ms,
        week_ms,
        weeks,
        total_paid: total,
        creative_blob_id: lease.creative_blob_id,
        creative_hash: lease.creative_hash,
        landing_url: lease.landing_url,
        brand: lease.brand,
        via_operator,
    });
    transfer::public_transfer(lease, advertiser);
    transfer::share_object(esc);
}

// === Approval ===

public fun approve_creative<C>(esc: &mut LeaseEscrow<C>, clock: &Clock, ctx: &TxContext) {
    assert!(ctx.sender() == esc.owner, ENotOwner);
    assert!(esc.status == PENDING_APPROVAL, EBadStatus);
    assert!(clock.timestamp_ms() <= esc.approve_deadline_ms, EDeadlinePassed);
    esc.status = AWAITING_INSTALL;
    event::emit(CreativeApproved { escrow_id: object::id(esc), space_id: esc.space_id, end_ms: end_ms(esc) });
}

public fun reject_creative<C>(esc: &mut LeaseEscrow<C>, space: &mut AdSpace, cal: &mut SpaceCalendar, ctx: &mut TxContext) {
    assert!(ctx.sender() == esc.owner, ENotOwner);
    assert!(esc.status == PENDING_APPROVAL, EBadStatus);
    assert_links(esc, space, cal);
    let refunded = cancel_and_refund(esc, space, cal, ctx);
    event::emit(CreativeRejected { escrow_id: object::id(esc), space_id: esc.space_id, refunded });
}

/// Anyone can expire a lease whose creative was not approved in time.
public fun expire_unapproved<C>(esc: &mut LeaseEscrow<C>, space: &mut AdSpace, cal: &mut SpaceCalendar, clock: &Clock, ctx: &mut TxContext) {
    assert!(esc.status == PENDING_APPROVAL, EBadStatus);
    assert!(clock.timestamp_ms() > esc.approve_deadline_ms, EDeadlineNotPassed);
    assert_links(esc, space, cal);
    let refunded = cancel_and_refund(esc, space, cal, ctx);
    event::emit(LeaseExpired { escrow_id: object::id(esc), space_id: esc.space_id, reason: 0, refunded });
}

// === Proofs & tranches ===

public fun accept_proof<C>(
    _: &OperatorCap,
    cfg: &Config,
    esc: &mut LeaseEscrow<C>,
    space: &mut AdSpace,
    period: u64,
    photo_blob_id: String,
    match_score_bps: u16,
    object_match_bps: u16,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(asset::offering_id(space).is_none(), ETokenised);
    let gross = accept_internal(cfg, esc, space, period, photo_blob_id, match_score_bps, object_match_bps, clock);
    let mut bal = gross;
    let gross_v = bal.value();
    let fee = admin::bps(gross_v, admin::platform_fee_bps(cfg));
    pay(bal.split(fee), admin::treasury(cfg), ctx);
    let to_owner = bal.value();
    pay(bal, esc.owner, ctx);
    event::emit(TrancheReleased { escrow_id: object::id(esc), space_id: esc.space_id, period, gross: gross_v, platform_fee: fee, investor_share: 0, to_owner });
    finish_if_done(esc, space);
}

public fun accept_proof_tokenised<C>(
    _: &OperatorCap,
    cfg: &Config,
    esc: &mut LeaseEscrow<C>,
    space: &mut AdSpace,
    off: &mut SpaceOffering<C>,
    period: u64,
    photo_blob_id: String,
    match_score_bps: u16,
    object_match_bps: u16,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let oid = asset::offering_id(space);
    assert!(oid.is_some() && *oid.borrow() == object::id(off), EWrongOffering);
    let gross = accept_internal(cfg, esc, space, period, photo_blob_id, match_score_bps, object_match_bps, clock);
    let mut bal = gross;
    let gross_v = bal.value();
    let fee = admin::bps(gross_v, admin::platform_fee_bps(cfg));
    pay(bal.split(fee), admin::treasury(cfg), ctx);
    let mut share = admin::bps(gross_v, offering::revenue_share_bps(off));
    if (share > bal.value()) share = bal.value();
    offering::distribute(off, bal.split(share));
    let to_owner = bal.value();
    pay(bal, esc.owner, ctx);
    event::emit(TrancheReleased { escrow_id: object::id(esc), space_id: esc.space_id, period, gross: gross_v, platform_fee: fee, investor_share: share, to_owner });
    finish_if_done(esc, space);
}

fun accept_internal<C>(
    cfg: &Config,
    esc: &mut LeaseEscrow<C>,
    space: &mut AdSpace,
    period: u64,
    photo_blob_id: String,
    match_score_bps: u16,
    object_match_bps: u16,
    clock: &Clock,
): Balance<C> {
    admin::assert_active(cfg);
    assert!(esc.space_id == object::id(space), EWrongSpace);
    assert!(period <= esc.weeks, EInvalidPeriod);
    assert!(!esc.periods.contains(period), EPeriodResolved);
    assert!(match_score_bps >= MIN_MATCH_BPS && object_match_bps >= MIN_MATCH_BPS, ELowMatch);
    let now = clock.timestamp_ms();
    if (period == 0) {
        assert!(esc.status == AWAITING_INSTALL, EBadStatus);
        assert!(now < install_deadline_ms(esc), EOutsideWindow);
        esc.status = LIVE;
    } else {
        assert!(esc.status == LIVE, EBadStatus);
        let (open, close) = period_window(esc, period);
        assert!(now >= open && now < close, EOutsideWindow);
    };
    let amount = next_tranche_amount(esc);
    esc.periods.add(period, PERIOD_ACCEPTED);
    esc.proofs.add(period, photo_blob_id);
    esc.resolved = esc.resolved + 1;
    esc.released = esc.released + amount;
    esc.dispute_until_ms = now + cure_ms(esc);
    asset::inc_proofs(space);
    event::emit(ProofAccepted { escrow_id: object::id(esc), space_id: esc.space_id, period, photo_blob_id, match_score_bps, object_match_bps });
    esc.escrow.split(amount)
}

/// Anyone can refund a period whose proof window (plus grace) passed without an accepted proof.
/// A missed install proof (period 0) refunds the whole escrow.
public fun refund_missed<C>(esc: &mut LeaseEscrow<C>, space: &mut AdSpace, period: u64, clock: &Clock, ctx: &mut TxContext) {
    assert!(esc.space_id == object::id(space), EWrongSpace);
    assert!(esc.status == AWAITING_INSTALL || esc.status == LIVE, EBadStatus);
    assert!(period <= esc.weeks, EInvalidPeriod);
    assert!(!esc.periods.contains(period), EPeriodResolved);
    let now = clock.timestamp_ms();
    if (period == 0) {
        assert!(esc.status == AWAITING_INSTALL, EBadStatus);
        assert!(now >= install_deadline_ms(esc), EDeadlineNotPassed);
        let amount = esc.escrow.value();
        pay(esc.escrow.withdraw_all(), esc.advertiser, ctx);
        esc.status = REFUNDED;
        esc.resolved = esc.tranches;
        asset::dec_active(space);
        event::emit(LeaseExpired { escrow_id: object::id(esc), space_id: esc.space_id, reason: 1, refunded: amount });
        return
    };
    let (_, close) = period_window(esc, period);
    assert!(now >= close, EDeadlineNotPassed);
    let amount = next_tranche_amount(esc);
    esc.periods.add(period, PERIOD_REFUNDED);
    esc.resolved = esc.resolved + 1;
    pay(esc.escrow.split(amount), esc.advertiser, ctx);
    event::emit(TrancheRefunded { escrow_id: object::id(esc), space_id: esc.space_id, period, amount });
    finish_if_done(esc, space);
}

// === Disputes ===

public fun open_dispute<C>(esc: &mut LeaseEscrow<C>, clock: &Clock, ctx: &TxContext) {
    assert!(ctx.sender() == esc.advertiser, ENotAdvertiser);
    assert!(esc.status == LIVE, EBadStatus);
    assert!(clock.timestamp_ms() <= esc.dispute_until_ms, EDisputeWindow);
    esc.status = DISPUTED;
    event::emit(DisputeOpened { escrow_id: object::id(esc), space_id: esc.space_id });
}

public fun resolve_dispute<C>(_: &AdminCap, esc: &mut LeaseEscrow<C>, space: &mut AdSpace, refund_remaining: bool, ctx: &mut TxContext) {
    assert!(esc.status == DISPUTED, EBadStatus);
    assert!(esc.space_id == object::id(space), EWrongSpace);
    let mut refunded = 0;
    if (refund_remaining) {
        refunded = esc.escrow.value();
        pay(esc.escrow.withdraw_all(), esc.advertiser, ctx);
        esc.resolved = esc.tranches;
        esc.status = REFUNDED;
        asset::dec_active(space);
    } else {
        esc.status = LIVE;
    };
    event::emit(DisputeResolved { escrow_id: object::id(esc), space_id: esc.space_id, refunded });
}

/// Moderation: refund whatever remains in escrow (e.g. after a takedown).
public fun admin_refund<C>(_: &AdminCap, esc: &mut LeaseEscrow<C>, space: &mut AdSpace, ctx: &mut TxContext) {
    assert!(esc.space_id == object::id(space), EWrongSpace);
    assert!(esc.status != COMPLETED && esc.status != CANCELLED && esc.status != REFUNDED, EBadStatus);
    let refunded = esc.escrow.value();
    pay(esc.escrow.withdraw_all(), esc.advertiser, ctx);
    esc.resolved = esc.tranches;
    esc.status = REFUNDED;
    asset::dec_active(space);
    event::emit(DisputeResolved { escrow_id: object::id(esc), space_id: esc.space_id, refunded });
}

// === Extension ===

public fun extend<C>(
    cfg: &Config,
    esc: &mut LeaseEscrow<C>,
    lease: &mut AdLease,
    space: &AdSpace,
    cal: &mut SpaceCalendar,
    pay_coin: Coin<C>,
    extra_weeks: u64,
    ctx: &TxContext,
) {
    admin::assert_active(cfg);
    admin::assert_payment<C>(cfg);
    assert!(ctx.sender() == esc.advertiser, ENotAdvertiser);
    assert!(lease.escrow_id == object::id(esc), EWrongLease);
    assert!(esc.status == AWAITING_INSTALL || esc.status == LIVE, EBadStatus);
    assert_links_ro(esc, space, cal);
    assert!(extra_weeks >= 1 && esc.weeks + extra_weeks <= MAX_WEEKS, EInvalidWeeks);
    let paid = asset::price_per_week(space) * extra_weeks;
    assert!(pay_coin.value() == paid, EWrongAmount);
    let first = esc.start_ms / esc.week_ms + esc.weeks;
    let mut i = 0;
    while (i < extra_weeks) {
        assert!(asset::is_week_free(cal, first + i), EWeekTaken);
        asset::book_week(cal, first + i, object::id(esc));
        i = i + 1;
    };
    esc.escrow.join(pay_coin.into_balance());
    esc.weeks = esc.weeks + extra_weeks;
    esc.tranches = esc.tranches + extra_weeks;
    esc.total_paid = esc.total_paid + paid;
    lease.weeks = esc.weeks;
    lease.total_paid = esc.total_paid;
    event::emit(LeaseExtended { escrow_id: object::id(esc), space_id: esc.space_id, extra_weeks, paid, new_end_ms: end_ms(esc) });
}

// === Internals ===

fun cancel_and_refund<C>(esc: &mut LeaseEscrow<C>, space: &mut AdSpace, cal: &mut SpaceCalendar, ctx: &mut TxContext): u64 {
    let first = esc.start_ms / esc.week_ms;
    let mut i = 0;
    while (i < esc.weeks) {
        asset::free_week(cal, first + i);
        i = i + 1;
    };
    let amount = esc.escrow.value();
    pay(esc.escrow.withdraw_all(), esc.advertiser, ctx);
    esc.status = CANCELLED;
    esc.resolved = esc.tranches;
    asset::dec_active(space);
    amount
}

fun finish_if_done<C>(esc: &mut LeaseEscrow<C>, space: &mut AdSpace) {
    if (esc.resolved == esc.tranches && esc.status == LIVE) {
        esc.status = COMPLETED;
        asset::dec_active(space);
        asset::inc_completed(space);
        event::emit(LeaseCompleted { escrow_id: object::id(esc), space_id: esc.space_id, released: esc.released });
    }
}

fun next_tranche_amount<C>(esc: &LeaseEscrow<C>): u64 {
    let outstanding = esc.tranches - esc.resolved;
    if (outstanding <= 1) esc.escrow.value() else esc.escrow.value() / outstanding
}

fun cure_ms<C>(esc: &LeaseEscrow<C>): u64 { esc.week_ms * 3 / 7 }

fun install_deadline_ms<C>(esc: &LeaseEscrow<C>): u64 { esc.start_ms + esc.week_ms }

fun period_window<C>(esc: &LeaseEscrow<C>, period: u64): (u64, u64) {
    let open = esc.start_ms + (period - 1) * esc.week_ms;
    let close = esc.start_ms + period * esc.week_ms + cure_ms(esc);
    (open, close)
}

fun end_ms<C>(esc: &LeaseEscrow<C>): u64 { esc.start_ms + esc.weeks * esc.week_ms }

fun assert_links<C>(esc: &LeaseEscrow<C>, space: &AdSpace, cal: &SpaceCalendar) {
    assert!(esc.space_id == object::id(space), EWrongSpace);
    assert!(esc.calendar_id == object::id(cal), EWrongCalendar);
}

fun assert_links_ro<C>(esc: &LeaseEscrow<C>, space: &AdSpace, cal: &SpaceCalendar) {
    assert!(esc.space_id == object::id(space), EWrongSpace);
    assert!(esc.calendar_id == object::id(cal), EWrongCalendar);
}

fun pay<C>(b: Balance<C>, to: address, ctx: &mut TxContext) {
    if (b.value() > 0) transfer::public_transfer(coin::from_balance(b, ctx), to)
    else b.destroy_zero();
}

// === Display ===

public fun setup_display(_: &AdminCap, registry: &mut DisplayRegistry, ctx: &mut TxContext) {
    let (mut d, cap) = display_registry::new<AdLease>(registry, internal::permit(), ctx);
    display_registry::set(&mut d, &cap, string::utf8(b"name"), string::utf8(b"brandmystuff lease {ens_label}: {brand}"));
    display_registry::set(&mut d, &cap, string::utf8(b"description"), string::utf8(b"Ad lease for {weeks} week(s)"));
    display_registry::set(&mut d, &cap, string::utf8(b"image_url"), string::utf8(b"https://aggregator.walrus-testnet.walrus.space/v1/blobs/{creative_blob_id}"));
    display_registry::set(&mut d, &cap, string::utf8(b"link"), string::utf8(b"{landing_url}"));
    display_registry::share(d);
    transfer::public_transfer(cap, ctx.sender());
}

// === Getters ===

public fun status<C>(esc: &LeaseEscrow<C>): u8 { esc.status }
public fun escrow_value<C>(esc: &LeaseEscrow<C>): u64 { esc.escrow.value() }
public fun released<C>(esc: &LeaseEscrow<C>): u64 { esc.released }
public fun resolved<C>(esc: &LeaseEscrow<C>): u64 { esc.resolved }
public fun tranches<C>(esc: &LeaseEscrow<C>): u64 { esc.tranches }
