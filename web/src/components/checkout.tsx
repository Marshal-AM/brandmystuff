"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSession } from "@/lib/client/session";
import { book } from "@/lib/sui/tx";
import { Button, Field, Img, Input, Modal, cx, useAction, usdc } from "./ui";

export function weekLabel(week: number, weekMs: number) {
  const d = new Date(week * weekMs);
  return weekMs < 86400_000 ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function Checkout({ space, booked, onClose }: { space: any; booked: number[]; onClose: () => void }) {
  const { api, run, me, refresh } = useSession();
  const router = useRouter();
  const weekMs = Number(space.week_ms);
  const current = Math.floor(Date.now() / weekMs);
  const bookedSet = useMemo(() => new Set(booked), [booked]);
  const [start, setStart] = useState(() => {
    let w = current;
    while (bookedSet.has(w)) w++;
    return w;
  });
  const [weeks, setWeeks] = useState(1);
  const [asset, setAsset] = useState<any>(null);
  const [landing, setLanding] = useState(me?.user?.website ?? "");
  const [brand, setBrand] = useState(me?.user?.brand_name ?? me?.user?.display_name ?? "");
  const { data: kit, refetch } = useQuery({ queryKey: ["brand-kit"], queryFn: () => api<any>("/api/brand-assets") });
  const { busy, run: act } = useAction();
  const total = BigInt(space.price_per_week) * BigInt(weeks);
  const conflict = Array.from({ length: weeks }, (_, i) => start + i).some((w) => bookedSet.has(w));
  const bal = BigInt(me?.balances?.usdc ?? 0);
  const upload = async (file: File) => {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("name", file.name);
    const r = await api<any>("/api/brand-assets", { method: "POST", body: fd });
    await refetch();
    setAsset(r.asset);
  };
  const pay = () =>
    act("pay", async () => {
      const r = await run(
        book({
          spaceId: space.id,
          calendarId: space.calendar_id,
          amount: total,
          startWeek: BigInt(start),
          weeks,
          creativeBlobId: asset.blob_id,
          creativeHash: asset.sha256,
          landingUrl: landing,
          brand,
        }),
      );
      const ev = r.events.find((e) => e.type.endsWith("LeaseBooked"));
      await refresh();
      router.push(`/leases/${ev!.json.escrow_id}`);
    }, "Lease booked — USDC is in escrow");
  const aspect = space.width_mm / space.height_mm;
  return (
    <Modal open onClose={onClose} title={`Lease ${space.label}`} wide>
      <div className="space-y-5">
        <div>
          <div className="mb-2 text-sm font-medium">Start {weekMs < 86400_000 ? "slot (demo weeks are " + weekMs / 60000 + " min)" : "week"}</div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 16 }, (_, i) => current + i).map((w) => (
              <button key={w} disabled={bookedSet.has(w)} onClick={() => setStart(w)} className={cx("rounded-lg border px-2.5 py-1.5 text-xs", bookedSet.has(w) ? "cursor-not-allowed border-line bg-black/5 text-muted line-through" : w >= start && w < start + weeks ? "border-brand bg-violet-50 font-medium" : "border-line hover:border-violet-300")}>
                {weekLabel(w, weekMs)}
              </button>
            ))}
          </div>
        </div>
        <Field label="Duration (weeks)" hint={conflict ? <span className="text-bad">Some of these weeks are already booked</span> : `${weekLabel(start, weekMs)} → ${weekLabel(start + weeks, weekMs)}`}>
          <Input type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(Math.max(1, Math.min(52, Number(e.target.value))))} data-testid="weeks" />
        </Field>
        <div>
          <div className="mb-2 flex items-center justify-between text-sm font-medium">
            Creative from your brand kit
            <Link href="/brand-kit" className="text-xs text-brand underline">
              Manage brand kit
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {kit?.assets?.map((a: any) => (
              <button key={a.id} onClick={() => setAsset(a)} data-testid="kit-asset" className={cx("overflow-hidden rounded-xl border-2 bg-white", asset?.id === a.id ? "border-brand" : "border-transparent")}>
                <Img blob={a.blob_id} alt={a.name} className="aspect-square w-full object-contain" />
              </button>
            ))}
            <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border border-dashed border-line text-xs text-muted hover:border-violet-300">
              + Upload
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" data-testid="kit-upload" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          </div>
        </div>
        {asset && (
          <div className="flex gap-4 rounded-xl bg-black/[0.03] p-3">
            <div className="relative w-40 overflow-hidden rounded-lg">
              <Img blob={space.closeup_blob_id} alt="space" className="aspect-square w-full" />
              <div className="absolute inset-0 grid place-items-center">
                <div className="grid place-items-center rounded bg-white/90 p-1 shadow" style={{ width: aspect >= 1 ? "70%" : `${70 * aspect}%`, aspectRatio: String(aspect) }}>
                  <Img blob={asset.blob_id} alt="creative" className="h-full w-full object-contain" />
                </div>
              </div>
            </div>
            <div className="text-sm text-muted">
              Fit preview on the owner&apos;s close-up. Printed at {space.width_mm / 10}×{space.height_mm / 10} cm; text up to ~{((0.35 * Math.min(space.width_mm, space.height_mm)) / 10 / 2.54).toFixed(1)}&quot; tall stays legible from a distance.
            </div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Brand name">
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} data-testid="brand" />
          </Field>
          <Field label="Landing URL" hint="We add a tracked redirect with UTM tags">
            <Input value={landing} onChange={(e) => setLanding(e.target.value)} placeholder="https://acme.com" data-testid="landing" />
          </Field>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-line p-4">
          <div>
            <div className="text-sm text-muted">Total (held in escrow, released per verified proof)</div>
            <div className="text-2xl font-semibold">{usdc(total.toString())}</div>
            {bal < total && <div className="text-xs text-bad">Your balance is {usdc(bal.toString())} — top up on the wallet page.</div>}
          </div>
          <Button size="lg" loading={busy === "pay"} disabled={!asset || !brand || !/^https?:\/\//.test(landing) || conflict || bal < total} onClick={pay} data-testid="pay">
            Pay with USDC
          </Button>
        </div>
      </div>
    </Modal>
  );
}
