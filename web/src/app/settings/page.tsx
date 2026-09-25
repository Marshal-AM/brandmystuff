"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Save } from "lucide-react";
import { useSession } from "@/lib/client/session";
import { Button, Card, EASE, Empty, Field, Input, PageHeader, Textarea, useAction } from "@/components/ui";
import { SignInButtons } from "@/components/shell";

export default function Settings() {
  const { me, authenticated, api, refresh } = useSession();
  const [f, setF] = useState({ displayName: "", bio: "", twitter: "", website: "", brandName: "" });
  const { busy, run } = useAction();
  // Seed the form once per signed-in user; later session refreshes must not overwrite what's being typed.
  const seeded = useRef<string | null>(null);
  useEffect(() => {
    const u = me?.user;
    if (!u || seeded.current === u.id) return;
    seeded.current = u.id;
    setF({ displayName: u.display_name ?? "", bio: u.bio ?? "", twitter: u.twitter ?? "", website: u.website ?? "", brandName: u.brand_name ?? "" });
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
      <PageHeader kicker="Settings" title="Your profile" sub={<>Saved to your ENS records on <span className="font-mono text-p">{me?.user?.ens_name}</span>.</>} />
      <Card className="relative overflow-hidden">
        <div aria-hidden className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-p/15 blur-3xl" />
        <div className="relative mb-6 flex items-center gap-4 border-b border-line pb-6">
          <motion.div initial={{ scale: 0.6, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-p to-p-600 text-2xl font-extrabold text-ink shadow-[0_0_40px_rgba(171,159,242,0.4)]">
            {initial}
          </motion.div>
          <div className="min-w-0">
            <div className="truncate text-lg font-bold">{f.displayName || me?.user?.handle}</div>
            <div className="truncate font-mono text-xs text-muted">{me?.user?.ens_name}</div>
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
            <Field key="n" label="Brand name (advertisers)"><Input value={f.brandName} onChange={(e) => setF({ ...f, brandName: e.target.value })} /></Field>,
            <Button key="save" size="lg" loading={busy === "s"} onClick={() => run("s", async () => { await api("/api/me/profile", { method: "POST", json: { ...f, website: f.website || "" } }); await refresh(); }, "Saved — ENS records update shortly")}>
              <Save className="h-4 w-4" /> Save
            </Button>,
          ].map((el, i) => (
            <motion.div key={i} variants={{ h: { opacity: 0, y: 14 }, s: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } }}>{el}</motion.div>
          ))}
        </motion.div>
      </Card>
    </div>
  );
}
