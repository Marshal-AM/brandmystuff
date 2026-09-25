"use client";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/client/session";
import { Button, Card, Field, Input, Textarea, useAction } from "@/components/ui";
import { SignInButtons } from "@/components/shell";

export default function Settings() {
  const { me, authenticated, api, refresh } = useSession();
  const [f, setF] = useState({ displayName: "", bio: "", twitter: "", website: "", brandName: "" });
  const { busy, run } = useAction();
  useEffect(() => {
    const u = me?.user;
    if (u) setF({ displayName: u.display_name ?? "", bio: u.bio ?? "", twitter: u.twitter ?? "", website: u.website ?? "", brandName: u.brand_name ?? "" });
  }, [me?.user]);
  if (!authenticated) return <div className="grid place-items-center py-24"><SignInButtons /></div>;
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Profile</h1>
      <p className="text-sm text-muted">Saved to your ENS records on <span className="font-mono">{me?.user?.ens_name}</span>.</p>
      <Card className="mt-6 space-y-4">
        <Field label="Display name"><Input value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></Field>
        <Field label="Bio"><Textarea rows={3} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>
        <Field label="X / Twitter handle"><Input value={f.twitter} onChange={(e) => setF({ ...f, twitter: e.target.value })} /></Field>
        <Field label="Website"><Input value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="https://" /></Field>
        <Field label="Brand name (advertisers)"><Input value={f.brandName} onChange={(e) => setF({ ...f, brandName: e.target.value })} /></Field>
        <Button loading={busy === "s"} onClick={() => run("s", async () => { await api("/api/me/profile", { method: "POST", json: { ...f, website: f.website || "" } }); await refresh(); }, "Saved — ENS records update shortly")}>Save</Button>
      </Card>
    </div>
  );
}
