"use client";
import { AnimatePresence, motion } from 'framer-motion'
import { initialOf, useScout } from '../../data'
import { Layer, type Geo } from './common'

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

export function HomeLand({ geo, showUi }: { geo: Geo; showUi: boolean }) {
  const { brand, lands } = useScout()
  const { groundY, botX, h } = geo
  const words = ['Find', 'where', 'your', 'brand', 'belongs.']
  return (
    <div className="land land-home">
      <Layer depth={0} className="home-sky">
        <div className="home-nebula n1" />
        <div className="home-nebula n2" />
        <div className="home-stars" />
      </Layer>

      <Layer depth={0.5}>
        <div className="home-floor" style={{ top: groundY - 40 }}>
          <div className="home-grid" />
        </div>
        <div className="home-horizon" style={{ top: groundY - 42 }} />
      </Layer>

      <Layer depth={1} z={2}>
        <div className="home-pedestal" style={{ left: botX - 150, top: groundY - 26 }}>
          <i />
          <i />
          <i />
        </div>
      </Layer>

      <AnimatePresence propagate>
        {showUi && (
          <motion.div
            key="hero"
            className="home-hero"
            style={{ top: Math.max(110, h * 0.13) }}
            exit={{ opacity: 0, y: -30, filter: 'blur(14px)', transition: { duration: 0.7, ease: EASE } }}
          >
            <motion.div
              className="home-eyebrow"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
            >
              <span className="home-eyebrow-dot" />
              AI ad-space scout
            </motion.div>
            <h1 className="home-title">
              {words.map((wd, i) => (
                <span key={wd} className="home-word">
                  <motion.span
                    initial={{ y: '110%', rotate: 6, opacity: 0 }}
                    animate={{ y: '0%', rotate: 0, opacity: 1 }}
                    transition={{ duration: 1.1, delay: 0.3 + i * 0.07, ease: EASE }}
                    className={wd === 'belongs.' ? 'home-accent' : undefined}
                  >
                    {wd}
                  </motion.span>
                </span>
              ))}
            </h1>
            <motion.p
              className="home-sub"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.8, ease: EASE }}
            >
              Scout reads your brand, then travels every corner of the marketplace to book the spaces that fit.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence propagate>
        {showUi && (
          <motion.div
            key="card"
            className="home-card"
            style={{ top: groundY + Math.min(40, (h - groundY) * 0.25) }}
            initial={{ opacity: 0, y: 24, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 24, x: '-50%', filter: 'blur(10px)', transition: { duration: 0.6, ease: EASE } }}
            transition={{ duration: 1, delay: 1, ease: EASE }}
          >
            <span className="home-card-av">
              {brand.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
              ) : (
                initialOf(brand.name)
              )}
            </span>
            <span className="home-card-body">
              <b>{brand.name}</b>
              <span>{[brand.location || brand.url, brand.category].filter(Boolean).join(' · ')}</span>
            </span>
            <span className="home-card-hint">
              <motion.span
                style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 99, border: '2px solid currentColor', borderRightColor: 'transparent' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
              {lands ? 'Ready' : `Scout is reading ${brand.short}…`}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
