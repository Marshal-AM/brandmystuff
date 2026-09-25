"use client";
import Link from "next/link";
import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/client/session";
import { buyPrimary, cancelListing, claim, closeOffering, fillListing, listUnits, refundOffering } from "@/lib/sui/tx";
import { WALRUS } from "@/lib/deployment";
import { Badge, Button, Card, Empty, Field, GradeBadge, Img, Input, Spinner, Stat, shortAddr, suiscan, useAction, usdc } from "@/components/ui";
import { SignInButtons } from "@/components/shell";

export default function Offering({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { api, run, authenticated, address, signMessage } = useSession();
  const { data, refetch, isLoading } = useQuery({ queryKey: ["offering", id], queryFn: () => api<any>(`/api/offerings/${id}`), refetchInterval: 15000 });
  const [units, setUnits] = useState("");
  const [listU, setListU] = useState("");
  const [listP, setListP] = useState("");
  const [fillU, setFillU] = useState<Record<string, string>>({});
  const { busy, run: act } = useAction();
  if (isLoading) return <div className="grid place-items-center py-24"><Spinner /></div>;
  if (!data?.offering) return <Empty title="Offering not found" />;
  const o = data.offering, s = data.space, mine = data.mine;
  const ended = Date.now() >= Number(o.sale_end_ms) || o.sold_units >= o.offered_units;
  const remaining = o.offered_units - o.sold_units;
  const accept = async (u: number) => {
    const message = `brandmystuff:accept:${id}:${o.legal_pack_hash.replace(/^0x/, "")}:${u}`;
    const signature = await signMessage(message);
    const r = await api<any>("/api/acceptances", { method: "POST", json: { message, signature, role: "investor", offeringId: id, units: u } });
    return r.sigHash as string;
  };
  const buy = () =>
    act("buy", async () => {
      const u = Number(units);
      const sigHash = await accept(u);
      await run(buyPrimary({ offeringId: id, units: u, amount: BigInt(o.price_per_unit) * BigInt(u), acceptSigHash: sigHash }));
      setUnits("");
      refetch();
    }, "Units purchased");
  const pack = o.legal_pack;
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card className="flex gap-4">
            <Img blob={s.closeup_blob_id} alt="" className="h-28 w-28 shrink-0 rounded-xl" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">{pack?.series ?? `Series ${String(o.seq).padStart(6, "0")}`}</h1>
                <Badge tone={o.status === "open" ? "ok" : o.status === "tokenised" ? "brand" : "warn"}>{o.status}</Badge>
              </div>
              <Link href={`/${s.ens_name}`} className="font-mono text-sm text-brand underline">{s.ens_name}</Link>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted">
                <GradeBadge grade={s.grade} aqs={s.aqs} size="sm" /> {s.objects.title} · {usdc(s.price_per_week)}/week lease price
              </div>
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Revenue share" value={`${(o.revenue_share_bps / 100).toFixed(0)}%`} sub="of gross lease revenue" />
            <Stat label="Price / unit" value={usdc(o.price_per_unit, 4)} sub={`${o.offered_units.toLocaleString()} offered`} />
            <Stat label="Sold" value={`${o.sold_units.toLocaleString()} units`} sub={`min raise ${o.min_raise_units.toLocaleString()}`} />
            <Stat label="Distributed" value={usdc(o.total_distributed)} sub={`${data.stats.completed} completed leases`} />
          </div>
          <Card>
            <h2 className="mb-2 font-semibold">How you earn</h2>
            <p className="text-sm text-muted">
              Every time the owner&apos;s proof of display is accepted, a tranche of the advertiser&apos;s escrow is released: 12% platform fee, {(o.revenue_share_bps / 100).toFixed(0)}% of the gross to all 10,000 units pro-rata (via an on-chain accumulator), the rest to the owner. One unit earns {(o.revenue_share_bps / 1e8).toFixed(6)} USDC per 1 USDC of lease revenue. Claim any time.
            </p>
            <p className="mt-2 text-xs text-muted">Term {o.term_months} months · sale {ended ? "ended" : `ends ${new Date(Number(o.sale_end_ms)).toLocaleString()}`}</p>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">Legal documents <Badge tone="warn">mock</Badge></h2>
            {!pack ? <p className="text-sm text-muted">Loading document pack…</p> : (
              <div className="space-y-2">
                {pack.documents.map((d: any) => (
                  <a key={d.key} href={`${WALRUS.aggregator}/v1/blobs/${d.blobId}`} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-line p-3 text-sm hover:border-violet-300">
                    <span>📄 {d.title}</span>
                    <span className="font-mono text-xs text-muted">sha256 {d.sha256.slice(0, 10)}…</span>
                  </a>
                ))}
                <p className="text-xs text-muted">Pack hash (on-chain): <span className="font-mono">{o.legal_pack_hash}</span></p>
              </div>
            )}
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">Order book</h2>
            {!data.listings.length ? <p className="text-sm text-muted">No units for sale on the secondary market.</p> : (
              <div className="space-y-2">
                {data.listings.map((l: any) => (
                  <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm" data-testid="listing">
                    <span>{l.units.toLocaleString()} units @ {usdc(l.price_per_unit, 4)} · by {shortAddr(l.seller)}</span>
                    {l.seller === address ? (
                      <Button size="sm" variant="secondary" loading={busy === `c${l.id}`} onClick={() => act(`c${l.id}`, () => run(cancelListing({ offeringId: id, listingId: l.id })).then(() => refetch()), "Listing cancelled")}>Cancel</Button>
                    ) : mine?.verified ? (
                      <span className="flex gap-2">
                        <Input className="w-24" placeholder="units" value={fillU[l.id] ?? ""} onChange={(e) => setFillU({ ...fillU, [l.id]: e.target.value })} />
                        <Button size="sm" loading={busy === `f${l.id}`} disabled={!(Number(fillU[l.id]) > 0 && Number(fillU[l.id]) <= l.units)} onClick={() => act(`f${l.id}`, () => run(fillListing({ offeringId: id, listingId: l.id, units: Number(fillU[l.id]), amount: BigInt(l.price_per_unit) * BigInt(Number(fillU[l.id])) })).then(() => refetch()), "Bought")} data-testid="fill">Buy</Button>
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">Holders & activity</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1 text-sm">
                {data.holders.filter((h: any) => h.units + h.listed_units > 0).map((h: any) => (
                  <div key={h.address} className="flex justify-between"><span className="font-mono">{shortAddr(h.address)}{h.address === o.owner && " (owner)"}</span><span>{(h.units + h.listed_units).toLocaleString()} units</span></div>
                ))}
              </div>
              <div className="space-y-1 text-xs">
                {data.events.slice(0, 20).map((e: any) => (
                  <div key={e.id} className="flex justify-between gap-2"><span>{e.kind}{e.units ? ` · ${e.units}u` : ""}{e.amount ? ` · ${usdc(e.amount)}` : ""}</span><a className="text-brand underline" href={suiscan("tx", e.digest)} target="_blank" rel="noreferrer">tx</a></div>
                ))}
              </div>
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          {!authenticated ? <Card><SignInButtons /></Card> : (
            <>
              {mine && (
                <Card>
                  <div className="text-sm text-muted">Your position</div>
                  <div className="mt-1 text-2xl font-semibold">{(mine.units + mine.listed).toLocaleString()} units</div>
                  <div className="text-sm text-muted">{mine.listed > 0 && `${mine.listed} listed · `}{((mine.units + mine.listed) / 100).toFixed(2)}% of the series</div>
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 p-3">
                    <div><div className="text-xs text-emerald-800">Claimable</div><div className="font-semibold text-emerald-900" data-testid="claimable">{usdc(mine.claimable)}</div></div>
                    <Button size="sm" disabled={BigInt(mine.claimable) === 0n} loading={busy === "claim"} onClick={() => act("claim", () => run(claim({ offeringId: id })).then(() => refetch()), "Claimed")} data-testid="claim">Claim</Button>
                  </div>
                  {o.status === "refunding" && mine.units > 0 && address !== o.owner && (
                    <Button className="mt-3 w-full" loading={busy === "refund"} onClick={() => act("refund", () => run(refundOffering({ offeringId: id })).then(() => refetch()), "Refunded")}>Refund my purchase</Button>
                  )}
                </Card>
              )}
              {o.status === "open" && !ended && (
                <Card className="space-y-3">
                  <h3 className="font-semibold">Buy units</h3>
                  {!mine?.verified ? (
                    <p className="text-sm">Verify your identity to invest. <Link href="/verify" className="text-brand underline">Verify now</Link></p>
                  ) : (
                    <>
                      <Field label={`Units (max ${Math.min(remaining, o.per_investor_max).toLocaleString()})`}>
                        <Input inputMode="numeric" value={units} onChange={(e) => setUnits(e.target.value.replace(/\D/g, ""))} data-testid="buy-units" />
                      </Field>
                      <div className="text-sm">Total: <b>{usdc((BigInt(o.price_per_unit) * BigInt(Number(units) || 0)).toString(), 4)}</b></div>
                      <p className="text-xs text-muted">You&apos;ll sign the subscription agreement with your wallet; its hash is stored on-chain with your purchase.</p>
                      <Button className="w-full" loading={busy === "buy"} disabled={!(Number(units) > 0)} onClick={buy} data-testid="buy">Sign & buy</Button>
                    </>
                  )}
                </Card>
              )}
              {o.status === "open" && ended && (
                <Card>
                  <p className="text-sm">The sale window has ended.</p>
                  <Button className="mt-2 w-full" loading={busy === "close"} onClick={() => act("close", () => run(closeOffering({ offeringId: id, spaceId: o.space_id })).then(() => refetch()), "Offering closed")} data-testid="close-offering">Close offering</Button>
                </Card>
              )}
              {o.status === "tokenised" && mine && mine.units > 0 && (
                <Card className="space-y-3">
                  <h3 className="font-semibold">Sell units</h3>
                  {!mine.verified && <p className="text-xs text-muted">Buyers must be verified investors.</p>}
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Units"><Input inputMode="numeric" value={listU} onChange={(e) => setListU(e.target.value.replace(/\D/g, ""))} data-testid="list-units" /></Field>
                    <Field label="USDC / unit"><Input inputMode="decimal" value={listP} onChange={(e) => setListP(e.target.value)} data-testid="list-price" /></Field>
                  </div>
                  <Button className="w-full" loading={busy === "list"} disabled={!(Number(listU) > 0 && Number(listU) <= mine.units && Number(listP) > 0)} onClick={() => act("list", () => run(listUnits({ offeringId: id, units: Number(listU), pricePerUnit: BigInt(Math.round(Number(listP) * 1e6)) })).then(() => { setListU(""); refetch(); }), "Listed")} data-testid="list">List for sale</Button>
                  <p className="text-xs text-muted">1% market fee on fills. Listed units keep earning until sold.</p>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
