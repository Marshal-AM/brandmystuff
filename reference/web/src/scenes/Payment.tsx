import { AnimatePresence, animate, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { CHAIN, PUBLISHER_WALLETS, RESULTS, TOTAL, WALLET } from '../data'
import { rng, usdc, useSequence } from '../lib/hooks'
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

export function Payment({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>('review')
  const [cursor, setCursor] = useState({ x: 300, y: 560, show: false, press: false })
  const [confirm, setConfirm] = useState(0)
  const [paid, setPaid] = useState(0)
  const [balance, setBalance] = useState(WALLET.balance)
  const [closing, setClosing] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const approveRef = useRef<HTMLButtonElement>(null)

  // balance ticks down once the transfer lands
  useEffect(() => {
    if (step !== 'success') return
    const c = animate(WALLET.balance, WALLET.balance - TOTAL, { duration: 1.2, ease: EASE, onUpdate: setBalance })
    return () => c.stop()
  }, [step])

  useSequence(async ({ wait }) => {
    const moveTo = (el: HTMLElement | null) => {
      const m = modalRef.current
      if (!m || !el) return
      const mr = m.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      const scale = mr.width / m.offsetWidth || 1
      setCursor((c) => ({ ...c, show: true, x: (r.left - mr.left + r.width * 0.55) / scale, y: (r.top - mr.top + r.height * 0.55) / scale }))
    }

    await wait(1600)
    moveTo(approveRef.current)
    await wait(1000)
    setCursor((c) => ({ ...c, press: true }))
    await wait(160)
    setCursor((c) => ({ ...c, press: false }))
    setStep('signing')
    await wait(400)
    setCursor((c) => ({ ...c, show: false }))
    await wait(900)
    setStep('sending')
    await wait(700)
    for (let i = 1; i <= RESULTS.length; i++) {
      await wait(420)
      setPaid(i)
      if (i === 2) setConfirm(1)
    }
    await wait(500)
    setConfirm(2)
    await wait(350)
    setStep('success')
    await wait(3300)
    setClosing(true)
    await wait(650)
    onDone()
  })

  const sending = step === 'sending' || step === 'success'

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
              <b>{WALLET.name}</b>
              <span className="mono">{WALLET.address}</span>
            </div>
          </div>
          <span className="tx-net">
            <i />
            {CHAIN.name}
          </span>
        </div>
        <div className="tx-balance">
          <UsdcToken size={30} />
          <div>
            <span>Balance</span>
            <b className="mono">{usdc(balance, 2)}</b>
          </div>
        </div>

        <div className="tx-body">
          <AnimatePresence mode="wait" initial={false}>
            {!sending ? (
              <motion.div
                key="review"
                className="tx-pane"
                exit={{ opacity: 0, y: -12, filter: 'blur(4px)', transition: { duration: 0.25 } }}
              >
                <motion.div className="tx-origin" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <span className="tx-origin-ico">
                    <BotGlyph size={14} />
                  </span>
                  brandmystuff.app
                  <span className="tx-verified">
                    <Icon name="check" size={10} stroke={3.4} /> verified
                  </span>
                </motion.div>
                <motion.h3 className="tx-title" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
                  Approve transaction
                </motion.h3>

                <motion.div className="tx-send" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36, duration: 0.5, ease: EASE }}>
                  <UsdcToken size={44} />
                  <div>
                    <span>You send</span>
                    <b>−{usdc(TOTAL)}</b>
                  </div>
                </motion.div>

                <motion.div className="tx-rows" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44, duration: 0.5, ease: EASE }}>
                  <div>
                    <span>To</span>
                    <b>
                      BrandMyStuff Escrow <em className="mono">{CHAIN.escrow}</em>
                    </b>
                  </div>
                  <div>
                    <span>Split</span>
                    <b>{RESULTS.length} publishers</b>
                  </div>
                  <div>
                    <span>Network fee</span>
                    <b className="mono">{CHAIN.fee}</b>
                  </div>
                </motion.div>

                <motion.div className="tx-checks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                  <div>
                    <Icon name="check" size={12} stroke={3} /> Dry run passed · no risks found
                  </div>
                  <div>
                    <Icon name="check" size={12} stroke={3} /> Within spending policy · 6,000 USDC / campaign
                  </div>
                </motion.div>

                <div className="tx-actions">
                  <button className="tx-btn ghost" tabIndex={-1}>
                    Reject
                  </button>
                  <motion.button
                    ref={approveRef}
                    className={`tx-btn primary ${step === 'signing' ? 'is-signing' : ''}`}
                    tabIndex={-1}
                    animate={{ scale: cursor.press ? 0.96 : 1 }}
                  >
                    {step === 'signing' && (
                      <motion.i className="tx-sign-fill" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.2, ease: 'easeInOut' }} />
                    )}
                    <span className="tx-btn-in">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={step}
                          initial={{ y: 14, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -14, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
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
              </motion.div>
            ) : (
              <motion.div
                key="send"
                className="tx-pane tx-sending"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <CoinLoader done={step === 'success'} />

                <AnimatePresence mode="wait">
                  {step === 'sending' ? (
                    <motion.div key="p" className="tx-status" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                      <b>
                        Sending {usdc(TOTAL)}
                        <span className="tx-dots">
                          <i />
                          <i />
                          <i />
                        </span>
                      </b>
                      <span>Confirming on {CHAIN.name}</span>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="s"
                      className="tx-status is-success"
                      initial={{ opacity: 0, y: 10, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.15, duration: 0.5, ease: EASE }}
                    >
                      <b>Transaction confirmed</b>
                      <span className="mono">
                        digest {CHAIN.digest} · final in {CHAIN.finality}
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
                  {RESULTS.map((r, i) => {
                    const done = paid > i
                    return (
                      <motion.div
                        key={r.id}
                        className={`tx-payout ${done ? 'is-done' : ''}`}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + i * 0.05 }}
                      >
                        <span className="tx-payout-st">
                          <AnimatePresence mode="popLayout" initial={false}>
                            {done ? (
                              <motion.span
                                key="d"
                                initial={{ scale: 0, rotate: -90 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                              >
                                <Icon name="check" size={10} stroke={3.6} />
                              </motion.span>
                            ) : (
                              <motion.i key="s" className="tx-spin" exit={{ scale: 0 }} />
                            )}
                          </AnimatePresence>
                        </span>
                        <span className="tx-payout-name">{r.title}</span>
                        <span className="tx-payout-addr mono">{PUBLISHER_WALLETS[i]}</span>
                        <span className="tx-payout-amt mono">{r.price.toLocaleString('en-US')}</span>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="tx-foot">
          <Icon name="lock" size={12} stroke={2.4} />
          Non-custodial · signed by Scout&apos;s agent key
        </div>

        <Cursor {...cursor} />
      </motion.div>
    </motion.div>
  )
}
