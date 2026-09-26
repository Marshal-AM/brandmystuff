"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Check, Clock3, Copy, ExternalLink, Link2, Loader2, RotateCcw, Share2, Smartphone, Zap } from "lucide-react";
import QRCode from "qrcode";
import { DEMO_ENABLED, demoFile } from "@/lib/client/demo";
import { useSession } from "@/lib/client/session";
import { Button, EASE, cx } from "./ui";

export type CapturePurpose = "hero" | "space" | "proof" | "kyc";

type LinkStatus = { id: string; expiresAt: string; expired: boolean; revoked: boolean; captured: boolean; attempts: number; lastRejectReason: string | null };

const POLL_MS = 3000;
const captureUrl = (token: string) => `${window.location.origin}/capture/${token}`;

/**
 * A photograph taken with a live camera, never picked from a gallery.
 *
 * "Take photograph" creates a one-time photo link. Opened on a phone (or this
 * device), it shows a camera; the shot comes back here by polling and is handed
 * to `onChange` as a camera capture.
 */
export function PhotoCapture({
  purpose,
  onChange,
  label = "Photo",
  preview,
  testId,
  scanning,
  onDemo,
}: {
  purpose: CapturePurpose;
  /** `linkId` lets the server confirm the photo really came from this camera link. */
  onChange: (f: File, source: "camera", linkId: string) => void;
  label?: string;
  preview?: string | null;
  testId?: string;
  scanning?: boolean;
  /** Called after "Demo submit" loads the sample photo; parents submit it straight away in demo mode. */
  onDemo?: (f: File) => void | Promise<void>;
}) {
  const { api, token: authToken } = useSession();
  const [token, setToken] = useState<string | null>(null);
  const [link, setLink] = useState<LinkStatus | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const received = useRef<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [demoing, setDemoing] = useState(false);
  useEffect(() => {
    if (!token) return setQr(null);
    QRCode.toDataURL(captureUrl(token), { margin: 1, width: 240, color: { dark: "#0b0816", light: "#ffffff" } }).then(setQr).catch(() => setQr(null));
  }, [token]);
  const runDemo = async () => {
    setDemoing(true);
    setError(null);
    try {
      const file = await demoFile(purpose);
      setToken(null);
      setLink(null);
      onChangeRef.current(file, "camera", "demo");
      await onDemo?.(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Demo submit failed");
    } finally {
      setDemoing(false);
    }
  };
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const createLink = async () => {
    setCreating(true);
    setError(null);
    setCopied(false);
    try {
      const created = await api<{ id: string; token: string; expiresAt: string }>("/api/capture-links", { method: "POST", json: { purpose } });
      received.current = null;
      setToken(created.token);
      setLink({ id: created.id, expiresAt: created.expiresAt, expired: false, revoked: false, captured: false, attempts: 0, lastRejectReason: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the link");
    } finally {
      setCreating(false);
    }
  };

  const fetchPhoto = useCallback(
    async (id: string) => {
      const t = await authToken();
      const res = await fetch(`/api/capture-links/${id}/photo`, { headers: t ? { authorization: `Bearer ${t}` } : {}, credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error("Could not fetch the photo");
      const blob = await res.blob();
      onChangeRef.current(new File([blob], `photo-${Date.now()}.jpg`, { type: blob.type || "image/jpeg" }), "camera", id);
    },
    [authToken],
  );

  // Poll the link until the photo arrives (or the link dies).
  const waiting = !!link && !link.captured && !link.expired && !link.revoked;
  useEffect(() => {
    if (!waiting || !link) return;
    let cancelled = false;
    const read = async () => {
      try {
        const r = await api<{ link: LinkStatus }>(`/api/capture-links/${link.id}`);
        if (cancelled) return;
        setLink(r.link);
        if (r.link.captured && received.current !== r.link.id) {
          received.current = r.link.id;
          await fetchPhoto(r.link.id);
          setToken(null);
        }
      } catch {
        /* transient; try again next tick */
      }
    };
    const timer = window.setInterval(read, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [waiting, link?.id, api, fetchPhoto]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(captureUrl(token));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy. Select the link and copy it yourself");
    }
  };
  const share = async () => {
    if (!token) return;
    try {
      await navigator.share({ title: "brandmystuff photo link", text: "Open this on your phone to take the photo", url: captureUrl(token) });
    } catch {
      /* dismissed */
    }
  };
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const state = preview && !waiting ? "done" : waiting ? "waiting" : link && (link.expired || link.revoked) ? "dead" : "idle";

  return (
    <div className="space-y-2">
      <span className="text-[13px] font-semibold text-white/80">{label}</span>
      <div className="flex flex-col items-stretch gap-4 rounded-3xl border border-dashed border-line-strong bg-white/[0.02] p-3 sm:flex-row sm:items-center">
        <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-2xl bg-white/[0.03] sm:h-32 sm:w-32">
          <AnimatePresence mode="popLayout" initial={false}>
            {preview ? (
              <motion.img key={preview} src={preview} alt="preview" className="h-full w-full object-cover" initial={{ opacity: 0, scale: 1.15, filter: "blur(10px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease: EASE }} />
            ) : (
              <motion.div key="empty" className="grid h-full w-full place-items-center text-p" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {waiting ? (
                  <span className="relative grid place-items-center">
                    <span className="absolute h-14 w-14 animate-ping rounded-full bg-p/20" />
                    <Smartphone className="relative h-8 w-8" strokeWidth={1.6} />
                  </span>
                ) : (
                  <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 2.4, repeat: Infinity }}>
                    <Camera className="h-8 w-8" strokeWidth={1.6} />
                  </motion.span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          {scanning && preview && (
            <>
              <div className="absolute inset-0 bg-p/10" />
              <div className="absolute inset-x-0 h-1 bg-p shadow-[0_0_20px_4px_var(--p)] [animation:scan-y_1.6s_ease-in-out_infinite]" />
            </>
          )}
          {["left-2 top-2 border-l-2 border-t-2", "right-2 top-2 border-r-2 border-t-2", "bottom-2 left-2 border-b-2 border-l-2", "bottom-2 right-2 border-b-2 border-r-2"].map((c) => (
            <span key={c} className={cx("absolute h-4 w-4 rounded-sm border-p/70", c)} />
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            {state === "waiting" && token ? (
              <motion.div key="waiting" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-2.5">
                {qr && (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qr} alt="QR code for the photo link" className="h-28 w-28 shrink-0 rounded-xl bg-white p-1.5 shadow-[0_0_30px_-8px_rgba(171,159,242,0.6)]" data-testid={testId ? `${testId}-qr` : undefined} />
                    <p className="text-xs text-muted">Scan with your phone&apos;s camera to open the photo link, or copy it below.</p>
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-2xl border border-line-strong bg-white/[0.04] py-1.5 pl-3 pr-1.5">
                  <Link2 className="h-4 w-4 shrink-0 text-p" />
                  <input readOnly value={captureUrl(token)} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 bg-transparent font-mono text-xs text-white/85 outline-none" data-testid={testId ? `${testId}-link` : undefined} />
                  <button type="button" onClick={copy} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-p px-3 text-xs font-bold text-ink">
                    {copied ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canShare && (
                    <Button type="button" size="sm" variant="secondary" onClick={share}>
                      <Share2 className="h-3.5 w-3.5" /> Share
                    </Button>
                  )}
                  <a href={captureUrl(token)} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong bg-white/[0.04] px-3.5 text-xs font-semibold transition-colors hover:border-p/50 hover:bg-p/10">
                    <ExternalLink className="h-3.5 w-3.5" /> Open camera on this device
                  </a>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-p">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for the photo…
                  </span>
                  <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> valid until {new Date(link!.expiresAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                  <button type="button" onClick={createLink} className="font-semibold text-white/70 underline-offset-4 hover:text-white hover:underline">New link</button>
                  {DEMO_ENABLED && (
                    <button type="button" onClick={runDemo} disabled={demoing} className="inline-flex items-center gap-1 font-semibold text-p underline-offset-4 hover:underline disabled:opacity-50">
                      <Zap className="h-3 w-3" /> Demo submit
                    </button>
                  )}
                </div>
                {link?.lastRejectReason && <p className="text-xs text-p-200">Last try: {link.lastRejectReason}</p>}
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-2">
                {state === "done" ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-p"><Check className="h-4 w-4" strokeWidth={3} /> Photo received from the camera</span>
                    <Button type="button" variant="secondary" onClick={createLink} loading={creating} data-testid={testId}>
                      <RotateCcw className="h-4 w-4" /> Retake photograph
                    </Button>
                    {DEMO_ENABLED && (
                      <Button type="button" variant="ghost" onClick={runDemo} loading={demoing || scanning}>
                        <Zap className="h-4 w-4" /> Demo submit
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    {state === "dead" && <span className="text-xs text-p-200">That link has expired. Make a new one.</span>}
                    <Button type="button" onClick={createLink} loading={creating} data-testid={testId}>
                      <Camera className="h-4 w-4" /> Take photograph
                    </Button>
                    {DEMO_ENABLED && (
                      <Button type="button" variant="secondary" onClick={runDemo} loading={demoing || scanning} data-testid={testId ? `${testId}-demo` : undefined}>
                        <Zap className="h-4 w-4" /> Demo submit
                      </Button>
                    )}
                    <span className="text-center text-[11px] text-faint sm:text-left">You&apos;ll get a link. Open it on your phone and take the photo with its camera.</span>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          {error && <p className="mt-2 text-xs text-p-200">{error}</p>}
        </div>
      </div>
    </div>
  );
}
