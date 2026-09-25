"use client";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PLACEMENTS } from "@/lib/categories";
import { SpaceCard } from "@/components/space-card";
import { Empty, Input, LinkButton, Select, Spinner } from "@/components/ui";

export default function Home() {
  const [f, setF] = useState({ q: "", tag: "", minGrade: "", maxPrice: "", placement: "", city: "", tokenised: false, sponsored: false, sort: "rank" });
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v === true ? "1" : String(v)));
    return p.toString();
  }, [f]);
  const { data, isLoading } = useQuery({ queryKey: ["market", qs], queryFn: () => fetch(`/api/market?${qs}`).then((r) => r.json()) });
  const { data: tags } = useQuery({ queryKey: ["tags"], queryFn: () => fetch("/api/tags").then((r) => r.json()) });
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v }));
  return (
    <div>
      <section className="grid-bg border-b border-line">
        <div className="mx-auto max-w-7xl px-4 py-14">
          <p className="text-sm font-medium text-brand">Brand My Mac, for everything you own</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">Rent the ad space on your stuff. Or put your brand on someone else&apos;s.</h1>
          <p className="mt-4 max-w-2xl text-muted">
            Every space is scored by AI, paid in USDC escrow on Sui and released only when the owner proves your ad is on display. Owners can tokenise a space&apos;s future income. Every listing is an ENS name.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <LinkButton href="/list">List your stuff</LinkButton>
            <LinkButton href="/offerings" variant="secondary">
              Invest in ad income
            </LinkButton>
          </div>
        </div>
      </section>

      {data?.rail?.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-8">
          <div className="mb-3 text-sm font-semibold">Sponsored</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.rail.map((s: any) => (
              <SpaceCard key={`rail-${s.id}`} s={{ ...s, slot: "sponsored" }} />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8">
          <Input className="col-span-2" placeholder="Search spaces, objects, cities…" value={f.q} onChange={(e) => set("q", e.target.value)} data-testid="search" />
          <Input placeholder="Tag (e.g. laptop, car)" value={f.tag} onChange={(e) => set("tag", e.target.value.toLowerCase())} />
          <Select value={f.minGrade} onChange={(e) => set("minGrade", e.target.value)}>
            <option value="">Any grade</option>
            <option value="4">A+</option>
            <option value="3">A or better</option>
            <option value="2">B or better</option>
          </Select>
          <Select value={f.placement} onChange={(e) => set("placement", e.target.value)}>
            <option value="">Any placement</option>
            {PLACEMENTS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
          <Input placeholder="Max USDC / week" inputMode="decimal" value={f.maxPrice} onChange={(e) => set("maxPrice", e.target.value)} />
          <Input placeholder="City" value={f.city} onChange={(e) => set("city", e.target.value)} />
          <Select value={f.sort} onChange={(e) => set("sort", e.target.value)}>
            <option value="rank">Best quality</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
            <option value="newest">Newest</option>
          </Select>
        </div>
        {tags?.tags?.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {tags.tags.map((t: any) => (
              <button key={t.tag} onClick={() => set("tag", f.tag === t.tag ? "" : t.tag)} className={`rounded-full border px-3 py-1 text-xs ${f.tag === t.tag ? "border-brand bg-violet-50 font-medium" : "border-line bg-surface hover:border-violet-300"}`}>
                {t.tag} <span className="text-muted">{t.count}</span>
              </button>
            ))}
          </div>
        )}
        <div className="mb-4 flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.tokenised} onChange={(e) => set("tokenised", e.target.checked)} /> Tokenised only
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.sponsored} onChange={(e) => set("sponsored", e.target.checked)} /> Sponsored only
          </label>
          {data && <span className="ml-auto text-muted">{data.total} spaces</span>}
        </div>
        {isLoading ? (
          <div className="grid place-items-center py-20">
            <Spinner />
          </div>
        ) : !data?.results?.length ? (
          <Empty title="No spaces match yet">Be the first — list an object and its ad spaces.</Empty>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.results.map((s: any, i: number) => (
              <SpaceCard key={`${s.id}-${i}`} s={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
