#[test_only]
module brandmystuff_mandate::mandate_tests;

use sui::clock;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::test_scenario as ts;
use brandmystuff_mandate::mandate::{Self, BudgetMandate};

const BRAND: address = @0xB;
const AGENT: address = @0xA;
const PAYEE: address = @0xC;
const OTHER: address = @0xD;

fun setup(sc: &mut ts::Scenario, budget: u64, cap: u64): clock::Clock {
    let mut clk = clock::create_for_testing(sc.ctx());
    clk.set_for_testing(1_000);
    let funds = coin::mint_for_testing<SUI>(budget, sc.ctx());
    mandate::create(funds, AGENT, PAYEE, cap, 100_000, &clk, sc.ctx());
    clk
}

#[test]
fun agent_spends_within_limits() {
    let mut sc = ts::begin(BRAND);
    let clk = setup(&mut sc, 1_000, 400);
    sc.next_tx(AGENT);
    let mut m = sc.take_shared<BudgetMandate<SUI>>();
    mandate::spend(&mut m, 300, b"lease", &clk, sc.ctx());
    assert!(mandate::spent(&m) == 300 && mandate::remaining(&m) == 700);
    ts::return_shared(m);
    sc.next_tx(PAYEE);
    let paid = sc.take_from_address<Coin<SUI>>(PAYEE);
    assert!(paid.value() == 300);
    ts::return_to_address(PAYEE, paid);
    clk.destroy_for_testing();
    sc.end();
}

#[test, expected_failure(abort_code = mandate::ENotAgent)]
fun others_cannot_spend() {
    let mut sc = ts::begin(BRAND);
    let clk = setup(&mut sc, 1_000, 400);
    sc.next_tx(OTHER);
    let mut m = sc.take_shared<BudgetMandate<SUI>>();
    mandate::spend(&mut m, 100, b"", &clk, sc.ctx());
    abort 0
}

#[test, expected_failure(abort_code = mandate::EOverCap)]
fun per_payment_cap_is_enforced() {
    let mut sc = ts::begin(BRAND);
    let clk = setup(&mut sc, 1_000, 400);
    sc.next_tx(AGENT);
    let mut m = sc.take_shared<BudgetMandate<SUI>>();
    mandate::spend(&mut m, 401, b"", &clk, sc.ctx());
    abort 0
}

#[test, expected_failure(abort_code = mandate::EOverBudget)]
fun total_budget_is_enforced() {
    let mut sc = ts::begin(BRAND);
    let clk = setup(&mut sc, 500, 400);
    sc.next_tx(AGENT);
    let mut m = sc.take_shared<BudgetMandate<SUI>>();
    mandate::spend(&mut m, 400, b"", &clk, sc.ctx());
    mandate::spend(&mut m, 200, b"", &clk, sc.ctx());
    abort 0
}

#[test, expected_failure(abort_code = mandate::EExpired)]
fun expired_mandate_cannot_spend() {
    let mut sc = ts::begin(BRAND);
    let mut clk = setup(&mut sc, 1_000, 400);
    clk.set_for_testing(200_000);
    sc.next_tx(AGENT);
    let mut m = sc.take_shared<BudgetMandate<SUI>>();
    mandate::spend(&mut m, 100, b"", &clk, sc.ctx());
    abort 0
}

#[test, expected_failure(abort_code = mandate::EInactive)]
fun paused_mandate_cannot_spend() {
    let mut sc = ts::begin(BRAND);
    let clk = setup(&mut sc, 1_000, 400);
    sc.next_tx(BRAND);
    let mut m = sc.take_shared<BudgetMandate<SUI>>();
    mandate::update(&mut m, 400, 100_000, false, sc.ctx());
    ts::return_shared(m);
    sc.next_tx(AGENT);
    let mut m = sc.take_shared<BudgetMandate<SUI>>();
    mandate::spend(&mut m, 100, b"", &clk, sc.ctx());
    abort 0
}

#[test]
fun revoke_returns_funds_to_brand() {
    let mut sc = ts::begin(BRAND);
    let clk = setup(&mut sc, 1_000, 400);
    sc.next_tx(AGENT);
    let mut m = sc.take_shared<BudgetMandate<SUI>>();
    mandate::spend(&mut m, 250, b"", &clk, sc.ctx());
    ts::return_shared(m);
    sc.next_tx(BRAND);
    let mut m = sc.take_shared<BudgetMandate<SUI>>();
    mandate::revoke(&mut m, sc.ctx());
    assert!(!mandate::is_active(&m) && mandate::remaining(&m) == 0);
    ts::return_shared(m);
    sc.next_tx(BRAND);
    let back = sc.take_from_address<Coin<SUI>>(BRAND);
    assert!(back.value() == 750);
    ts::return_to_address(BRAND, back);
    clk.destroy_for_testing();
    sc.end();
}

#[test, expected_failure(abort_code = mandate::ENotBrand)]
fun only_brand_can_top_up_or_revoke() {
    let mut sc = ts::begin(BRAND);
    let _clk = setup(&mut sc, 1_000, 400);
    sc.next_tx(AGENT);
    let mut m = sc.take_shared<BudgetMandate<SUI>>();
    mandate::revoke(&mut m, sc.ctx());
    abort 0
}
