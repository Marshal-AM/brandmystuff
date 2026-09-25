import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useEffect, useState, type MouseEvent } from 'react'
import { AdArt } from '../components/AdArt'
import { Bot } from '../components/Bot'
import { Icon } from '../components/Icon'
import { BRAND, CHAIN, DISTRICTS, RESULTS, TOTAL, WALLET, type AdSpace } from '../data'
import { usdc, useCountUp } from '../lib/hooks'
import './results.css'

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]
const AUTO_PAY_S = 6

function MatchRing({ value, delay }: { value: number; delay: number }) {
  const r = 17
  const c = 2 * Math.PI * r
  const [go, setGo] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setGo(true), delay * 1000)
    return () => window.clearTimeout(id)
  }, [delay])
  const n = useCountUp(value, 1200, go)
  return (
    <div className="rs-ring">
      <svg width="44" height="44" viewBox="0 0 44 44">
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

function ResultCard({ ad, i, booked }: { ad: AdSpace; i: number; booked: boolean }) {
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
  const district = DISTRICTS.find((d) => d.id === ad.district)?.name.split(' ')[0]
  const delay = 0.35 + i * 0.09

  return (
    <motion.div
      className="rs-cell"
      initial={{ opacity: 0, x: 260 - (i % 3) * 60, y: 320, scale: 0.35, rotate: 12 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 90, damping: 16, mass: 0.9, delay }}
    >
      <motion.div
        className={`rs-card ${booked ? 'is-booked' : ''}`}
        style={{ rotateX: rx, rotateY: ry, ['--gx' as string]: gx, ['--gy' as string]: gy }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        whileHover={{ y: -6, scale: 1.015 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      >
        <div className="rs-shine" />
        <div className="rs-art-wrap">
          <AdArt kind={ad.art} className="rs-art" />
          <span className="rs-chip">{district}</span>
          <MatchRing value={ad.match} delay={delay + 0.5} />
          <AnimatePresence>
            {booked && (
              <motion.div
                className="rs-stamp"
                initial={{ scale: 2.6, opacity: 0, rotate: -30 }}
                animate={{ scale: 1, opacity: 1, rotate: -12 }}
                transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.2 + i * 0.12 }}
              >
                <Icon name="check" size={14} stroke={3.4} /> Booked
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="rs-body">
          <div className="rs-title">{ad.title}</div>
          <div className="rs-loc">
            <Icon name="pin" size={12} /> {ad.loc}
          </div>
          <div className="rs-stats">
            <div>
              <span>Reach</span>
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
        </div>
      </motion.div>
    </motion.div>
  )
}

type Mode = 'review' | 'paying' | 'booked'

export function Results({ mode, onPay }: { mode: Mode; onPay: () => void }) {
  const [left, setLeft] = useState(AUTO_PAY_S)
  const total = useCountUp(TOTAL, 1600, true)

  useEffect(() => {
    if (mode !== 'review') return
    if (left <= 0) {
      onPay()
      return
    }
    const id = window.setTimeout(() => setLeft((l) => l - 1), 1000)
    return () => window.clearTimeout(id)
  }, [left, mode, onPay])

  const booked = mode === 'booked'
  const title = booked ? `Booked. ${BRAND.short} goes live on 1 Oct.` : `6 spaces that fit ${BRAND.short} perfectly`

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
          <motion.span
            className="rs-kicker"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <Icon name={booked ? 'check' : 'spark'} size={13} stroke={2.6} />
            {booked ? 'Campaign booked' : 'Shortlist ready'}
          </motion.span>
          <AnimatePresence mode="wait">
            <motion.h1 key={title} className="rs-title-main" exit={{ opacity: 0, y: -16, filter: 'blur(8px)', transition: { duration: 0.35 } }}>
              {title.split(' ').map((wd, i) => (
                <span key={i} className="rs-word">
                  <motion.span
                    initial={{ y: '105%' }}
                    animate={{ y: '0%' }}
                    transition={{ duration: 0.8, delay: 0.15 + i * 0.05, ease: EASE }}
                  >
                    {wd}
                  </motion.span>
                </span>
              ))}
            </motion.h1>
          </AnimatePresence>
          <motion.p
            className="rs-sub"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            Matched against {BRAND.short}&apos;s brand DNA across 12,480 listings · combined reach 3.1M / week
          </motion.p>
        </header>

        <div className="rs-grid">
          {RESULTS.map((ad, i) => (
            <ResultCard key={ad.id} ad={ad} i={i} booked={booked} />
          ))}
        </div>
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
          <b>{booked ? 'All 6 publishers paid on-chain' : 'Scout can book these for you'}</b>
          <span>{booked ? `Settled on ${CHAIN.name} · digest ${CHAIN.digest}` : `One USDC transfer from ${WALLET.name}, split to every publisher`}</span>
        </div>
        <div className="rs-bar-total">
          <span>Total</span>
          <b className="mono">{usdc(total)}</b>
        </div>
        <motion.button
          className={`rs-pay ${booked ? 'is-done' : ''}`}
          onClick={mode === 'review' ? onPay : undefined}
          disabled={mode !== 'review'}
          whileHover={mode === 'review' ? { scale: 1.04 } : undefined}
          whileTap={mode === 'review' ? { scale: 0.96 } : undefined}
        >
          {mode === 'review' && (
            <svg className="rs-count" width="26" height="26" viewBox="0 0 26 26">
              <circle cx="13" cy="13" r="10" fill="none" stroke="rgba(10,10,11,0.18)" strokeWidth="3" />
              <motion.circle
                cx="13"
                cy="13"
                r="10"
                fill="none"
                stroke="var(--ink)"
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ pathLength: 1 }}
                animate={{ pathLength: 0 }}
                transition={{ duration: AUTO_PAY_S, ease: 'linear', delay: 0 }}
                transform="rotate(-90 13 13)"
              />
              <text x="13" y="17" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--ink)">
                {left}
              </text>
            </svg>
          )}
          {mode === 'review' && 'Pay with Scout'}
          {mode === 'paying' && 'Paying…'}
          {mode === 'booked' && (
            <>
              <Icon name="check" size={15} stroke={3} /> Paid
            </>
          )}
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
