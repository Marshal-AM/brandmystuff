"use client";
import { DEMO, DEMO_ENABLED, demoFile } from "@/lib/client/demo";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, Loader2, Trash2, UploadCloud, Zap } from "lucide-react";
import { useSession } from "@/lib/client/session";
import { Button, EASE, Empty, Img, PageHeader, Skeleton, cx, useAction } from "@/components/ui";
import { SignInButtons } from "@/components/shell";

export default function BrandKit() {
  const { authenticated, api } = useSession();
  const { data, refetch, isLoading } = useQuery({ queryKey: ["brand-kit"], queryFn: () => api<any>("/api/brand-assets"), enabled: authenticated });
  const { busy, run } = useAction();
  const [drag, setDrag] = useState(false);
  if (!authenticated)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Empty title="Your brand kit">Sign in to upload logos and creatives you can put on any space.</Empty>
        <div className="mt-6 flex justify-center"><SignInButtons /></div>
      </div>
    );
  const upload = (file: File) =>
    run("up", async () => {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("name", file.name.replace(/\.[^.]+$/, ""));
      await api("/api/brand-assets", { method: "POST", body: fd });
      await refetch();
    }, "Added to brand kit");
  const uploading = busy === "up";
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader kicker="Brand kit" title="Your creatives, ready to print" sub="Logos and creatives you can put on any space. Owners download print-ready files in every size." />

      <motion.label
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
        className={cx("group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed px-6 py-10 text-center transition-colors", drag ? "border-p bg-p/10" : "border-line-strong bg-white/[0.02] hover:border-p/50")}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(rgba(171,159,242,0.25)_1px,transparent_1px)] [background-size:22px_22px]" />
        {uploading && <span aria-hidden className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-p to-transparent" style={{ animation: "scan-y 1.6s ease-in-out infinite" }} />}
        <motion.span animate={drag ? { scale: 1.15, rotate: -6 } : { scale: 1, rotate: 0 }} className="relative grid h-14 w-14 place-items-center rounded-2xl bg-p text-ink shadow-[0_0_40px_rgba(171,159,242,0.45)]">
          {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <UploadCloud className="h-6 w-6" />}
        </motion.span>
        <div className="relative mt-4 font-bold">{uploading ? "Uploading…" : drag ? "Drop it" : "Drop a file or click to upload"}</div>
        <div className="relative mt-1 text-sm text-muted">PNG, SVG, JPEG or WEBP · 1000 px+ or vector</div>
        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" data-testid="brand-upload" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </motion.label>
      {DEMO_ENABLED && (
        <div className="mt-3 flex justify-center">
          <Button variant="secondary" loading={uploading} onClick={async () => upload(await demoFile("logo"))} data-testid="brand-demo">
            <Zap className="h-4 w-4" /> Demo submit
          </Button>
        </div>
      )}

      <div className="mt-8 flex items-end justify-between">
        <h2 className="text-2xl font-extrabold tracking-tight">Assets</h2>
        <span className="text-sm text-muted">{data?.assets?.length ?? 0} in kit</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[4/5] rounded-3xl" />)}
        {!isLoading && !data?.assets?.length && (
          <div className="col-span-full"><Empty title="Your kit is empty">Upload a PNG, SVG, JPEG or WEBP (1000 px+ or vector).</Empty></div>
        )}
        <AnimatePresence mode="popLayout">
          {data?.assets?.map((a: any, i: number) => (
            <motion.div
              key={a.id}
              layout
              initial={{ opacity: 0, y: -40, scale: 0.85, rotate: -4 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.8, filter: "blur(6px)" }}
              transition={{ type: "spring", stiffness: 260, damping: 22, delay: i * 0.04 }}
              whileHover={{ y: -6 }}
              className="group relative overflow-hidden rounded-3xl border border-line bg-white/[0.03] p-3 transition-colors hover:border-p/40"
            >
              <div className="checker relative overflow-hidden rounded-2xl">
                <Img blob={a.blob_id} alt={a.name} className="aspect-square w-full object-contain transition-transform duration-700 group-hover:scale-105" />
              </div>
              <div className="mt-3 flex items-start justify-between gap-2 px-1">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{a.name}</div>
                  <div className="font-mono text-[11px] text-muted">{a.width}×{a.height}px</div>
                </div>
                <Button size="sm" variant="ghost" loading={busy === "d" + a.id} aria-label="Remove" onClick={() => run("d" + a.id, async () => { await api(`/api/brand-assets?id=${a.id}`, { method: "DELETE" }); refetch(); })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {!!data?.assets?.length && (
          <motion.label layout whileHover={{ y: -6 }} className="grid aspect-[4/5] cursor-pointer place-items-center rounded-3xl border border-dashed border-line-strong text-muted transition-colors hover:border-p/50 hover:text-p">
            <span className="flex flex-col items-center gap-2 text-sm font-semibold"><ImagePlus className="h-6 w-6" /> Add another</span>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </motion.label>
        )}
      </div>
    </div>
  );
}
