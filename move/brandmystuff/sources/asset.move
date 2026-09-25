/// Physical objects, their ad spaces (the listings) and each space's booking calendar.
module brandmystuff::asset;

use std::internal;
use std::string::{Self, String};
use sui::clock::Clock;
use sui::display_registry::{Self, DisplayRegistry};
use sui::event;
use sui::table::{Self, Table};
use brandmystuff::admin::{Self, AdminCap, Config, OperatorCap};

// Object status
const OBJ_LIVE: u8 = 1;
const OBJ_PAUSED: u8 = 2;

// Space status
const SPACE_SCORING: u8 = 0;
const SPACE_AVAILABLE: u8 = 1;
const SPACE_PAUSED: u8 = 2;
const SPACE_RETIRED: u8 = 3;
const SPACE_REMOVED: u8 = 4;

const MAX_SPACES: u64 = 20;

#[error]
const ENotOwner: vector<u8> = b"Only the owner can do this";
#[error]
const ETooManySpaces: vector<u8> = b"An object can have at most 20 spaces";
#[error]
const EInvalidDims: vector<u8> = b"Space dimensions must be positive";
#[error]
const EInvalidPrice: vector<u8> = b"Price must be positive";
#[error]
const EInvalidScore: vector<u8> = b"Score out of range";
#[error]
const EBadStatus: vector<u8> = b"Space status does not allow this action";
#[error]
const EHasActiveLeases: vector<u8> = b"Space has active leases";
#[error]
const EHasOffering: vector<u8> = b"Space is tokenised";
#[error]
const EWrongObject: vector<u8> = b"Space does not belong to this object";

public struct ListedObject has key {
    id: UID,
    owner: address,
    category: u16,
    title: String,
    city: String,
    ens_name: String,
    ens_namehash: vector<u8>,
    hero_blob_id: String,
    manifest_blob_id: String,
    object_aqs: u8,
    object_grade: u8,
    sponsored_until_ms: u64,
    status: u8,
    spaces: vector<ID>,
    created_ms: u64,
}

public struct AdSpace has key {
    id: UID,
    object_id: ID,
    owner: address,
    category: u16,
    label: String,
    ens_name: String,
    ens_namehash: vector<u8>,
    width_mm: u32,
    height_mm: u32,
    placement: u8,
    closeup_blob_id: String,
    aqs: u8,
    /// 0 none, 1 C, 2 B, 3 A, 4 A+
    grade: u8,
    confidence_bps: u16,
    rank_score_x100: u32,
    rubric_version: String,
    score_report_blob_id: String,
    score_report_hash: vector<u8>,
    scored_at_ms: u64,
    price_per_week: u64,
    calendar_id: ID,
    offering_id: Option<ID>,
    status: u8,
    active_leases: u32,
    completed_leases: u32,
    accepted_proofs: u32,
    created_ms: u64,
}

public struct SpaceCalendar has key {
    id: UID,
    space_id: ID,
    week_ms: u64,
    /// week index (timestamp / week_ms) -> escrow id
    booked: Table<u64, ID>,
}

// === Events ===

public struct ObjectCreated has copy, drop {
    object_id: ID,
    owner: address,
    category: u16,
    title: String,
    city: String,
    ens_name: String,
    ens_namehash: vector<u8>,
    hero_blob_id: String,
}

public struct ObjectScored has copy, drop { object_id: ID, aqs: u8, grade: u8 }

public struct SpaceAdded has copy, drop {
    space_id: ID,
    object_id: ID,
    calendar_id: ID,
    owner: address,
    label: String,
    ens_name: String,
    ens_namehash: vector<u8>,
    width_mm: u32,
    height_mm: u32,
    placement: u8,
    closeup_blob_id: String,
    price_per_week: u64,
    week_ms: u64,
}

public struct SpaceScored has copy, drop {
    space_id: ID,
    aqs: u8,
    grade: u8,
    confidence_bps: u16,
    rank_score_x100: u32,
    rubric_version: String,
    score_report_blob_id: String,
    score_report_hash: vector<u8>,
}

public struct PriceChanged has copy, drop { space_id: ID, price_per_week: u64 }

public struct SpaceStatusChanged has copy, drop { space_id: ID, status: u8 }

// === Owner functions ===

public fun create_object(
    cfg: &Config,
    category: u16,
    title: String,
    city: String,
    ens_name: String,
    ens_namehash: vector<u8>,
    hero_blob_id: String,
    manifest_blob_id: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    admin::assert_active(cfg);
    let obj = ListedObject {
        id: object::new(ctx),
        owner: ctx.sender(),
        category,
        title,
        city,
        ens_name,
        ens_namehash,
        hero_blob_id,
        manifest_blob_id,
        object_aqs: 0,
        object_grade: 0,
        sponsored_until_ms: 0,
        status: OBJ_LIVE,
        spaces: vector[],
        created_ms: clock.timestamp_ms(),
    };
    event::emit(ObjectCreated {
        object_id: object::id(&obj),
        owner: obj.owner,
        category,
        title: obj.title,
        city: obj.city,
        ens_name: obj.ens_name,
        ens_namehash: obj.ens_namehash,
        hero_blob_id: obj.hero_blob_id,
    });
    transfer::share_object(obj);
}

/// Adds a space that already passed the off-chain AI analysis. It stays in SCORING until the
/// operator writes the score with `apply_score`, which lists it.
public fun add_space(
    cfg: &Config,
    obj: &mut ListedObject,
    label: String,
    ens_name: String,
    ens_namehash: vector<u8>,
    width_mm: u32,
    height_mm: u32,
    placement: u8,
    closeup_blob_id: String,
    price_per_week: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    admin::assert_active(cfg);
    assert!(ctx.sender() == obj.owner, ENotOwner);
    assert!(obj.spaces.length() < MAX_SPACES, ETooManySpaces);
    assert!(width_mm > 0 && height_mm > 0, EInvalidDims);
    assert!(price_per_week > 0, EInvalidPrice);

    let space_uid = object::new(ctx);
    let space_id = space_uid.to_inner();
    let calendar = SpaceCalendar {
        id: object::new(ctx),
        space_id,
        week_ms: admin::week_ms(cfg),
        booked: table::new(ctx),
    };
    let calendar_id = object::id(&calendar);
    let space = AdSpace {
        id: space_uid,
        object_id: object::id(obj),
        owner: obj.owner,
        category: obj.category,
        label,
        ens_name,
        ens_namehash,
        width_mm,
        height_mm,
        placement,
        closeup_blob_id,
        aqs: 0,
        grade: 0,
        confidence_bps: 0,
        rank_score_x100: 0,
        rubric_version: string::utf8(b""),
        score_report_blob_id: string::utf8(b""),
        score_report_hash: vector[],
        scored_at_ms: 0,
        price_per_week,
        calendar_id,
        offering_id: option::none(),
        status: SPACE_SCORING,
        active_leases: 0,
        completed_leases: 0,
        accepted_proofs: 0,
        created_ms: clock.timestamp_ms(),
    };
    obj.spaces.push_back(space_id);
    event::emit(SpaceAdded {
        space_id,
        object_id: object::id(obj),
        calendar_id,
        owner: obj.owner,
        label: space.label,
        ens_name: space.ens_name,
        ens_namehash: space.ens_namehash,
        width_mm,
        height_mm,
        placement,
        closeup_blob_id: space.closeup_blob_id,
        price_per_week,
        week_ms: calendar.week_ms,
    });
    transfer::share_object(space);
    transfer::share_object(calendar);
}

public fun set_price(space: &mut AdSpace, price_per_week: u64, ctx: &TxContext) {
    assert!(ctx.sender() == space.owner, ENotOwner);
    assert!(price_per_week > 0, EInvalidPrice);
    space.price_per_week = price_per_week;
    event::emit(PriceChanged { space_id: object::id(space), price_per_week });
}

public fun pause_space(space: &mut AdSpace, ctx: &TxContext) {
    assert!(ctx.sender() == space.owner, ENotOwner);
    assert!(space.status == SPACE_AVAILABLE, EBadStatus);
    set_status(space, SPACE_PAUSED);
}

public fun unpause_space(space: &mut AdSpace, ctx: &TxContext) {
    assert!(ctx.sender() == space.owner, ENotOwner);
    assert!(space.status == SPACE_PAUSED, EBadStatus);
    set_status(space, SPACE_AVAILABLE);
}

public fun retire_space(space: &mut AdSpace, ctx: &TxContext) {
    assert!(ctx.sender() == space.owner, ENotOwner);
    assert!(space.status != SPACE_REMOVED && space.status != SPACE_RETIRED, EBadStatus);
    assert!(space.active_leases == 0, EHasActiveLeases);
    assert!(space.offering_id.is_none(), EHasOffering);
    set_status(space, SPACE_RETIRED);
}

public fun set_object_paused(obj: &mut ListedObject, paused: bool, ctx: &TxContext) {
    assert!(ctx.sender() == obj.owner, ENotOwner);
    obj.status = if (paused) OBJ_PAUSED else OBJ_LIVE;
}

// === Operator / admin ===

public fun apply_score(
    _: &OperatorCap,
    cfg: &Config,
    space: &mut AdSpace,
    aqs: u8,
    grade: u8,
    confidence_bps: u16,
    rank_score_x100: u32,
    rubric_version: String,
    score_report_blob_id: String,
    score_report_hash: vector<u8>,
    clock: &Clock,
) {
    admin::assert_version(cfg);
    assert!(aqs <= 100 && grade <= 4 && confidence_bps <= 10_000, EInvalidScore);
    assert!(space.status != SPACE_REMOVED && space.status != SPACE_RETIRED, EBadStatus);
    space.aqs = aqs;
    space.grade = grade;
    space.confidence_bps = confidence_bps;
    space.rank_score_x100 = rank_score_x100;
    space.rubric_version = rubric_version;
    space.score_report_blob_id = score_report_blob_id;
    space.score_report_hash = score_report_hash;
    space.scored_at_ms = clock.timestamp_ms();
    event::emit(SpaceScored {
        space_id: object::id(space),
        aqs,
        grade,
        confidence_bps,
        rank_score_x100,
        rubric_version: space.rubric_version,
        score_report_blob_id: space.score_report_blob_id,
        score_report_hash: space.score_report_hash,
    });
    if (space.status == SPACE_SCORING) set_status(space, SPACE_AVAILABLE);
}

public fun set_object_score(_: &OperatorCap, obj: &mut ListedObject, aqs: u8, grade: u8) {
    assert!(aqs <= 100 && grade <= 4, EInvalidScore);
    obj.object_aqs = aqs;
    obj.object_grade = grade;
    event::emit(ObjectScored { object_id: object::id(obj), aqs, grade });
}

/// Moderation takedown. Active lease escrows are refunded separately with `lease::admin_refund`.
public fun takedown(_: &AdminCap, space: &mut AdSpace) {
    set_status(space, SPACE_REMOVED);
}

fun set_status(space: &mut AdSpace, status: u8) {
    space.status = status;
    event::emit(SpaceStatusChanged { space_id: object::id(space), status });
}

// === Display ===

public fun setup_display(_: &AdminCap, registry: &mut DisplayRegistry, ctx: &mut TxContext) {
    let (mut d, cap) = display_registry::new<AdSpace>(registry, internal::permit(), ctx);
    display_registry::set(&mut d, &cap, string::utf8(b"name"), string::utf8(b"{ens_name}"));
    display_registry::set(&mut d, &cap, string::utf8(b"description"), string::utf8(b"brandmystuff ad space {label}: {width_mm}x{height_mm} mm, AQS {aqs}"));
    display_registry::set(&mut d, &cap, string::utf8(b"image_url"), string::utf8(b"https://aggregator.walrus-testnet.walrus.space/v1/blobs/{closeup_blob_id}"));
    display_registry::set(&mut d, &cap, string::utf8(b"link"), string::utf8(b"http://localhost:3000/{ens_name}"));
    display_registry::share(d);
    transfer::public_transfer(cap, ctx.sender());

    let (mut o, ocap) = display_registry::new<ListedObject>(registry, internal::permit(), ctx);
    display_registry::set(&mut o, &ocap, string::utf8(b"name"), string::utf8(b"{title}"));
    display_registry::set(&mut o, &ocap, string::utf8(b"description"), string::utf8(b"brandmystuff object {ens_name}"));
    display_registry::set(&mut o, &ocap, string::utf8(b"image_url"), string::utf8(b"https://aggregator.walrus-testnet.walrus.space/v1/blobs/{hero_blob_id}"));
    display_registry::set(&mut o, &ocap, string::utf8(b"link"), string::utf8(b"http://localhost:3000/{ens_name}"));
    display_registry::share(o);
    transfer::public_transfer(ocap, ctx.sender());
}

// === Package-internal accessors ===

public(package) fun space_owner(s: &AdSpace): address { s.owner }
public(package) fun is_available(s: &AdSpace): bool { s.status == SPACE_AVAILABLE }
public(package) fun is_listed(s: &AdSpace): bool { s.status == SPACE_AVAILABLE || s.status == SPACE_PAUSED }
public(package) fun price_per_week(s: &AdSpace): u64 { s.price_per_week }
public(package) fun calendar_id(s: &AdSpace): ID { s.calendar_id }
public(package) fun set_offering(s: &mut AdSpace, id: Option<ID>) { s.offering_id = id; }
public(package) fun inc_active(s: &mut AdSpace) { s.active_leases = s.active_leases + 1; }
public(package) fun dec_active(s: &mut AdSpace) { if (s.active_leases > 0) s.active_leases = s.active_leases - 1; }
public(package) fun inc_completed(s: &mut AdSpace) { s.completed_leases = s.completed_leases + 1; }
public(package) fun inc_proofs(s: &mut AdSpace) { s.accepted_proofs = s.accepted_proofs + 1; }
public(package) fun set_sponsored_until(o: &mut ListedObject, until_ms: u64) { o.sponsored_until_ms = until_ms; }
public(package) fun object_owner(o: &ListedObject): address { o.owner }
public(package) fun object_is_live(o: &ListedObject): bool { o.status == OBJ_LIVE }
public(package) fun object_space_count(o: &ListedObject): u64 { o.spaces.length() }

public(package) fun assert_space_of(obj: &ListedObject, space: &AdSpace) {
    assert!(space.object_id == object::id(obj), EWrongObject);
}

public(package) fun calendar_space(c: &SpaceCalendar): ID { c.space_id }
public(package) fun calendar_week_ms(c: &SpaceCalendar): u64 { c.week_ms }
public(package) fun is_week_free(c: &SpaceCalendar, week: u64): bool { !c.booked.contains(week) }

public(package) fun book_week(c: &mut SpaceCalendar, week: u64, escrow_id: ID) {
    c.booked.add(week, escrow_id);
}

public(package) fun free_week(c: &mut SpaceCalendar, week: u64) {
    if (c.booked.contains(week)) {
        c.booked.remove(week);
    };
}

// === Public getters ===

public fun object_id_of(s: &AdSpace): ID { s.object_id }
public fun owner(s: &AdSpace): address { s.owner }
public fun grade(s: &AdSpace): u8 { s.grade }
public fun aqs(s: &AdSpace): u8 { s.aqs }
public fun status(s: &AdSpace): u8 { s.status }
public fun offering_id(s: &AdSpace): Option<ID> { s.offering_id }
public fun completed_leases(s: &AdSpace): u32 { s.completed_leases }
public fun accepted_proofs(s: &AdSpace): u32 { s.accepted_proofs }
public fun active_leases(s: &AdSpace): u32 { s.active_leases }
public fun ens_name(s: &AdSpace): String { s.ens_name }
public fun sponsored_until_ms(o: &ListedObject): u64 { o.sponsored_until_ms }
