"use client";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, CheckCheck, Flag, Paperclip, Send, X } from "lucide-react";
import { useSession } from "@/lib/client/session";
import { Button, EASE, Img, PageLoader, Spinner, Textarea, cx, useAction } from "@/components/ui";
import { EnsName } from "@/components/ens";

export default function Thread({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { api, events, authenticated } = useSession();
  const { data, refetch } = useQuery({ queryKey: ["thread", id], queryFn: () => api<any>(`/api/conversations/${id}`), enabled: authenticated });
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const { busy, run } = useAction();
  const list = useRef<HTMLDivElement>(null);
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
  // Scroll only the message list, never the page. (scrollIntoView also scrolls every ancestor,
  // and in current Chrome it returns a Promise, which must not be returned from an effect.)
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: msgs.length > 1 ? "smooth" : "auto" });
  }, [msgs.length]);
  if (!data) return <PageLoader label="Loading conversation" />;
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
  const sp = data.conversation.spaces;
  return (
    <div className="mx-auto flex h-[calc(100dvh-164px)] min-h-[420px] max-w-3xl flex-col px-4 sm:px-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="glass mb-3 flex shrink-0 items-center gap-3 rounded-3xl p-3">
        <Link href="/messages" className="grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:bg-white/[0.06] hover:text-white" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Img blob={sp.closeup_blob_id} alt="" className="h-11 w-11 rounded-xl" />
        <div className="min-w-0">
          <div className="truncate font-bold">{sp.label}</div>
          <div className="mt-0.5"><EnsName name={sp.ens_name} kind="space" size="xs" /></div>
        </div>
        {data.conversation.escrow_id && (
          <Link href={`/leases/${data.conversation.escrow_id}`} className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-p/15 px-3.5 py-1.5 text-xs font-semibold text-p transition-colors hover:bg-p hover:text-ink">
            Open lease <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </motion.div>

      <div ref={list} className="relative min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain rounded-3xl border border-line bg-white/[0.02] p-4">
        {!msgs.length && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="grid h-full place-items-center text-center">
            <div>
              <motion.div animate={{ rotate: [0, 14, -8, 14, 0] }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.5 }} className="text-3xl">👋</motion.div>
              <p className="mt-2 text-sm text-muted">Say hi</p>
            </div>
          </motion.div>
        )}
        <AnimatePresence initial={false}>
          {msgs.map((m) => {
            const mine = m.sender_user_id === data.me;
            const p = person(m.sender_user_id);
            return (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.9, x: mine ? 24 : -24 }}
                animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                style={{ originX: mine ? 1 : 0 }}
                className={cx("flex", mine ? "justify-end" : "justify-start")}
                data-testid="chat-message"
              >
                <div className={cx("group max-w-[78%] rounded-3xl px-4 py-2.5 text-sm", mine ? "rounded-br-md bg-p text-ink shadow-[0_10px_30px_-12px_rgba(171,159,242,0.7)]" : "rounded-bl-md border border-line bg-white/[0.06] text-white")}>
                  {!mine && <div className="mb-0.5 text-xs font-bold text-p">{p?.brand_name ?? p?.display_name ?? p?.handle}</div>}
                  {m.body && <div className="whitespace-pre-wrap leading-relaxed">{m.body}</div>}
                  {(m.attachments ?? []).map((a: any) =>
                    a.mime?.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={a.path} src={a.url} alt={a.name} className="mt-2 max-h-60 rounded-2xl" />
                    ) : a.mime?.startsWith("video/") ? (
                      <video key={a.path} src={a.url} controls className="mt-2 max-h-60 rounded-2xl" />
                    ) : (
                      <a key={a.path} href={a.url} target="_blank" rel="noreferrer" className={cx("mt-2 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 font-medium", mine ? "bg-ink/10" : "bg-white/[0.06]")}>
                        <Paperclip className="h-3.5 w-3.5" /> {a.name}
                      </a>
                    ),
                  )}
                  <div className={cx("mt-1 flex items-center gap-2 text-[10px]", mine ? "justify-end text-ink/60" : "text-white/45")}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {mine && m.read_at && <span className="inline-flex items-center gap-0.5"><CheckCheck className="h-3 w-3" /> read</span>}
                    {!mine && (
                      <button disabled={!!busy} onClick={() => run(`rep-${m.id}`, async () => { await api(`/api/conversations/${id}`, { method: "PATCH", json: { messageId: m.id } }); await refetch(); }, "Reported to moderators", "Reporting this message…")} className={cx("inline-flex items-center gap-0.5 transition-opacity hover:text-p group-hover:opacity-100", busy === `rep-${m.id}` ? "opacity-100" : "opacity-0")}>
                        {busy === `rep-${m.id}` ? <Spinner className="h-3 w-3" /> : <Flag className="h-3 w-3" />} {busy === `rep-${m.id}` ? "reporting" : "report"}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="mt-3 shrink-0 space-y-2 pb-2">
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap gap-1.5 overflow-hidden">
              {files.map((f, i) => (
                <motion.span key={f.name + i} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.04 }} className="inline-flex items-center gap-1.5 rounded-full bg-p/15 px-3 py-1 text-xs font-medium text-p">
                  <Paperclip className="h-3 w-3" /> {f.name}
                </motion.span>
              ))}
              <button onClick={() => setFiles([])} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted hover:text-white"><X className="h-3 w-3" /> clear</button>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="glass flex items-end gap-2 rounded-3xl p-2 transition-shadow focus-within:shadow-[0_0_0_1px_rgba(171,159,242,0.5),0_0_40px_-10px_rgba(171,159,242,0.5)]">
          <label className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-2xl text-muted transition-colors hover:bg-white/[0.06] hover:text-p">
            <Paperclip className="h-4 w-4" />
            <input type="file" multiple accept="image/*,video/*,application/pdf" className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} data-testid="chat-files" />
          </label>
          <Textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message…" className="flex-1 border-transparent bg-transparent focus:border-transparent" data-testid="chat-input" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (text || files.length) send(); } }} />
          <Button loading={busy === "send"} disabled={!text && !files.length} onClick={send} data-testid="chat-send" className="h-11 shrink-0">
            <Send className="h-4 w-4" /> Send
          </Button>
        </div>
      </div>
    </div>
  );
}
