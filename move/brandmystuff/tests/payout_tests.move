#[test_only]
module brandmystuff::payout_tests;

use sui::clock;
use sui::test_scenario as ts;
use brandmystuff::payout;

const HOLDER: address = @0xA;
const EVM: address = @0x9d54fb4a00000000000000000000000000006344;

#[test]
fun holder_sets_changes_and_clears_route() {
    let mut sc = ts::begin(HOLDER);
    let clk = clock::create_for_testing(sc.ctx());
    let mut reg = payout::new_for_testing(vector[0, 2, 3, 6], sc.ctx());
    payout::set_route(&mut reg, 6, EVM, &clk, sc.ctx());
    assert!(payout::has_route(&reg, HOLDER) && payout::route_domain(&reg, HOLDER) == 6 && payout::route_recipient(&reg, HOLDER) == EVM);
    payout::set_route(&mut reg, 3, EVM, &clk, sc.ctx());
    assert!(payout::route_domain(&reg, HOLDER) == 3);
    payout::clear_route(&mut reg, sc.ctx());
    assert!(!payout::has_route(&reg, HOLDER));
    payout::destroy_for_testing(reg);
    clk.destroy_for_testing();
    sc.end();
}

#[test, expected_failure(abort_code = payout::EDomainNotAllowed)]
fun unsupported_chain_is_rejected() {
    let mut sc = ts::begin(HOLDER);
    let clk = clock::create_for_testing(sc.ctx());
    let mut reg = payout::new_for_testing(vector[0, 2, 3, 6], sc.ctx());
    payout::set_route(&mut reg, 5, EVM, &clk, sc.ctx());
    abort 0
}

#[test, expected_failure(abort_code = payout::EZeroRecipient)]
fun zero_recipient_is_rejected() {
    let mut sc = ts::begin(HOLDER);
    let clk = clock::create_for_testing(sc.ctx());
    let mut reg = payout::new_for_testing(vector[0, 2, 3, 6], sc.ctx());
    payout::set_route(&mut reg, 6, @0x0, &clk, sc.ctx());
    abort 0
}
