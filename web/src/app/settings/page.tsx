"use client";
import { DEMO } from "@/lib/client/demo";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Save } from "lucide-react";
import { useSession } from "@/lib/client/session";
import { Button, Card, EASE, Empty, Field, Input, PageHeader, Textarea, cx, useAction } from "@/components/ui";
import { EnsGlyph, EnsHint, EnsName, ensAppUrl } from "@/components/ens";
import { useEnsSigner } from "@/lib/client/ens-signer";
import { SignInButtons } from "@/components/shell";
import { PayoutRouteCard } from "@/components/payouts";

export default function Settings() {
  const { me, authenticated, api, refresh } = useSession();
  const [f, setF] = useState({ displayName: "", bio: "", twitter: "", website: "", brandName: "" });
  const { busy, run } = useAction();
  const signer = useEnsSigner();
  // Seed the form once per signed-in user; later session refreshes must not overwrite what's being typed.
  const seeded = useRef<string | null>(null);
  useEffect(() => {
    const u = me?.user;
    if (!u || seeded.current === u.id) return;
    seeded.current = u.id;
    setF({ displayName: u.display_name || DEMO.displayName, bio: u.bio || DEMO.profile.bio, twitter: u.twitter || DEMO.profile.twitter, website: u.website || DEMO.profile.website, brandName: u.brand_name ?? "" });
  }, [me?.user]);
  if (!authenticated)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Empty title="Your profile">Sign in to edit your profile and ENS records.</Empty>
        <div className="mt-6 flex justify-center"><SignInButtons /></div>
      </div>
    );
  const initial = (f.displayName || me?.user?.handle || "?").slice(0, 1).toUpperCase();
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6">
      <PageHeader kicker="Settings" title="Your profile" sub="Your profile lives in your ENS name’s records, so it follows you anywhere ENS is read." />
      <Card className="relative overflow-hidden">
        <div aria-hidden className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-p/15 blur-3xl" />
        <div className="relative mb-6 flex items-center gap-4 border-b border-line pb-6">
          <motion.div initial={{ scale: 0.6, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-p to-p-600 text-2xl font-extrabold text-ink shadow-[0_0_40px_rgba(171,159,242,0.4)]">
            {initial}
          </motion.div>
          <div className="min-w-0">
            <div className="truncate text-lg font-bold">{f.displayName || me?.user?.handle}</div>
            {me?.user?.ens_name && <div className="mt-1"><EnsName name={me.user.ens_name} status={me.user.ens_status} kind="account" size="xs" /></div>}
          </div>
        </div>
        <motion.div className="relative space-y-4" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } } }}>
          {[
            <Field key="d" label="Display name"><Input value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></Field>,
            <Field key="b" label="Bio"><Textarea rows={3} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>,
            <div key="s" className="grid gap-4 sm:grid-cols-2">
              <Field label="X / Twitter handle"><Input value={f.twitter} onChange={(e) => setF({ ...f, twitter: e.target.value })} /></Field>
              <Field label="Website"><Input value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="https://" /></Field>
            </div>,
            // Only brand accounts have a brand; owners are people.
            ...(me?.user?.account_type === "brand" ? [<Field key="n" label="Brand name"><Input value={f.brandName} onChange={(e) => setF({ ...f, brandName: e.target.value })} /></Field>] : []),
            <Button key="save" size="lg" loading={busy === "s"} onClick={() => run("s", async () => {
              await api("/api/me/profile", { method: "POST", json: { ...f, website: f.website || "" } });
              await refresh();
              // Self-managed names: the profile keys are published by the user's own wallet (ENSv2 key-scoped role).
              const u = me?.user;
              if (signer.ready && u?.ens_name) {
                const edits = [
                  { key: "name", value: f.displayName },
                  ...(u.account_type === "brand" && u.brand_about ? [] : [{ key: "description", value: f.bio }]),
                  { key: "com.twitter", value: f.twitter },
                  { key: "url", value: f.website },
                ].filter((e) => e.value && signer.keys.includes(e.key));
                try {
                  if (edits.length) await signer.setTexts(edits.map((e) => ({ name: u.ens_name, ...e })));
                } catch (e: any) {
                  throw new Error(`Saved. Publishing to ENS needs your signature: ${e?.shortMessage ?? e?.message ?? "cancelled"}`);
                }
              }
            }, signer.ready ? "Saved and signed to your ENS name" : "Saved — ENS records update shortly")}>
              <Save className="h-4 w-4" /> Save
            </Button>,
            ...(signer.ready ? [<EnsHint key="h">Your wallet signs these records itself: on your own ENS resolver it may write your profile keys, while scores and verification stay attested by brandmystuff.</EnsHint>] : []),
          ].map((el, i) => (
            <motion.div key={i} variants={{ h: { opacity: 0, y: 14 }, s: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } }}>{el}</motion.div>
          ))}
        </motion.div>
      </Card>
      {me?.user?.sui_address && me.user.account_type !== "brand" && <PayoutRouteCard delay={0.05} />}
      {me?.user?.ens_name && (
        <Card className="mt-6" delay={0.1}>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 font-bold"><EnsGlyph className="h-4 w-4 text-p" /> What&apos;s written to ENS</h3>
              <p className="mt-0.5 text-xs text-muted">These text records on your name update when you save. Anyone reading ENS sees the same thing.</p>
            </div>
            <a href={ensAppUrl(me.user.ens_name)} target="_blank" rel="noreferrer" className="text-xs font-semibold text-p hover:underline">View in the ENS app ↗</a>
          </div>
          <div className="space-y-1.5">
            {[
              ["name", f.displayName, me.user.display_name],
              ["description", f.bio, me.user.bio],
              ["com.twitter", f.twitter, me.user.twitter],
              ["url", f.website, me.user.website],
              ["class", f.brandName ? "Organization" : "Person", me.user.brand_name ? "Organization" : "Person"],
            ].map(([key, now, saved]) => {
              const changed = (now ?? "") !== (saved ?? "");
              return (
                <div key={key as string} className={cx("flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors", changed ? "bg-p/[0.08] ring-1 ring-p/30" : "bg-white/[0.02]")}>
                  <span className="w-28 shrink-0 font-mono text-[11px] text-p">{key}</span>
                  <span className={cx("min-w-0 flex-1 truncate", now ? "text-white/90" : "text-faint")}>{(now as string) || "not set"}</span>
                  <AnimatePresence>{changed && <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="shrink-0 rounded-full bg-p px-2 py-0.5 text-[10px] font-bold text-ink">on save</motion.span>}</AnimatePresence>
                </div>
              );
            })}
            {me.user.sui_address && (
              <div className="flex items-center gap-3 rounded-xl bg-white/[0.02] px-3 py-2 text-sm">
                <span className="w-28 shrink-0 font-mono text-[11px] text-p">addr · Sui</span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-white/70">{me.user.sui_address}</span>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
