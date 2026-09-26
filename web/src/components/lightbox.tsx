"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { blobUrl } from "@/lib/deployment";
import { EASE, cx } from "./ui";

export type LightboxImage = { blob?: string | null; src?: string; label?: string };
const srcOf = (i: LightboxImage) => i.src ?? (i.blob ? blobUrl(i.blob) : "");

/** Full-screen image preview: centred, zoomed in, with arrows, thumbnails and keyboard control. */
export function Lightbox({ images, index, onClose }: { images: LightboxImage[]; index: number | null; onClose: () => void }) {
  const [i, setI] = useState(index ?? 0);
  const [dir, setDir] = useState(0);
  const [prevIndex, setPrevIndex] = useState(index);
  // Reset to the tapped image whenever the lightbox is (re)opened.
  if (index !== prevIndex) {
    setPrevIndex(index);
    if (index != null) setI(index);
  }
  const open = index != null && images.length > 0;
  const go = useCallback((d: number) => {
    setDir(d);
    setI((x) => (x + d + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && images.length > 1) go(1);
      if (e.key === "ArrowLeft" && images.length > 1) go(-1);
    };
    window.addEventListener("keydown", h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, go, images.length]);

  if (typeof document === "undefined") return null;
  const cur = images[Math.min(i, images.length - 1)];
  return createPortal(
    <AnimatePresence>
      {open && cur && (
        <motion.div key="lb" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="fixed inset-0 z-[90] flex flex-col bg-ink/90 backdrop-blur-xl" onClick={onClose}>
          {/* top bar */}
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-4 sm:px-6" onClick={(e) => e.stopPropagation()}>
            <div className="min-w-0 text-sm">
              {cur.label && <span className="font-bold text-white">{cur.label}</span>}
              {images.length > 1 && <span className="ml-2 font-mono text-xs text-muted">{i + 1} / {images.length}</span>}
            </div>
            <div className="flex items-center gap-2">
              <a href={srcOf(cur)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white/[0.07] px-4 text-xs font-semibold text-white/80 transition-colors hover:bg-white/15 hover:text-white">
                <ExternalLink className="h-3.5 w-3.5" /> Open original
              </a>
              <motion.button whileHover={{ rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={onClose} aria-label="Close preview" className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.07] text-white/80 hover:bg-white/15 hover:text-white">
                <X className="h-4 w-4" />
              </motion.button>
            </div>
          </div>

          {/* image */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4 sm:px-20">
            <AnimatePresence mode="popLayout" custom={dir} initial={false}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <motion.img
                key={srcOf(cur)}
                src={srcOf(cur)}
                alt={cur.label ?? ""}
                custom={dir}
                variants={{
                  enter: (d: number) => ({ opacity: 0, scale: d === 0 ? 0.85 : 0.96, x: d * 80 }),
                  center: { opacity: 1, scale: 1, x: 0 },
                  exit: (d: number) => ({ opacity: 0, scale: 0.96, x: d * -80 }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.4, ease: EASE }}
                onClick={(e) => e.stopPropagation()}
                className="max-h-full max-w-full select-none rounded-2xl object-contain shadow-[0_40px_120px_rgba(0,0,0,0.8)] ring-1 ring-white/10"
                draggable={false}
              />
            </AnimatePresence>
            {images.length > 1 && (
              <>
                <NavBtn side="left" onClick={() => go(-1)}><ChevronLeft className="h-5 w-5" /></NavBtn>
                <NavBtn side="right" onClick={() => go(1)}><ChevronRight className="h-5 w-5" /></NavBtn>
              </>
            )}
          </div>

          {/* thumbnails */}
          {images.length > 1 && (
            <div className="flex shrink-0 justify-center gap-2 overflow-x-auto px-4 pb-5" onClick={(e) => e.stopPropagation()}>
              {images.map((im, k) => (
                <button key={k} onClick={() => { setDir(k > i ? 1 : -1); setI(k); }} className={cx("relative h-14 w-14 shrink-0 overflow-hidden rounded-xl transition-all", k === i ? "ring-2 ring-p" : "opacity-50 ring-1 ring-white/10 hover:opacity-90")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={srcOf(im)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function NavBtn({ side, onClick, children }: { side: "left" | "right"; onClick: () => void; children: ReactNode }) {
  return (
    <motion.button
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={side === "left" ? "Previous image" : "Next image"}
      className={cx("absolute top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/[0.08] text-white backdrop-blur transition-colors hover:bg-p hover:text-ink", side === "left" ? "left-3 sm:left-6" : "right-3 sm:right-6")}
    >
      {children}
    </motion.button>
  );
}
