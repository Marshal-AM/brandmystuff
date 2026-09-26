/// Budget mandates for brand agents.
///
/// A brand funds a BudgetMandate with a coin (test USDC on testnet) and names the one agent
/// key allowed to spend it. The agent can only pay the named payee (the brandmystuff x402
/// payTo address), never more than the per-payment cap, never past the expiry, and never
/// more than the brand authorised in total. The brand can top up, change the caps, pause,
/// or revoke and take back whatever is left, at any time.
module brandmystuff_mandate::mandate;

use sui::balance::Balance;
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;

#[error]
const ENotBrand: vector<u8> = b"Only the brand that created this mandate can do this";
#[error]
const ENotAgent: vector<u8> = b"Only the mandate's agent can spend from it";
#[error]
const EInactive: vector<u8> = b"This mandate is paused or revoked";
#[error]
const EExpired: vector<u8> = b"This mandate has expired";
#[error]
const EOverCap: vector<u8> = b"Payment is above the mandate's per-payment cap";
#[error]
const EOverBudget: vector<u8> = b"Payment would exceed the mandate's total budget";
#[error]
const EZero: vector<u8> = b"Amount must be greater than zero";
#[error]
const EBadExpiry: vector<u8> = b"Expiry must be in the future";

/// One per brand agent. Shared so both the brand and the agent can act on it.
public struct BudgetMandate<phantom C> has key {
    id: UID,
    /// The brand (owner): funds, tops up, edits caps, pauses, revokes.
    brand: address,
    /// The only key that may spend.
    agent: address,
    /// The only address payments may go to (the x402 payTo).
    payee: address,
    funds: Balance<C>,
    /// Total ever authorised (initial funding + top-ups).
    budget: u64,
    /// Total already spent by the agent.
    spent: u64,
    per_payment_cap: u64,
    expires_ms: u64,
    active: bool,
    payments: u64,
}

public struct MandateCreated has copy, drop { mandate_id: ID, brand: address, agent: address, payee: address, budget: u64, per_payment_cap: u64, expires_ms: u64 }
public struct MandateSpent has copy, drop { mandate_id: ID, agent: address, payee: address, amount: u64, spent: u64, remaining: u64, memo: vector<u8> }
public struct MandateToppedUp has copy, drop { mandate_id: ID, amount: u64, budget: u64 }
public struct MandateUpdated has copy, drop { mandate_id: ID, per_payment_cap: u64, expires_ms: u64, active: bool }
public struct MandateRevoked has copy, drop { mandate_id: ID, returned: u64 }

/// Creates and shares a mandate funded with `funds`. The sender is the brand.
public fun create<C>(funds: Coin<C>, agent: address, payee: address, per_payment_cap: u64, expires_ms: u64, clock: &Clock, ctx: &mut TxContext): ID {
    let amount = funds.value();
    assert!(amount > 0 && per_payment_cap > 0, EZero);
    assert!(expires_ms > clock.timestamp_ms(), EBadExpiry);
    let m = BudgetMandate<C> {
        id: object::new(ctx),
        brand: ctx.sender(),
        agent,
        payee,
        funds: funds.into_balance(),
        budget: amount,
        spent: 0,
        per_payment_cap,
        expires_ms,
        active: true,
        payments: 0,
    };
    let id = object::id(&m);
    event::emit(MandateCreated { mandate_id: id, brand: ctx.sender(), agent, payee, budget: amount, per_payment_cap, expires_ms });
    transfer::share_object(m);
    id
}

/// The agent pays `amount` to the mandate's payee. Every limit is enforced here, on-chain.
public fun spend<C>(m: &mut BudgetMandate<C>, amount: u64, memo: vector<u8>, clock: &Clock, ctx: &mut TxContext) {
    assert!(ctx.sender() == m.agent, ENotAgent);
    assert!(m.active, EInactive);
    assert!(clock.timestamp_ms() < m.expires_ms, EExpired);
    assert!(amount > 0, EZero);
    assert!(amount <= m.per_payment_cap, EOverCap);
    assert!(m.spent + amount <= m.budget && amount <= m.funds.value(), EOverBudget);
    m.spent = m.spent + amount;
    m.payments = m.payments + 1;
    let pay = coin::from_balance(m.funds.split(amount), ctx);
    transfer::public_transfer(pay, m.payee);
    event::emit(MandateSpent { mandate_id: object::id(m), agent: m.agent, payee: m.payee, amount, spent: m.spent, remaining: m.funds.value(), memo });
}

/// Refunds (e.g. a failed booking) can be returned into the mandate by anyone.
public fun refund<C>(m: &mut BudgetMandate<C>, coin: Coin<C>) {
    let amount = coin.value();
    m.funds.join(coin.into_balance());
    m.spent = if (amount > m.spent) 0 else m.spent - amount;
}

public fun top_up<C>(m: &mut BudgetMandate<C>, coin: Coin<C>, ctx: &TxContext) {
    assert!(ctx.sender() == m.brand, ENotBrand);
    let amount = coin.value();
    assert!(amount > 0, EZero);
    m.funds.join(coin.into_balance());
    m.budget = m.budget + amount;
    event::emit(MandateToppedUp { mandate_id: object::id(m), amount, budget: m.budget });
}

public fun update<C>(m: &mut BudgetMandate<C>, per_payment_cap: u64, expires_ms: u64, active: bool, ctx: &TxContext) {
    assert!(ctx.sender() == m.brand, ENotBrand);
    assert!(per_payment_cap > 0, EZero);
    m.per_payment_cap = per_payment_cap;
    m.expires_ms = expires_ms;
    m.active = active;
    event::emit(MandateUpdated { mandate_id: object::id(m), per_payment_cap, expires_ms, active });
}

/// Stops the agent for good and returns every unspent coin to the brand.
public fun revoke<C>(m: &mut BudgetMandate<C>, ctx: &mut TxContext) {
    assert!(ctx.sender() == m.brand, ENotBrand);
    m.active = false;
    let left = m.funds.value();
    if (left > 0) transfer::public_transfer(coin::from_balance(m.funds.split(left), ctx), m.brand);
    event::emit(MandateRevoked { mandate_id: object::id(m), returned: left });
}

// ---- reads ----
public fun remaining<C>(m: &BudgetMandate<C>): u64 { m.funds.value() }
public fun spent<C>(m: &BudgetMandate<C>): u64 { m.spent }
public fun budget<C>(m: &BudgetMandate<C>): u64 { m.budget }
public fun agent<C>(m: &BudgetMandate<C>): address { m.agent }
public fun brand<C>(m: &BudgetMandate<C>): address { m.brand }
public fun payee<C>(m: &BudgetMandate<C>): address { m.payee }
public fun per_payment_cap<C>(m: &BudgetMandate<C>): u64 { m.per_payment_cap }
public fun expires_ms<C>(m: &BudgetMandate<C>): u64 { m.expires_ms }
public fun is_active<C>(m: &BudgetMandate<C>): bool { m.active }

#[test_only]
public fun destroy_for_testing<C>(m: BudgetMandate<C>) {
    let BudgetMandate { id, funds, .. } = m;
    sui::balance::destroy_for_testing(funds);
    id.delete();
}
