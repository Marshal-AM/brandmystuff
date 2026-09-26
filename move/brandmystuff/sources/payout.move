/// Cross-chain payouts (package v3).
///
/// A holder registers, with their own signature, where they want their revenue share paid:
/// a Circle CCTP destination domain and an EVM address. For holders with a route, the
/// operator can release their claimable revenue into the payout transaction itself, where it
/// is burned through Circle CCTP to exactly that registered address. The same transaction
/// emits `PayoutReleased` and CCTP's `DepositForBurn`, so every payout is publicly auditable.
/// Holders without a route keep claiming on Sui as before.
///
/// CCTP is called from the transaction (not from Move) on purpose: Sui is on CCTP V1 today and
/// moves to V2 soon, so the bridge stays a swappable adapter instead of a hard package dependency.
module brandmystuff::payout;

use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;
use sui::table::{Self, Table};
use brandmystuff::admin::{AdminCap, OperatorCap};
use brandmystuff::offering::{Self, SpaceOffering};

#[error]
const ENoRoute: vector<u8> = b"This holder has no cross-chain payout route";
#[error]
const EDomainNotAllowed: vector<u8> = b"Payouts to this chain are not enabled";
#[error]
const EZeroRecipient: vector<u8> = b"Recipient address must not be zero";
#[error]
const ENothingToRelease: vector<u8> = b"Nothing to pay out yet";

public struct Route has store, copy, drop {
    /// Circle CCTP destination domain (0 Ethereum, 2 OP, 3 Arbitrum, 6 Base).
    domain: u32,
    /// EVM address, left-padded to 32 bytes (CCTP mint recipient format).
    recipient: address,
    updated_ms: u64,
}

public struct PayoutRegistry has key {
    id: UID,
    routes: Table<address, Route>,
    allowed_domains: vector<u32>,
    released_total: u64,
    payouts: u64,
}

public struct RegistryCreated has copy, drop { registry_id: ID, allowed_domains: vector<u32> }
public struct RouteSet has copy, drop { holder: address, domain: u32, recipient: address }
public struct RouteCleared has copy, drop { holder: address }
public struct PayoutReleased has copy, drop { offering_id: ID, holder: address, amount: u64, domain: u32, recipient: address }

/// One-time setup (new modules don't get `init` in an upgrade).
public fun create_registry(_: &AdminCap, allowed_domains: vector<u32>, ctx: &mut TxContext) {
    let reg = PayoutRegistry { id: object::new(ctx), routes: table::new(ctx), allowed_domains, released_total: 0, payouts: 0 };
    event::emit(RegistryCreated { registry_id: object::id(&reg), allowed_domains });
    transfer::share_object(reg);
}

public fun set_allowed_domains(_: &AdminCap, reg: &mut PayoutRegistry, domains: vector<u32>) {
    reg.allowed_domains = domains;
}

/// The holder chooses (or changes) where their revenue is paid. Signed by the holder.
public fun set_route(reg: &mut PayoutRegistry, domain: u32, recipient: address, clock: &Clock, ctx: &TxContext) {
    assert!(reg.allowed_domains.contains(&domain), EDomainNotAllowed);
    assert!(recipient != @0x0, EZeroRecipient);
    let holder = ctx.sender();
    let r = Route { domain, recipient, updated_ms: clock.timestamp_ms() };
    if (reg.routes.contains(holder)) *reg.routes.borrow_mut(holder) = r else reg.routes.add(holder, r);
    event::emit(RouteSet { holder, domain, recipient });
}

/// Back to claiming on Sui. Signed by the holder.
public fun clear_route(reg: &mut PayoutRegistry, ctx: &TxContext) {
    let holder = ctx.sender();
    if (reg.routes.contains(holder)) {
        reg.routes.remove(holder);
        event::emit(RouteCleared { holder });
    }
}

/// Operator: releases a routed holder's claimable revenue into this transaction, to be burned
/// via CCTP to the holder's registered recipient in the same transaction.
public fun release_routed<C>(
    _: &OperatorCap,
    reg: &mut PayoutRegistry,
    o: &mut SpaceOffering<C>,
    holder: address,
    ctx: &mut TxContext,
): Coin<C> {
    assert!(reg.routes.contains(holder), ENoRoute);
    let route = *reg.routes.borrow(holder);
    let bal = offering::take_claimable(o, holder);
    let amount = bal.value();
    assert!(amount > 0, ENothingToRelease);
    reg.released_total = reg.released_total + amount;
    reg.payouts = reg.payouts + 1;
    event::emit(PayoutReleased { offering_id: object::id(o), holder, amount, domain: route.domain, recipient: route.recipient });
    coin::from_balance(bal, ctx)
}

// ---- reads ----
public fun has_route(reg: &PayoutRegistry, holder: address): bool { reg.routes.contains(holder) }
public fun route_domain(reg: &PayoutRegistry, holder: address): u32 { reg.routes.borrow(holder).domain }
public fun route_recipient(reg: &PayoutRegistry, holder: address): address { reg.routes.borrow(holder).recipient }
public fun released_total(reg: &PayoutRegistry): u64 { reg.released_total }

#[test_only]
public fun new_for_testing(allowed_domains: vector<u32>, ctx: &mut TxContext): PayoutRegistry {
    PayoutRegistry { id: object::new(ctx), routes: table::new(ctx), allowed_domains, released_total: 0, payouts: 0 }
}

#[test_only]
public fun destroy_for_testing(reg: PayoutRegistry) {
    let PayoutRegistry { id, routes, .. } = reg;
    routes.drop();
    id.delete();
}
