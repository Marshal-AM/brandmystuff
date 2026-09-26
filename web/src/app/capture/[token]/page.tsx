"use client";
import { use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, CheckCircle2, Clock3, Loader2, RotateCcw, Send, X, XCircle } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { Button, EASE } from "@/components/ui";

interface LinkInfo {
  purpose: string;
  title: string;
  steps: string[];
  expiresAt: string;
  alreadyCaptured: boolean;
  photoCount: number;
}

interface Shot {
  blob: Blob;
  url: string;
}

/** Long side of a stored photograph. Phone sensors are 4000px and more; scoring needs a fraction. */
const MAX_EDGE = 1600;

/** Decode a photo from the phone's camera app. createImageBitmap where the
 *  browser has it (it respects EXIF rotation), an <img> everywhere else. */
async function decodeImage(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close() };
    } catch {
      /* Older Safari rejects some camera formats here; the <img> path below still reads them. */
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("unreadable");
  }
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}

/** Downscale any image source into a JPEG blob. */
async function toJpeg(source: CanvasImageSource, width: number, height: number): Promise<Blob> {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not take the photo"))), "image/jpeg", 0.85));
}

/**
 * The page a photo link opens on.
 *
 * Deliberately a CAMERA and not a file picker: the point is a photograph taken
 * there and then, not whatever is already in somebody's gallery. No sign-in:
 * the link is the credential, and it expires within the hour. Where the browser
 * will not give us a live camera (an insecure connection, an old phone) it falls
 * back to the phone's own camera app via `capture`.
 */
export default function CapturePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stage, setStage] = useState<"intro" | "camera" | "sending" | "done" | "refused">("intro");
  const [shots, setShots] = useState<Shot[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  /* The stream being open is not the same as frames arriving: Safari hands
     over the stream first and starts the picture a moment later. The shutter
     waits for the picture. */
  const [videoReady, setVideoReady] = useState(false);
  /* Safari may refuse to start the picture without a tap. */
  const [needsTap, setNeedsTap] = useState(false);
  const [starting, setStarting] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const photoCount = info?.photoCount ?? 1;
  const canUseLiveCamera = typeof window !== "undefined" && window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia);

  useEffect(() => {
    fetch(`/api/capture/${token}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "This link is not valid");
        setInfo(body);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : String(err)));
  }, [token]);

  const stopEverything = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stopEverything, [stopEverything]);

  async function openStream() {
    const attempts: MediaStreamConstraints[] = [
      { video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false },
      /* Some phones reject the size hints outright; the camera alone is enough. */
      { video: { facingMode: "environment" }, audio: false },
      { video: true, audio: false },
    ];
    let lastError: unknown;
    for (const constraints of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        lastError = err;
        /* A refusal is the person's answer, not a constraint problem; asking again only repeats the prompt. */
        if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError")) break;
      }
    }
    throw lastError;
  }

  async function startCamera() {
    setCameraError(null);
    setVideoReady(false);
    setNeedsTap(false);
    if (!canUseLiveCamera) {
      setLive(false);
      return;
    }
    setStarting(true);
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await openStream();
      streamRef.current = stream;
      /* A phone call, or another app taking the camera, ends the track; drop
         back to the camera-app button rather than leave a frozen frame. */
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        setLive(false);
        setVideoReady(false);
      });
      setLive(true);
    } catch (err) {
      setLive(false);
      const denied = err instanceof DOMException && err.name === "NotAllowedError";
      setCameraError(
        denied
          ? "Camera access was blocked. Allow it in your browser settings (Safari: aA → Website Settings → Camera), or use the button below to open your phone's camera."
          : "The camera could not be opened here. Use the button below to open your phone's camera.",
      );
    } finally {
      setStarting(false);
    }
  }

  async function start() {
    setStage("camera");
    /* Camera while the tap that asked for it is fresh; Safari is strictest about that. */
    await startCamera();
  }

  /* Attach the stream AFTER React has put the <video> on the page. Doing it
     from the code that opened the stream races the render: on Safari the
     element usually did not exist yet and the viewfinder stayed black. */
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!live || !video || !stream) return;
    if (video.srcObject !== stream) video.srcObject = stream;
    /* Set as properties too: React does not always write `muted` as an
       attribute, and iOS only plays an inline, muted video on its own. */
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.play().then(
      () => setNeedsTap(false),
      () => setNeedsTap(true),
    );
  }, [live, stage]);

  /* Coming back to the page (after checking a message, say) can leave iOS
     with a dead camera track. Reopen it quietly. */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || stage !== "camera" || !live) return;
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track || track.readyState === "ended") void startCamera();
      else void videoRef.current?.play().catch(() => setNeedsTap(true));
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  });

  function markReady() {
    const video = videoRef.current;
    if (video && video.videoWidth > 0) {
      setVideoReady(true);
      setNeedsTap(false);
    }
  }

  async function snap() {
    const video = videoRef.current;
    if (!video || shots.length >= photoCount) return;
    if (!video.videoWidth) {
      /* No picture yet: say so, rather than a shutter that does nothing. */
      setPhotoError("The camera is still starting. Try again in a moment.");
      void video.play().catch(() => setNeedsTap(true));
      return;
    }
    setPhotoError(null);
    try {
      const blob = await toJpeg(video, video.videoWidth, video.videoHeight);
      setFlash((n) => n + 1);
      setShots((prev) => [...prev, { blob, url: URL.createObjectURL(blob) }]);
    } catch {
      setPhotoError("That photo could not be taken. Try again.");
    }
  }

  async function fromCameraApp(file: File | undefined) {
    if (!file || shots.length >= photoCount) return;
    setPhotoError(null);
    try {
      const image = await decodeImage(file);
      const blob = await toJpeg(image.source, image.width, image.height);
      image.done();
      setShots((prev) => [...prev, { blob, url: URL.createObjectURL(blob) }]);
    } catch {
      setPhotoError("That photo could not be read. Try again, or set Settings → Camera → Formats to Most Compatible.");
    }
  }

  function removeShot(index: number) {
    setShots((prev) => {
      URL.revokeObjectURL(prev[index]!.url);
      return prev.filter((_, i) => i !== index);
    });
  }

  function retake() {
    shots.forEach((s) => URL.revokeObjectURL(s.url));
    setShots([]);
    setResult(null);
    setStage("camera");
    setPhotoError(null);
    if (!streamRef.current) void startCamera();
  }

  async function send() {
    setStage("sending");
    const form = new FormData();
    form.append("photo", shots[0]!.blob, "photo.jpg");
    try {
      const res = await fetch(`/api/capture/${token}`, { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setStage("done");
        stopEverything();
      } else {
        setResult(body.error ?? "The photo could not be sent");
        setStage("refused");
      }
    } catch {
      setResult("No connection. Check your signal and try again.");
      setStage("refused");
    }
  }

  /* ── The states that are not the camera ─────────────────────────────── */

  if (loadError) {
    return (
      <Frame>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-3xl bg-white/[0.06]"><XCircle className="h-8 w-8 text-white" /></span>
          <p className="text-base font-bold">{loadError}</p>
          <p className="max-w-xs text-sm text-muted">Go back to brandmystuff on your computer and press “Take photograph” again for a fresh link.</p>
        </motion.div>
      </Frame>
    );
  }

  if (!info) {
    return (
      <Frame>
        <div className="flex justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-p" />
        </div>
      </Frame>
    );
  }

  if (stage === "done") {
    return (
      <Frame>
        <Heading info={info} />
        <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 220, damping: 20 }} className="relative mt-6 flex flex-col items-center gap-3 overflow-hidden rounded-3xl border border-p/40 bg-p/[0.08] px-5 py-10 text-center">
          <div aria-hidden className="absolute -top-16 h-40 w-40 rounded-full bg-p/30 blur-3xl" />
          <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 14 }} className="relative grid h-16 w-16 place-items-center rounded-full bg-p text-ink shadow-[0_0_40px_rgba(171,159,242,0.6)]">
            <CheckCircle2 className="h-8 w-8" />
          </motion.span>
          <p className="relative text-lg font-extrabold">Photo sent</p>
          <p className="relative max-w-xs text-sm text-muted">It&apos;s already on your computer screen. You can close this page.</p>
        </motion.div>
      </Frame>
    );
  }

  /* ── The camera ─────────────────────────────────────────────────────── */

  const full = shots.length >= photoCount;

  return (
    <Frame>
      <Heading info={info} />

      {stage === "intro" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="mt-5 space-y-4">
          {info.alreadyCaptured && (
            <p className="rounded-2xl border border-p/40 bg-p/[0.08] px-3 py-2 text-sm">A photo has already been sent through this link. Taking a new one replaces it.</p>
          )}
          <ol className="glass space-y-3 rounded-3xl p-4 text-sm">
            {info.steps.map((s, i) => (
              <motion.li key={s} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.08 }} className="flex items-start gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-p text-xs font-extrabold text-ink">{i + 1}</span>
                <span className="pt-0.5 text-white/85">{s}</span>
              </motion.li>
            ))}
          </ol>
          <Button size="lg" className="w-full" onClick={start} data-testid="capture-start">
            <Camera className="h-5 w-5" /> Open camera
          </Button>
          <p className="text-center text-xs text-muted">Your browser will ask to use the camera.</p>
        </motion.div>
      )}

      {stage !== "intro" && (
        <div className="mt-4 space-y-4">
          {/* The viewfinder. */}
          <div className="relative aspect-[3/4] overflow-hidden rounded-3xl bg-black ring-1 ring-white/10">
            {full && shots[0] ? (
              <motion.img key={shots[0].url} src={shots[0].url} alt="Your photo" initial={{ scale: 1.08, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, ease: EASE }} className="h-full w-full object-cover" />
            ) : live ? (
              <>
                <video ref={videoRef} autoPlay playsInline muted onLoadedMetadata={markReady} onPlaying={markReady} onResize={markReady} className="h-full w-full object-cover" />
                {needsTap ? (
                  <button type="button" onClick={() => void videoRef.current?.play().then(markReady, () => setNeedsTap(true))} className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-white">
                    <Camera className="h-10 w-10" />
                    <span className="text-sm font-semibold">Tap to start the camera</span>
                  </button>
                ) : !videoReady ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-white/80" />
                  </div>
                ) : null}
              </>
            ) : starting ? (
              <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-white/80" />
              </div>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center text-white/80">
                <Camera className="h-10 w-10 text-p" />
                <p className="text-sm">{cameraError ?? "Tap below to open your phone's camera."}</p>
              </div>
            )}
            {/* viewfinder corners */}
            {!full && ["left-4 top-4 border-l-2 border-t-2", "right-4 top-4 border-r-2 border-t-2", "bottom-4 left-4 border-b-2 border-l-2", "bottom-4 right-4 border-b-2 border-r-2"].map((c) => (
              <span key={c} className={`pointer-events-none absolute h-7 w-7 rounded-sm border-p/80 ${c}`} />
            ))}
            <AnimatePresence>
              {flash > 0 && <motion.div key={flash} initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 0.45 }} className="pointer-events-none absolute inset-0 bg-white" />}
            </AnimatePresence>
            <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold tabular-nums text-white backdrop-blur">
              {full ? "Photo taken" : photoCount > 1 ? `Photo ${shots.length + 1} / ${photoCount}` : "Live camera"}
            </span>
            {full && stage === "camera" && (
              <button type="button" onClick={() => removeShot(0)} aria-label="Remove this photo" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {photoError && <p className="text-center text-sm text-p-200">{photoError}</p>}

          {stage === "refused" && result && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/20 bg-white/[0.04] px-4 py-3">
              <p className="flex items-start gap-2 text-sm font-bold"><XCircle className="mt-0.5 h-4 w-4 shrink-0" /> Not sent</p>
              <p className="mt-1 text-sm text-muted">{result}</p>
            </motion.div>
          )}

          {/* The controls. */}
          {stage === "camera" && !full && (
            <div className="flex flex-col items-center gap-3">
              {live && (
                <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => void snap()} disabled={!videoReady} aria-label="Take photo" data-testid="capture-shutter" className="relative grid h-20 w-20 touch-manipulation place-items-center rounded-full border-4 border-white/90 shadow-[0_0_40px_rgba(171,159,242,0.45)] disabled:opacity-40">
                  <span className="h-14 w-14 rounded-full bg-p" />
                </motion.button>
              )}
              {/* The phone's own camera app: the main control when there is no
                  live camera, and a way out underneath it when there is.
                  A <label> rather than a script-triggered click, because iOS
                  opens the camera reliably only from a real tap on the input. */}
              <label className={live ? "cursor-pointer text-center text-sm font-medium text-muted underline underline-offset-4" : "inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-p px-6 text-base font-semibold text-ink"}>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => {
                    void fromCameraApp(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                {!live && <Camera className="h-5 w-5" />}
                {live ? "Camera not working? Use the phone's camera app" : "Open camera"}
              </label>
              {!live && canUseLiveCamera && cameraError && (
                <button type="button" onClick={() => void startCamera()} className="text-sm font-medium text-muted underline underline-offset-4">
                  Try the live camera again
                </button>
              )}
            </div>
          )}

          {(full || stage === "sending" || stage === "refused") && (
            <div className="space-y-2">
              <Button size="lg" className="w-full" onClick={() => void send()} disabled={stage === "sending" || !full} loading={stage === "sending"} data-testid="capture-send">
                {stage !== "sending" && <Send className="h-5 w-5" />}
                {stage === "sending" ? "Sending…" : stage === "refused" ? "Try again" : "Use this photo"}
              </Button>
              {stage !== "sending" && (
                <Button variant="secondary" className="w-full" onClick={retake}>
                  <RotateCcw className="h-4 w-4" /> Retake
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Frame>
  );
}

/* ── Pieces ──────────────────────────────────────────────────────────── */

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-ink">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-p/20 blur-3xl" />
      <main className="relative mx-auto w-full max-w-md px-4 pb-10 pt-6">
        <div className="mb-6 flex items-center gap-2">
          <LogoMark size={28} />
          <span className="text-sm font-extrabold tracking-tight">brandmystuff</span>
          <span className="ml-auto rounded-full border border-p/25 bg-p/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-p">Camera</span>
        </div>
        {children}
      </main>
    </div>
  );
}

function Heading({ info }: { info: LinkInfo }) {
  return (
    <header>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Photo link</p>
      <h1 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight">{info.title}</h1>
      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted">
        <Clock3 className="h-3.5 w-3.5" />
        Link valid until {new Date(info.expiresAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
      </p>
    </header>
  );
}
