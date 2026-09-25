The core structural insight

In real estate, there are two distinct income claims that have to be kept separate:

The entity that legally holds the asset (gets paid when the asset is sold/liquidated, controls decisions)
The token holders (get paid a share of ongoing income, but don't hold title)

For your idea, this maps directly:

Object owner = the person who contributed the physical object → equivalent of the original property owner who put the house into the SPV
Token holders (investors) = people who buy fractional revenue rights → equivalent of RealT/Lofty investors
Brands (tenants) = pay to occupy, never touch the token

Both the object owner and the investors earn — because the object owner doesn't sell 100% of the object, they sell a percentage of its future ad income, and keep the rest (or a management fee, or both).

Step 1 — Wrap the object in a legal entity (this is mandatory, not optional)

You cannot legally tokenize a physical object directly — no jurisdiction lets a blockchain token itself function as a title deed (Dubai's land registry is the one real exception, and that's government-run, not something you can replicate). Every working platform routes ownership through a Special Purpose Vehicle (SPV): sponsors form an SPV, often a Delaware LLC or similar, and that SPV holds the actual deed, with tokens representing membership interests in the SPV, not the building itself. 
Dappfort

For you: when an object owner lists their van/wall/laptop for tokenization, your platform creates a micro-SPV (or, more realistically at scale, a series LLC — one master LLC with a separate protected "series" per object, which is dramatically cheaper than spinning up a new LLC per object). This SPV is deeded/assigned the ad-revenue rights of that object, and issues digital tokens representing fractional ownership of the entity. The object owner still physically owns the van — they've contributed only the income rights to the SPV, not the title to the vehicle itself. 
LegalNodes

Step 2 — The object owner mints tokens against their own asset

This is where "tokenizing the object" actually happens, and it directly answers your question:

The object owner registers the object → your platform underwrites it (estimates ad revenue potential based on # of spaces, foot traffic/visibility, location, etc.)
The SPV issues, say, 1,000 "Object Revenue Tokens" for that specific van
The object owner can choose to:
Sell a portion (e.g., sell 600 of 1,000 tokens to investors, keep 400 for themselves) → gets an upfront lump sum plus keeps earning their share of ongoing rent forever
Sell all of it for a bigger upfront payout, giving up future income
Keep most and sell a small float just to bootstrap platform liquidity

This mirrors exactly how equity tokens in real estate SPV structures represent fractional ownership stakes in the property-holding entity, entitling holders to proportional rental income, appreciation, and voting rights on major decisions — except here "appreciation" would translate to something like resale value of an established high-traffic ad object with a proven revenue history. 
nadcab.com

Step 3 — Pick the right token standard (this matters more than people think)

Don't use a plain ERC-20 or NFT. Because you're issuing something that pays out revenue to identified people, most jurisdictions will treat this as a security, and you need transfer restrictions baked in. The current standard for this is ERC-3643 (T-REX):

The token contract implements ERC-20-like behavior but defers permissioning decisions to an identity registry that maps addresses to verified identities storing KYC level, jurisdiction, and accreditation status, and a compliance manager that encodes rules that must pass before mint, burn, or transfer. Practically: an investor completes KYC, a claim is issued to their on-chain identity, the address becomes recognized as eligible, and when a transfer happens the token contract checks the rules — if everything checks out the transfer is allowed, if not it reverts. 
onekey
onekey

Why this matters for you specifically: it means a brand or random person can't just buy your object-revenue tokens off some DEX with no verification — which is exactly the kind of thing that gets platforms shut down by regulators. Security tokens typically use ERC-1400 or ERC-3643 rather than plain ERC-20, because these standards bake in transfer restrictions and investor whitelisting required by securities law. 
Dappfort

Step 4 — Pick a securities exemption (this decides who can even buy in)

You have to structure the token sale under an actual securities exemption or you're doing an illegal unregistered offering. The common paths, per how existing platforms actually do it: Regulation D for accredited-investor-only deals, Regulation A+ for offerings open to a broader retail base with SEC qualification, or Regulation S for non-US investors. 
Dappfort

Reg D → fastest/cheapest to set up, but only accredited investors can buy object tokens (limits your "let anyone invest in a van" vision)
Reg A+ → lets you open it to everyday retail investors like Lofty does, letting non-accredited investors buy tiny shares and earn rental income daily, with investments starting around $50 per token — but it requires SEC qualification, which is slower and costs real legal money upfront 
CoinLaw
Reg CF (Crowdfunding) — worth researching too, often used for very small-dollar retail raises, cheaper than Reg A+

Given your "anyone can occupy, anyone should be able to invest" ethos, Reg A+ or Reg CF is probably the philosophical fit, but Reg D is the realistic MVP fit — you fractionalize among a small accredited group first, prove the model with one or two real objects, then graduate to retail-open offerings.

Step 5 — Revenue flows and splits automatically

Once a brand pays for a space:

Brand pays lease fee
        ↓
Platform (acting as SPV manager) collects payment
        ↓
Split happens automatically:
   → Platform fee (your cut, e.g. 10-20%)
   → Object Revenue Token holders (pro-rata share, incl. the object owner's retained tokens)

This doesn't need to be a fully trustless on-chain split from day one — the RealT collapse illustrates that blockchain infrastructure can make ownership transfer seamless, but it cannot solve property management, regulatory compliance, or physical maintenance — tokens are only as good as the entity and operations behind them — so most real platforms actually batch-settle distributions periodically rather than doing an on-chain split per transaction. Start with periodic batched payouts (e.g. weekly), computed off-chain, paid out on-chain to token-holder wallets. Automate the split logic fully once volume justifies the gas cost of doing it per-transaction. 
Spark

Step 6 — Secondary market (what makes it "tokenized" instead of just a co-op)

Investors need to be able to resell their Object Revenue Tokens without the object owner doing anything — that's the entire point versus a plain LLC cap table. Transferring LLC membership interests via tokens is far simpler than recording partial ownership changes through a traditional registry, which is what makes fractional trading possible in the first place. This has to happen on a compliant venue though — secondary markets for tokenized real estate operate on regulated Alternative Trading Systems (ATSs), not open decentralized exchanges — so realistically, early on this is an internal marketplace inside your own platform (peer-to-peer resale among your own KYC'd users), not a public DEX listing. 
Spark
CoinLaw