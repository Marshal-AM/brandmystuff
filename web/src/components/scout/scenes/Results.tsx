"use client";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useEffect, useState, type MouseEvent } from 'react'
import { Bot } from '../components/Bot'
import { Icon } from '../components/Icon'
import { Media } from '../components/Media'
import { CHAIN, PARENT, districtsOf, pickOf, short, useScout, type AdSpace } from '../data'
import { usdc, useCountUp } from '../lib/hooks'
import './results.css'

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]
const AUTO_PAY_S = 6

function MatchRing({ value, delay, size = 44 }: { value: number; delay: number; size?: number }) {
  const r = 17
  const c = 2 * Math.PI * r
  const [go, setGo] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setGo(true), delay * 1000)
    return () => window.clearTimeout(id)
  }, [delay])
  const n = useCountUp(value, 1200, go)
  return (
    <div className="rs-ring" style={size !== 44 ? { width: size, height: size } : undefined}>
      <svg width={size} height={size} viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="var(--ink)" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
        <motion.circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="var(--p)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: go ? c * (1 - value / 100) : c }}
          transition={{ duration: 1.2, ease: EASE }}
          transform="rotate(-90 22 22)"
        />
      </svg>
      <b>{n}</b>
    </div>
  )
}

/** The winning space, with the reference tilt/shine card. */
function ResultCard({ ad, booked, district, onOpen }: { ad: AdSpace; booked: boolean; district?: string; onOpen: () => void }) {
  const mx = useMotionValue(0.5)
  const my = useMotionValue(0.5)
  const rx = useSpring(useTransform(my, [0, 1], [7, -7]), { stiffness: 200, damping: 20 })
  const ry = useSpring(useTransform(mx, [0, 1], [-9, 9]), { stiffness: 200, damping: 20 })
  const gx = useTransform(mx, (v) => `${v * 100}%`)
  const gy = useTransform(my, (v) => `${v * 100}%`)
  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    mx.set((e.clientX - r.left) / r.width)
    my.set((e.clientY - r.top) / r.height)
  }
  const onLeave = () => {
    mx.set(0.5)
    my.set(0.5)
  }
  const delay = 0.35

  return (
    <motion.div
      className="rs-cell rs-winner"
      initial={{ opacity: 0, x: 200, y: 320, scale: 0.35, rotate: 12 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 90, damping: 16, mass: 0.9, delay }}
    >
      <motion.div
        className={`rs-card ${booked ? 'is-booked' : ''}`}
        style={{ rotateX: rx, rotateY: ry, ['--gx' as string]: gx, ['--gy' as string]: gy, cursor: 'pointer' }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onClick={onOpen}
        whileHover={{ y: -6, scale: 1.015 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      >
        <div className="rs-shine" />
        <div className="rs-art-wrap">
          <Media src={ad.imageUrl} art={ad.art} className="rs-art rs-art-lg" alt={ad.title} />
          <span className="rs-chip">{district ?? ad.objectTitle}</span>
          <MatchRing value={ad.match} delay={delay + 0.5} />
          <AnimatePresence>
            {booked && (
              <motion.div
                className="rs-stamp"
                initial={{ scale: 2.6, opacity: 0, rotate: -30 }}
                animate={{ scale: 1, opacity: 1, rotate: -12 }}
                transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.2 }}
              >
                <Icon name="check" size={14} stroke={3.4} /> Booked
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="rs-body">
          <div className="rs-title">
            {ad.title} <span className="rs-title-obj">on {ad.objectTitle}</span>
          </div>
          <div className="rs-loc">
            <Icon name="pin" size={12} /> {ad.loc} · <span className="mono rs-ens">{ad.ensName}</span>
          </div>
          <p className="rs-why">{ad.reasoning}</p>
          <div className="rs-stats">
            <div>
              <span>Seen</span>
              <b>{ad.reach}</b>
            </div>
            <div>
              <span>Format</span>
              <b>{ad.format}</b>
            </div>
            <div className="rs-price">
              <span>Price / {ad.unit}</span>
              <b>{usdc(ad.price)}</b>
            </div>
          </div>
          <div className="rs-more">
            <Icon name="search" size={12} /> See how Scout scored it
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

/** One row in "Every space Scout analysed". */
function AnalysedRow({ ad, i, best, onOpen }: { ad: AdSpace; i: number; best: boolean; onOpen: () => void }) {
  return (
    <motion.button
      className={`rs-row ${best ? 'is-best' : ''}`}
      onClick={onOpen}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9 + i * 0.06, duration: 0.5, ease: EASE }}
      whileHover={{ x: 4 }}
    >
      <span className="rs-row-rank mono">{String(i + 1).padStart(2, '0')}</span>
      <span className="rs-row-thumb">
        <Media src={ad.imageUrl} art={ad.art} />
      </span>
      <span className="rs-row-main">
        <b>
          {ad.title} <em>· {ad.objectTitle}</em>
        </b>
        <span className="mono">{ad.ensName}</span>
      </span>
      <span className="rs-row-tags">
        {best && <i className="rs-tag is-best">Best fit</i>}
        {!ad.affordable && <i className="rs-tag">Over budget</i>}
        {!ad.verified && <i className="rs-tag">ENS unverified</i>}
      </span>
      <span className="rs-row-price mono">{usdc(ad.price)}</span>
      <span className="rs-row-score">
        <span className="rs-row-bar">
          <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: ad.match / 100 }} transition={{ delay: 1 + i * 0.06, duration: 0.9, ease: EASE }} />
        </span>
        <b className="mono">{ad.match}</b>
      </span>
      <Icon name="arrow" size={14} />
    </motion.button>
  )
}

/** Everything behind one score: reasoning, weighted factors, and the ENS records Scout read. */
function Detail({ ad, best, onClose }: { ad: AdSpace; best: boolean; onClose: () => void }) {
  const records = Object.entries(ad.ensRecords ?? {})
  return (
    <motion.div className="rs-drawer-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.aside
        className="rs-drawer"
        onClick={(e) => e.stopPropagation()}
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      >
        <div className="rs-drawer-head">
          <div className="rs-drawer-media">
            <Media src={ad.imageUrl} art={ad.art} alt={ad.title} />
          </div>
          <div className="rs-drawer-title">
            <span className="rs-drawer-kicker">{best ? 'Scout’s pick' : 'Analysed by Scout'}</span>
            <h3>
              {ad.title} <em>on {ad.objectTitle}</em>
            </h3>
            <span className="mono rs-ens">{ad.ensName}</span>
          </div>
          <MatchRing value={ad.match} delay={0.1} size={56} />
          <button className="rs-drawer-x" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="rs-drawer-badges">
          <span className={`rs-badge ${ad.verified ? 'is-ok' : ''}`}>
            <Icon name={ad.verified ? 'check' : 'lock'} size={11} stroke={3} /> {ad.verified ? 'ENS ↔ Sui verified' : 'ENS not verified'}
          </span>
          <span className="rs-badge">
            AQS {ad.aqs} · {ad.grade}
          </span>
          <span className="rs-badge">{usdc(ad.price)} / {ad.unit}</span>
          <span className={`rs-badge ${ad.affordable ? 'is-ok' : 'is-warn'}`}>{ad.affordable ? 'Within mandate' : 'Over mandate cap'}</span>
        </div>

        <section className="rs-drawer-sec">
          <h4>Why this score</h4>
          <p className="rs-reason">{ad.reasoning}</p>
        </section>

        <section className="rs-drawer-sec">
          <h4>Scoring breakdown</h4>
          <div className="rs-factors">
            {ad.factors.map((f, i) => (
              <div key={f.k} className="rs-factor">
                <div className="rs-factor-top">
                  <span>
                    {f.k} <em className="mono">×{f.weight}</em>
                  </span>
                  <b className="mono">{f.score}</b>
                </div>
                <div className="rs-factor-bar">
                  <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: Math.max(0, Math.min(100, f.score)) / 100 }} transition={{ delay: 0.15 + i * 0.07, duration: 0.8, ease: EASE }} />
                </div>
                {f.note && <p>{f.note}</p>}
              </div>
            ))}
          </div>
        </section>

        <section className="rs-drawer-sec">
          <h4>
            Read from ENS <span className="mono rs-muted">{PARENT}</span>
          </h4>
          {records.length ? (
            <div className="rs-records">
              {records.map(([k, v]) => (
                <div key={k} className="rs-record">
                  <span className="mono">{k.replace(/^eth\.brandmystuff\./, '')}</span>
                  <b className="mono">{v}</b>
                </div>
              ))}
            </div>
          ) : (
            <p className="rs-muted">No records could be read for this name.</p>
          )}
        </section>
      </motion.aside>
    </motion.div>
  )
}

type Mode = 'review' | 'paying' | 'booked'

export function Results({ mode, onPay }: { mode: Mode; onPay: () => void }) {
  const live = useScout()
  const BRAND = live.brand
  const pick = pickOf(live)
  const all = [...(live.candidates ?? [])].sort((a, b) => b.match - a.match)
  const districts = districtsOf(live)
  const canPay = !!pick && pick.affordable
  const [left, setLeft] = useState(AUTO_PAY_S)
  const [hold, setHold] = useState(false)
  const [open, setOpen] = useState<AdSpace | null>(null)
  const total = useCountUp(Math.round((pick?.price ?? 0) * 10000), 1600, true) / 10000

  // auto-pay countdown, unless the user holds or opens a detail
  useEffect(() => {
    if (mode !== 'review' || hold || !canPay || open) return
    if (left <= 0) {
      onPay()
      return
    }
    const id = window.setTimeout(() => setLeft((l) => l - 1), 1000)
    return () => window.clearTimeout(id)
  }, [left, mode, onPay, hold, canPay, open])

  const booked = mode === 'booked'
  const title = !pick
    ? `No space fits ${BRAND.short} right now`
    : booked
      ? `Booked. ${BRAND.short} is going on ${pick.title}.`
      : `The one space that fits ${BRAND.short} best`
  const auto = mode === 'review' && !hold && canPay && !open

  return (
    <motion.div
      className={`scene results ${mode === 'paying' ? 'is-paying' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <div className="rs-bg" />
      <div className="rs-scroll">
        <header className="rs-head">
          <motion.span className="rs-kicker" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
            <Icon name={booked ? 'check' : 'spark'} size={13} stroke={2.6} />
            {booked ? 'Ad booked' : pick ? 'Scout’s pick' : 'Scan complete'}
          </motion.span>
          <AnimatePresence mode="wait">
            <motion.h1 key={title} className="rs-title-main" exit={{ opacity: 0, y: -16, filter: 'blur(8px)', transition: { duration: 0.35 } }}>
              {title.split(' ').map((wd, i) => (
                <span key={i} className="rs-word">
                  <motion.span initial={{ y: '105%' }} animate={{ y: '0%' }} transition={{ duration: 0.8, delay: 0.15 + i * 0.05, ease: EASE }}>
                    {wd}
                  </motion.span>
                </span>
              ))}
            </motion.h1>
          </AnimatePresence>
          <motion.p className="rs-sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.5 }}>
            Matched against {BRAND.short}&apos;s brand DNA across {all.length} ad space{all.length === 1 ? '' : 's'} read from ENS under {PARENT}
          </motion.p>
        </header>

        {pick ? (
          <div className="rs-feature">
            <ResultCard ad={pick} booked={booked} district={districts.find((d) => d.id === pick.district)?.name} onOpen={() => setOpen(pick)} />
          </div>
        ) : (
          <motion.div className="rs-empty" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            Every space Scout read was either over the mandate&apos;s per-ad cap or a weak match. Top up the mandate or try again later.
          </motion.div>
        )}
        {pick && !pick.affordable && <div className="rs-empty">The best match is above the mandate&apos;s per-ad cap, so Scout won&apos;t pay for it.</div>}

        <section className="rs-list">
          <div className="rs-list-head">
            <h2>Every space Scout analysed</h2>
            <span>Tap any space to see Scout&apos;s reasoning and scoring</span>
          </div>
          {all.map((ad, i) => (
            <AnalysedRow key={ad.id} ad={ad} i={i} best={ad.id === pick?.id} onOpen={() => setOpen(ad)} />
          ))}
        </section>
      </div>

      <motion.div
        className="rs-bar"
        initial={{ y: 120, opacity: 0, x: '-50%' }}
        animate={{ y: 0, opacity: 1, x: '-50%' }}
        transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 1 }}
      >
        <div className="rs-bar-bot">
          <Bot pose={booked ? 'celebrate' : 'point'} size={46} look={booked ? 0 : 1} />
        </div>
        <div className="rs-bar-txt">
          <b>{booked ? 'Paid on-chain via x402' : canPay ? 'Scout will book this over x402' : 'Nothing to pay for'}</b>
          <span>
            {booked
              ? `Settled on ${CHAIN.name} · digest ${short(live.payment.digest, 5)}`
              : live.mandate
                ? `From Scout's mandate · ${usdc(live.mandate.remaining)} left of ${usdc(live.mandate.budget)}`
                : 'From Scout’s budget mandate'}
          </span>
        </div>
        <div className="rs-bar-total">
          <span>Total</span>
          <b className="mono">{usdc(total)}</b>
        </div>
        {mode === 'review' && canPay && (
          <button className="rs-hold" onClick={() => setHold((h) => !h)}>
            {hold ? 'Resume' : 'Hold'}
          </button>
        )}
        <motion.button
          className={`rs-pay ${booked ? 'is-done' : ''}`}
          onClick={mode === 'review' && canPay ? onPay : undefined}
          disabled={mode !== 'review' || !canPay}
          whileHover={mode === 'review' && canPay ? { scale: 1.04 } : undefined}
          whileTap={mode === 'review' && canPay ? { scale: 0.96 } : undefined}
        >
          {auto && (
            <svg className="rs-count" width="26" height="26" viewBox="0 0 26 26">
              <circle cx="13" cy="13" r="10" fill="none" stroke="rgba(10,10,11,0.18)" strokeWidth="3" />
              <motion.circle
                key={`c-${hold}`}
                cx="13"
                cy="13"
                r="10"
                fill="none"
                stroke="var(--ink)"
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ pathLength: left / AUTO_PAY_S }}
                animate={{ pathLength: 0 }}
                transition={{ duration: left, ease: 'linear' }}
                transform="rotate(-90 13 13)"
              />
              <text x="13" y="17" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--ink)">
                {left}
              </text>
            </svg>
          )}
          {mode === 'review' && (canPay ? 'Pay with x402' : 'Can’t pay')}
          {mode === 'paying' && 'Paying…'}
          {mode === 'booked' && (
            <>
              <Icon name="check" size={15} stroke={3} /> Paid
            </>
          )}
        </motion.button>
      </motion.div>

      <AnimatePresence>{open && <Detail key={open.id} ad={open} best={open.id === pick?.id} onClose={() => setOpen(null)} />}</AnimatePresence>
    </motion.div>
  )
}
