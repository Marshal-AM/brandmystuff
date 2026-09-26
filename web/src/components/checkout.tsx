"use client";
import { DEMO, DEMO_ENABLED, demoFile } from "@/lib/client/demo";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Lock, Plus, Zap } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useSession } from "@/lib/client/session";
import { book } from "@/lib/sui/tx";
import { Button, EASE, Field, Img, Input, Modal, cx, useAction, usdc } from "./ui";

export function weekLabel(week: number, weekMs: number) {
  const d = new Date(week * weekMs);
  return weekMs < 86400_000 ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function Step({ n, title, right, children }: { n: number; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: n * 0.07, duration: 0.5, ease: EASE }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-sm font-bold">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-p text-[11px] font-extrabold text-ink">{n}</span>
          {title}
        </div>
        {right}
      </div>
      {children}
    </motion.section>
  );
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
  const [landing, setLanding] = useState(me?.user?.website || DEMO.lease.landingUrl);
  const [brand, setBrand] = useState(me?.user?.brand_name || me?.user?.display_name || DEMO.lease.brand);
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
  return (
    <Modal open onClose={onClose} title={`Lease ${space.label}`} wide>
      <div className="space-y-7">
        <Step n={1} title={weekMs < 86400_000 ? `Pick a start slot (demo weeks are ${weekMs / 60000} min)` : "Pick a start week"}>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
            {Array.from({ length: 16 }, (_, i) => current + i).map((w) => {
              const taken = bookedSet.has(w);
              const inRange = w >= start && w < start + weeks;
              return (
                <motion.button
                  key={w}
                  whileTap={taken ? undefined : { scale: 0.92 }}
                  disabled={taken}
                  onClick={() => setStart(w)}
                  className={cx(
                    "relative h-11 rounded-xl border text-xs font-semibold transition-colors duration-300",
                    taken ? "cursor-not-allowed border-line bg-white/[0.02] text-faint line-through" : inRange ? "border-p text-ink" : "border-line-strong text-white/75 hover:border-p/50",
                  )}
                >
                  {inRange && <motion.span layoutId={`wk-${w}`} className="absolute inset-0 rounded-xl bg-p" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 420, damping: 26 }} />}
                  <span className="relative">{weekLabel(w, weekMs)}</span>
                </motion.button>
              );
            })}
          </div>
          <div className="mt-4 max-w-xs">
            <Field label="Duration (weeks)" hint={conflict ? <span className="font-semibold text-white">Some of these weeks are already booked</span> : `${weekLabel(start, weekMs)} → ${weekLabel(start + weeks, weekMs)}`}>
              <Input type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(Math.max(1, Math.min(52, Number(e.target.value))))} data-testid="weeks" />
            </Field>
          </div>
        </Step>

        <Step n={2} title="Choose a creative from your brand kit" right={<Link href="/brand-kit" className="text-xs font-semibold text-p hover:underline">Manage brand kit</Link>}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {kit?.assets?.map((a: any, i: number) => (
              <motion.button
                key={a.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + i * 0.04 }}
                whileHover={{ y: -3 }}
                onClick={() => setAsset(a)}
                data-testid="kit-asset"
                className={cx("checker relative overflow-hidden rounded-2xl border-2 transition-colors", asset?.id === a.id ? "border-p shadow-[0_0_24px_rgba(171,159,242,0.5)]" : "border-transparent")}
              >
                <Img blob={a.blob_id} alt={a.name} className="aspect-square w-full object-contain" />
              </motion.button>
            ))}
            <label className="grid aspect-square cursor-pointer place-items-center rounded-2xl border border-dashed border-line-strong text-xs font-semibold text-muted transition-colors hover:border-p hover:text-p">
              <span className="flex flex-col items-center gap-1">
                <Plus className="h-5 w-5" /> Upload
              </span>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" data-testid="kit-upload" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
            {DEMO_ENABLED && (
              <button type="button" onClick={() => act("demo-logo", async () => upload(await demoFile("logo")))} className="grid aspect-square place-items-center rounded-2xl border border-dashed border-p/50 bg-p/[0.06] text-xs font-semibold text-p transition-colors hover:bg-p/10" data-testid="kit-demo">
                <span className="flex flex-col items-center gap-1">{busy === "demo-logo" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />} Demo submit</span>
              </button>
            )}
          </div>
        </Step>

        <Step n={3} title="Brand details">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Brand name">
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} data-testid="brand" />
            </Field>
            <Field label="Landing URL" hint="We add a tracked redirect with UTM tags">
              <Input value={landing} onChange={(e) => setLanding(e.target.value)} placeholder="https://acme.com" data-testid="landing" />
            </Field>
          </div>
        </Step>

        <Step n={4} title="Pay into escrow">
          <div className="relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-p/30 bg-gradient-to-br from-p/15 via-p-900 to-p-950 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div aria-hidden className="absolute -right-10 -top-16 h-40 w-40 rounded-full bg-p/25 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                <Lock className="h-3.5 w-3.5 text-p" /> Held in escrow, released per verified proof
              </div>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div key={total.toString()} initial={{ y: 16, opacity: 0, filter: "blur(4px)" }} animate={{ y: 0, opacity: 1, filter: "blur(0px)" }} exit={{ y: -16, opacity: 0 }} className="mt-1 text-3xl font-extrabold tracking-tight">
                  {usdc(total.toString())}
                </motion.div>
              </AnimatePresence>
              {bal < total && <div className="mt-1 text-xs font-semibold text-white">Your balance is {usdc(bal.toString())}. Top up on the wallet page.</div>}
            </div>
            <Button size="lg" className="relative" loading={busy === "pay"} disabled={!asset || !brand || !/^https?:\/\//.test(landing) || conflict || bal < total} onClick={pay} data-testid="pay">
              Pay with USDC
            </Button>
          </div>
        </Step>
      </div>
    </Modal>
  );
}
