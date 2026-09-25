/// User profile, linking a Sui address to its ENS name.
module brandmystuff::profile;

use std::string::String;
use sui::event;

public struct Profile has key {
    id: UID,
    owner: address,
    ens_name: String,
    ens_namehash: vector<u8>,
    created_ms: u64,
}

public struct ProfileCreated has copy, drop {
    profile_id: ID,
    owner: address,
    ens_name: String,
    ens_namehash: vector<u8>,
}

public fun create(ens_name: String, ens_namehash: vector<u8>, clock: &sui::clock::Clock, ctx: &mut TxContext) {
    let profile = Profile {
        id: object::new(ctx),
        owner: ctx.sender(),
        ens_name,
        ens_namehash,
        created_ms: clock.timestamp_ms(),
    };
    event::emit(ProfileCreated {
        profile_id: object::id(&profile),
        owner: profile.owner,
        ens_name: profile.ens_name,
        ens_namehash: profile.ens_namehash,
    });
    transfer::transfer(profile, ctx.sender());
}

public fun ens_name(p: &Profile): String { p.ens_name }
public fun owner(p: &Profile): address { p.owner }
