"use client";
import { motion } from 'framer-motion'
import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'

export type LandPhase = 'arrive' | 'analyze' | 'done'

export type Geo = {
  w: number
  h: number
  groundY: number
  botX: number
  botTop: number
  botSize: number
  /** antenna / head centre in screen px */
  headY: number
  /** bottom edge of the centred land title block */
  titleBottom: number
}

export type LandProps = { geo: Geo; phase: LandPhase }

const GeoCtx = createContext<Geo | null>(null)
export const GeoProvider = GeoCtx.Provider
const useGeo = () => useContext(GeoCtx)!

const EASE_IN: [number, number, number, number] = [0.7, 0, 0.84, 0]
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1]

/**
 * One parallax plane of a land. Depth 0 is the sky (cross-fades),
 * depth 1 is the foreground (travels furthest, so it feels closest).
 */
export function Layer({
  depth,
  children,
  className,
  style,
  z,
}: {
  depth: number
  children?: ReactNode
  className?: string
  style?: CSSProperties
  z?: number
}) {
  const { w } = useGeo()
  if (depth === 0) {
    return (
      <motion.div
        className={`layer ${className ?? ''}`}
        style={{ ...style, zIndex: z }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 1.5, delay: 0.25, ease: 'easeInOut' } }}
        exit={{ opacity: 0, transition: { duration: 1.4, delay: 0.35, ease: 'easeInOut' } }}
      >
        {children}
      </motion.div>
    )
  }
  const dist = w * (0.35 + depth * 0.95)
  const fade = depth < 0.5
  return (
    <motion.div
      className={`layer ${className ?? ''}`}
      style={{ ...style, zIndex: z }}
      initial={{ x: dist, opacity: fade ? 0 : 1 }}
      animate={{ x: 0, opacity: 1, transition: { duration: 2.1, delay: 0.15 + (1 - depth) * 0.2, ease: EASE_OUT } }}
      exit={{
        x: -dist,
        opacity: fade ? 0 : 1,
        transition: { duration: 1.5 - depth * 0.2, ease: EASE_IN },
      }}
    >
      {children}
    </motion.div>
  )
}

/** Anything that should appear/leave with a soft blur instead of sliding. */
export function Fade({ children, delay = 0, style, className }: { children: ReactNode; delay?: number; style?: CSSProperties; className?: string }) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, scale: 0.9, filter: 'blur(12px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', transition: { duration: 1.1, delay, ease: EASE_OUT } }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(12px)', transition: { duration: 0.6 } }}
    >
      {children}
    </motion.div>
  )
}
