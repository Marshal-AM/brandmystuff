"use client";
import { AnimatePresence, animate, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { CHAIN, pickOf, short, useScout } from '../data'
import type { ScoutPaymentStep } from '@/lib/scout/types'
import { rng, usdc } from '../lib/hooks'
import './payment.css'

type Step = 'review' | 'signing' | 'sending' | 'success'

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]
const CONFIRM = CHAIN.stages

function UsdcMark({ size = 40, ink = 'var(--p-800)' }: { size?: number; ink?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M12.2 7.6a9.4 9.4 0 0 0 0 16.8" fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M19.8 7.6a9.4 9.4 0 0 1 0 16.8" fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
      <text x="16" y="21.4" textAnchor="middle" fontSize="15" fontWeight="800" fill={ink} fontFamily="Plus Jakarta Sans, sans-serif">
        $
      </text>
    </svg>
  )
}

function UsdcToken({ size = 40 }: { size?: number }) {
  return (
    <span className="tx-token" style={{ width: size, height: size }}>
      <UsdcMark size={size * 0.78} />
    </span>
  )
}

function BotGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <rect x="3" y="5" width="18" height="13" rx="6.5" fill="var(--ink)" />
      <rect x="8" y="9" width="2.6" height="5" rx="1.3" fill="var(--p)" />
      <rect x="13.4" y="9" width="2.6" height="5" rx="1.3" fill="var(--p)" />
    </svg>
  )
}

function Cursor({ x, y, show, press }: { x: number; y: number; show: boolean; press: boolean }) {
  return (
    <motion.div
      className="tx-cursor"
      initial={{ x: 300, y: 560, opacity: 0 }}
      animate={{ x, y, opacity: show ? 1 : 0, scale: press ? 0.82 : 1 }}
      transition={{ x: { type: 'spring', stiffness: 70, damping: 16 }, y: { type: 'spring', stiffness: 70, damping: 16 }, scale: { duration: 0.12 }, opacity: { duration: 0.3 } }}
    >
      <svg width="22" height="24" viewBox="0 0 22 24">
        <path d="M2 2 L19 11 L11 13 L7 21 Z" fill="#fff" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <span className="tx-cursor-tag">
        <BotGlyph size={12} />
        Scout
      </span>
      <AnimatePresence>
        {press && (
          <motion.span
            key="ripple"
            className="tx-ripple"
            initial={{ scale: 0, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/**
 * A USDC coin that stays put while white speed streaks rush past it over a
 * background of moving colour streaks. Flips to a check once finalized.
 */
function CoinLoader({ done }: { done: boolean }) {
  const lines = useMemo(() => {
    const r = rng(11)
    return Array.from({ length: 14 }, () => ({
      top: 8 + r() * 84,
      w: 30 + r() * 90,
      dur: 0.45 + r() * 0.5,
      delay: -r() * 1,
      o: 0.35 + r() * 0.65,
      h: r() > 0.7 ? 3 : 2,
    }))
  }, [])
  const streaks = useMemo(() => {
    const r = rng(4)
    return Array.from({ length: 5 }, (_, i) => ({ top: 5 + i * 20 + r() * 8, dur: 1.6 + r() * 1.2, delay: -r() * 2, h: 30 + r() * 40 }))
  }, [])

  return (
    <div className={`tx-stage ${done ? 'is-done' : ''}`}>
      <div className="tx-streaks">
        {streaks.map((s, i) => (
          <i key={i} style={{ top: `${s.top}%`, height: s.h, animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }} />
        ))}
      </div>
      <div className="tx-lines">
        {lines.slice(0, 10).map((l, i) => (
          <i key={i} style={{ top: `${l.top}%`, width: l.w, height: l.h, opacity: l.o, animationDuration: `${l.dur}s`, animationDelay: `${l.delay}s` }} />
        ))}
      </div>

      <div className="tx-coin-wrap">
        <div className="tx-trail">
          <i style={{ top: '30%' }} />
          <i style={{ top: '50%' }} />
          <i style={{ top: '70%' }} />
        </div>
        <motion.div
          className="tx-coin-flip"
          animate={{ rotateY: done ? 540 : 0, scale: done ? [1, 1.25, 1] : 1 }}
          transition={{ duration: 1.1, ease: [0.34, 1.2, 0.64, 1] }}
        >
          <div className="tx-coin">
            {[-4, -2, 0, 2, 4].map((z) => (
              <span key={z} className="tx-coin-edge" style={{ transform: `translateZ(${z}px)` }} />
            ))}
            <span className="tx-coin-face front">
              <UsdcMark size={58} />
            </span>
            <span className="tx-coin-face back">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            </span>
          </div>
        </motion.div>
        <div className="tx-coin-shadow" />
      </div>

      <div className="tx-lines front">
        {lines.slice(10).map((l, i) => (
          <i
            key={i}
            style={{ top: `${l.top}%`, width: l.w * 1.3, height: l.h, opacity: l.o * 0.7, animationDuration: `${l.dur * 0.7}s`, animationDelay: `${l.delay}s` }}
          />
        ))}
      </div>

      <AnimatePresence>
        {done &&
          [0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="tx-burst"
              initial={{ scale: 0.4, opacity: 0.9 }}
              animate={{ scale: 3 + i, opacity: 0 }}
              transition={{ duration: 1.2, delay: 0.5 + i * 0.12, ease: 'easeOut' }}
            />
          ))}
      </AnimatePresence>
    </div>
  )
}

const STEP_ORDER: ScoutPaymentStep['key'][] = ['quote', 'mandate', 'sign', 'submit', 'settle', 'book']
const STEP_PLACEHOLDER: Record<ScoutPaymentStep['key'], string> = {
  quote: 'Requesting the x402 quote',
  mandate: 'Checking the budget mandate',
  sign: 'Signing mandate::spend with the agent key',
  submit: 'Submitting PAYMENT-SIGNATURE',
  settle: 'Settling on Sui',
  book: 'Booking the lease',
}
/** Minimum time each real step stays on screen, so fast steps still read. */
const MIN_STEP_MS = 850

/**
 * One x402 payment from Scout's budget mandate, driven by the real steps the agent streams:
 * quote (402) → mandate check → sign → submit → settle on Sui → lease booked.
 */
export function Payment({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const live = useScout()
  const pay = live.payment
  const pick = pickOf(live)
  const mandate = live.mandate
  const amount = pay.amount ?? pick?.price ?? 0
  const failed = pay.status === 'failed'

  // play the streamed steps back one at a time
  const [shown, setShown] = useState(0)
  const lastAt = useRef(0)
  useEffect(() => {
    if (shown >= pay.steps.length) return
    const wait = Math.max(0, MIN_STEP_MS - (performance.now() - lastAt.current))
    const id = window.setTimeout(() => {
      lastAt.current = performance.now()
      setShown((n) => n + 1)
    }, shown === 0 ? 900 : wait)
    return () => window.clearTimeout(id)
  }, [shown, pay.steps.length])
  const seen = pay.steps.slice(0, shown)
  const has = (k: ScoutPaymentStep['key']) => seen.some((s) => s.key === k)
  const allShown = shown >= pay.steps.length
  const success = pay.status === 'done' && allShown && has('book')

  const step: Step = success ? 'success' : has('submit') ? 'sending' : has('sign') ? 'signing' : 'review'
  const confirm = has('book') || success ? 2 : has('settle') ? 1 : 0

  const [cursor, setCursor] = useState({ x: 300, y: 560, show: false, press: false })
  const [balance, setBalance] = useState(mandate?.remaining ?? 0)
  const [closing, setClosing] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const approveRef = useRef<HTMLButtonElement>(null)

  // the agent's "cursor" moves to Approve once the quote is in, and presses it when it signs
  useEffect(() => {
    const m = modalRef.current
    const el = approveRef.current
    if (!m || !el) return
    if (step === 'review' && has('quote')) {
      const mr = m.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      const scale = mr.width / m.offsetWidth || 1
      setCursor((c) => ({ ...c, show: true, x: (r.left - mr.left + r.width * 0.55) / scale, y: (r.top - mr.top + r.height * 0.55) / scale }))
    }
    if (step === 'signing') {
      setCursor((c) => ({ ...c, press: true }))
      const a = window.setTimeout(() => setCursor((c) => ({ ...c, press: false })), 160)
      const b = window.setTimeout(() => setCursor((c) => ({ ...c, show: false })), 560)
      return () => {
        window.clearTimeout(a)
        window.clearTimeout(b)
      }
    }
  }, [step, shown]) // eslint-disable-line react-hooks/exhaustive-deps

  // mandate balance ticks down once the transfer lands
  useEffect(() => {
    if (!success) return
    const from = mandate?.remaining != null && pay.remainingAfter != null && mandate.remaining === pay.remainingAfter ? pay.remainingAfter + amount : balance
    const to = pay.remainingAfter ?? Math.max(0, from - amount)
    const c = animate(from, to, { duration: 1.2, ease: EASE, onUpdate: setBalance })
    return () => c.stop()
  }, [success]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!success) return
    const a = window.setTimeout(() => setClosing(true), 3300)
    const b = window.setTimeout(() => onDone(), 3950)
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [success, onDone])

  const sending = step === 'sending' || step === 'success'
  const digestShort = pay.digest ? short(pay.digest, 5) : '…'

  return (
    <motion.div className="tx-overlay" initial={{ opacity: 0 }} animate={{ opacity: closing ? 0 : 1 }} transition={{ duration: 0.5 }}>
      <motion.div
        ref={modalRef}
        className="tx-modal"
        initial={{ opacity: 0, y: 40, scale: 0.92 }}
        animate={closing ? { opacity: 0, y: 30, scale: 0.94 } : { opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      >
        <div className="tx-head">
          <div className="tx-acct">
            <span className="tx-avatar">
              <BotGlyph size={20} />
            </span>
            <div>
              <b>Scout · {live.brand.short}</b>
              <span className="mono">{short(pay.payer ?? mandate?.agent)}</span>
            </div>
          </div>
          <span className="tx-net">
            <i />
            {CHAIN.name} testnet
          </span>
        </div>
        <div className="tx-balance">
          <UsdcToken size={30} />
          <div>
            <span>Mandate left</span>
            <b className="mono">{usdc(balance, 2)}</b>
          </div>
        </div>

        <div className="tx-body">
          <AnimatePresence mode="wait" initial={false}>
            {!sending ? (
              <motion.div key="review" className="tx-pane" exit={{ opacity: 0, y: -12, filter: 'blur(4px)', transition: { duration: 0.25 } }}>
                <motion.div className="tx-origin" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <span className="tx-origin-ico">
                    <BotGlyph size={14} />
                  </span>
                  x402 · /api/x402/leases
                  <span className="tx-verified">
                    <Icon name="check" size={10} stroke={3.4} /> {has('quote') ? '402 received' : 'requesting'}
                  </span>
                </motion.div>
                <motion.h3 className="tx-title" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
                  Approve x402 payment
                </motion.h3>

                <motion.div className="tx-send" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36, duration: 0.5, ease: EASE }}>
                  <UsdcToken size={44} />
                  <div>
                    <span>Scout pays</span>
                    <b>−{usdc(amount)}</b>
                  </div>
                </motion.div>

                <motion.div className="tx-rows" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44, duration: 0.5, ease: EASE }}>
                  <div>
                    <span>To</span>
                    <b>
                      brandmystuff escrow <em className="mono">{short(pay.payTo)}</em>
                    </b>
                  </div>
                  <div>
                    <span>For</span>
                    <b>{pick ? `${pick.title} · 1 ${pick.unit}` : 'Ad space lease'}</b>
                  </div>
                  <div>
                    <span>From</span>
                    <b>
                      Budget mandate <em className="mono">{short(mandate?.id)}</em>
                    </b>
                  </div>
                </motion.div>

                <motion.div className="tx-checks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                  <div style={{ opacity: has('quote') ? 1 : 0.4 }}>
                    <Icon name="check" size={12} stroke={3} /> {seen.find((s) => s.key === 'quote')?.detail ?? 'Waiting for the 402 quote'}
                  </div>
                  <div style={{ opacity: has('mandate') ? 1 : 0.4 }}>
                    <Icon name="check" size={12} stroke={3} />{' '}
                    {seen.find((s) => s.key === 'mandate')?.detail ?? (mandate ? `Within mandate · cap ${usdc(mandate.perAdCap)} per ad` : 'Checking the mandate')}
                  </div>
                </motion.div>

                {failed && allShown ? (
                  <div className="tx-fail">
                    <b>Payment stopped</b>
                    <span>{pay.error}</span>
                    <button className="tx-btn ghost" onClick={onClose}>
                      Close
                    </button>
                  </div>
                ) : (
                  <div className="tx-actions">
                    <button className="tx-btn ghost" tabIndex={-1}>
                      Reject
                    </button>
                    <motion.button ref={approveRef} className={`tx-btn primary ${step === 'signing' ? 'is-signing' : ''}`} tabIndex={-1} animate={{ scale: cursor.press ? 0.96 : 1 }}>
                      {step === 'signing' && <motion.i className="tx-sign-fill" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.2, ease: 'easeInOut' }} />}
                      <span className="tx-btn-in">
                        <AnimatePresence mode="popLayout" initial={false}>
                          <motion.span key={step} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ duration: 0.3 }}>
                            {step === 'signing' ? (
                              <>
                                <Icon name="key" size={14} stroke={2.4} /> Signing…
                              </>
                            ) : (
                              'Approve'
                            )}
                          </motion.span>
                        </AnimatePresence>
                      </span>
                    </motion.button>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key="send" className="tx-pane tx-sending" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: EASE }}>
                <CoinLoader done={step === 'success'} />

                <AnimatePresence mode="wait">
                  {failed && allShown ? (
                    <motion.div key="f" className="tx-status" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      <b>Payment stopped</b>
                      <span>{pay.error}</span>
                    </motion.div>
                  ) : step === 'sending' ? (
                    <motion.div key="p" className="tx-status" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                      <b>
                        Sending {usdc(amount)}
                        <span className="tx-dots">
                          <i />
                          <i />
                          <i />
                        </span>
                      </b>
                      <span>Confirming on {CHAIN.name}</span>
                    </motion.div>
                  ) : (
                    <motion.div key="s" className="tx-status is-success" initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.15, duration: 0.5, ease: EASE }}>
                      <b>Paid · lease booked</b>
                      <span className="mono">
                        {pay.digest ? (
                          <a href={`${CHAIN.explorer}/tx/${pay.digest}`} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
                            digest {digestShort} ↗
                          </a>
                        ) : (
                          'settled'
                        )}
                        {pay.leaseEns ? ` · ${pay.leaseEns}` : ''}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="tx-confirm">
                  <div className="tx-confirm-track">
                    <motion.i animate={{ scaleX: confirm / (CONFIRM.length - 1) }} transition={{ duration: 0.6, ease: EASE }} />
                  </div>
                  {CONFIRM.map((c, i) => (
                    <div key={c} className={`tx-confirm-step ${confirm >= i ? 'is-on' : ''}`}>
                      <span />
                      {c}
                    </div>
                  ))}
                </div>

                <div className="tx-payouts">
                  {STEP_ORDER.map((k, i) => {
                    const s = seen.find((x) => x.key === k)
                    const done = !!s
                    const next = !done && seen.length === i && !(failed && allShown)
                    return (
                      <motion.div key={k} className={`tx-payout ${done ? 'is-done' : ''}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: done || next ? 1 : 0.45, x: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
                        <span className="tx-payout-st">
                          <AnimatePresence mode="popLayout" initial={false}>
                            {done ? (
                              <motion.span key="d" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}>
                                <Icon name="check" size={10} stroke={3.6} />
                              </motion.span>
                            ) : next ? (
                              <motion.i key="s" className="tx-spin" exit={{ scale: 0 }} />
                            ) : (
                              <motion.i key="w" className="tx-wait" />
                            )}
                          </AnimatePresence>
                        </span>
                        <span className="tx-payout-name">{s?.label ?? STEP_PLACEHOLDER[k]}</span>
                        <span className="tx-payout-addr mono">{s?.detail ?? ''}</span>
                        <span className="tx-payout-amt mono">{k === 'settle' && done ? amount.toLocaleString('en-US', { maximumFractionDigits: 4 }) : ''}</span>
                      </motion.div>
                    )
                  })}
                </div>
                {failed && allShown && (
                  <button className="tx-btn ghost" style={{ marginTop: 12, width: '100%' }} onClick={onClose}>
                    Close
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="tx-foot">
          <Icon name="lock" size={12} stroke={2.4} />
          Paid over x402 · signed by Scout&apos;s agent key, capped by the on-chain mandate
        </div>

        <Cursor {...cursor} />
      </motion.div>
    </motion.div>
  )
}
