"use client";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/client/session";
import { Button, Img, Spinner, Textarea, cx, useAction } from "@/components/ui";

export default function Thread({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { api, events, authenticated } = useSession();
  const { data, refetch } = useQuery({ queryKey: ["thread", id], queryFn: () => api<any>(`/api/conversations/${id}`), enabled: authenticated });
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const { busy, run } = useAction();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (data) setMsgs(data.messages);
  }, [data]);
  useEffect(() => {
    const h = (e: Event) => {
      const m = (e as CustomEvent).detail;
      if (m.conversation_id === id) setMsgs((x) => (x.some((y) => y.id === m.id) ? x : [...x, m]));
    };
    events.addEventListener("message", h);
    return () => events.removeEventListener("message", h);
  }, [events, id]);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [msgs.length]);
  if (!data) return <div className="grid place-items-center py-24"><Spinner /></div>;
  const person = (uid: string) => data.people.find((p: any) => p.id === uid);
  const send = () =>
    run("send", async () => {
      const fd = new FormData();
      fd.set("body", text);
      files.forEach((f) => fd.append("files", f));
      const r = await api<any>(`/api/conversations/${id}`, { method: "POST", body: fd });
      setMsgs((x) => (x.some((y) => y.id === r.message.id) ? x : [...x, r.message]));
      setText("");
      setFiles([]);
    });
  return (
    <div className="mx-auto flex h-[calc(100vh-140px)] max-w-3xl flex-col px-4 py-6">
      <div className="mb-3 flex items-center gap-3">
        <Img blob={data.conversation.spaces.closeup_blob_id} alt="" className="h-10 w-10 rounded-lg" />
        <div>
          <div className="font-semibold">{data.conversation.spaces.label}</div>
          <Link href={`/${data.conversation.spaces.ens_name}`} className="font-mono text-xs text-brand underline">{data.conversation.spaces.ens_name}</Link>
        </div>
        {data.conversation.escrow_id && <Link href={`/leases/${data.conversation.escrow_id}`} className="ml-auto text-sm underline">Open lease</Link>}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-line bg-surface p-4">
        {!msgs.length && <p className="text-center text-sm text-muted">Say hi 👋</p>}
        {msgs.map((m) => {
          const mine = m.sender_user_id === data.me;
          const p = person(m.sender_user_id);
          return (
            <div key={m.id} className={cx("flex", mine ? "justify-end" : "justify-start")} data-testid="chat-message">
              <div className={cx("max-w-[75%] rounded-2xl px-4 py-2 text-sm", mine ? "bg-brand text-white" : "bg-black/5")}>
                {!mine && <div className="mb-0.5 text-xs font-semibold opacity-70">{p?.brand_name ?? p?.display_name ?? p?.handle}</div>}
                {m.body && <div className="whitespace-pre-wrap">{m.body}</div>}
                {(m.attachments ?? []).map((a: any) =>
                  a.mime?.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={a.path} src={a.url} alt={a.name} className="mt-2 max-h-60 rounded-lg" />
                  ) : a.mime?.startsWith("video/") ? (
                    <video key={a.path} src={a.url} controls className="mt-2 max-h-60 rounded-lg" />
                  ) : (
                    <a key={a.path} href={a.url} target="_blank" rel="noreferrer" className="mt-2 block underline">📎 {a.name}</a>
                  ),
                )}
                <div className="mt-1 flex items-center gap-2 text-[10px] opacity-60">
                  {new Date(m.created_at).toLocaleTimeString()}
                  {mine && m.read_at && "· read"}
                  {!mine && <button onClick={() => api(`/api/conversations/${id}`, { method: "PATCH", json: { messageId: m.id } }).then(() => refetch())} className="underline">report</button>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <div className="mt-3 space-y-2">
        {files.length > 0 && <div className="text-xs text-muted">📎 {files.map((f) => f.name).join(", ")}</div>}
        <div className="flex items-end gap-2">
          <label className="cursor-pointer rounded-xl border border-line bg-surface px-3 py-2.5 text-sm hover:border-violet-300">
            📎
            <input type="file" multiple accept="image/*,video/*,application/pdf" className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} data-testid="chat-files" />
          </label>
          <Textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message…" className="flex-1" data-testid="chat-input" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (text || files.length) send(); } }} />
          <Button loading={busy === "send"} disabled={!text && !files.length} onClick={send} data-testid="chat-send">Send</Button>
        </div>
      </div>
    </div>
  );
}
