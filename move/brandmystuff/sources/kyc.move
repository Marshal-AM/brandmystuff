/// Investor verification registry (the ERC-3643 identity-registry equivalent).
/// v1 is fed by a mock verification flow; a real provider would call the same functions.
module brandmystuff::kyc;

use sui::clock::Clock;
use sui::event;
use sui::table::{Self, Table};
use brandmystuff::admin::{AdminCap, OperatorCap};

#[error]
const ENotVerified: vector<u8> = b"Address is not a verified investor";
#[error]
const EFrozen: vector<u8> = b"Investor is frozen";
#[error]
const EExpired: vector<u8> = b"Investor verification has expired";
#[error]
const EUnknown: vector<u8> = b"No verification record for this address";

public struct KycRecord has store, drop {
    verified: bool,
    /// 1 accredited, 2 non-US, 3 retail (self-certified; display only).
    investor_type: u8,
    country: vector<u8>,
    expires_ms: u64,
    frozen: bool,
    ref_hash: vector<u8>,
}

public struct KycRegistry has key {
    id: UID,
    records: Table<address, KycRecord>,
}

public struct InvestorVerified has copy, drop {
    investor: address,
    investor_type: u8,
    country: vector<u8>,
    expires_ms: u64,
}

public struct InvestorFrozen has copy, drop { investor: address, frozen: bool }

fun init(ctx: &mut TxContext) {
    transfer::share_object(KycRegistry { id: object::new(ctx), records: table::new(ctx) });
}

public fun set_record(
    _: &OperatorCap,
    reg: &mut KycRegistry,
    who: address,
    investor_type: u8,
    country: vector<u8>,
    expires_ms: u64,
    ref_hash: vector<u8>,
) {
    if (reg.records.contains(who)) {
        reg.records.remove(who);
    };
    reg.records.add(who, KycRecord { verified: true, investor_type, country, expires_ms, frozen: false, ref_hash });
    event::emit(InvestorVerified { investor: who, investor_type, country, expires_ms });
}

public fun set_frozen(_: &AdminCap, reg: &mut KycRegistry, who: address, frozen: bool) {
    assert!(reg.records.contains(who), EUnknown);
    reg.records.borrow_mut(who).frozen = frozen;
    event::emit(InvestorFrozen { investor: who, frozen });
}

public fun is_verified(reg: &KycRegistry, who: address, clock: &Clock): bool {
    if (!reg.records.contains(who)) return false;
    let r = reg.records.borrow(who);
    r.verified && !r.frozen && r.expires_ms > clock.timestamp_ms()
}

public fun assert_verified(reg: &KycRegistry, who: address, clock: &Clock) {
    assert!(reg.records.contains(who), ENotVerified);
    let r = reg.records.borrow(who);
    assert!(r.verified, ENotVerified);
    assert!(!r.frozen, EFrozen);
    assert!(r.expires_ms > clock.timestamp_ms(), EExpired);
}
