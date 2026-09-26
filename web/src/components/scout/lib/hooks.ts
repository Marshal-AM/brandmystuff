import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export type Seq = {
  /** Resolves after `ms`, or rejects if the scene unmounts first. */
  wait: (ms: number) => Promise<void>
  signal: AbortSignal
}

/**
 * Runs an async timeline once `enabled` is true. The timeline is aborted when
 * the component unmounts, so a scene can never fire callbacks after it leaves.
 */
export function useSequence(run: (s: Seq) => Promise<void>, enabled = true) {
  const runRef = useRef(run)
  useLayoutEffect(() => {
    runRef.current = run
  })

  useEffect(() => {
    if (!enabled) return
    const ctrl = new AbortController()
    const wait = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        if (ctrl.signal.aborted) return reject(new DOMException('aborted', 'AbortError'))
        const id = window.setTimeout(resolve, ms)
        ctrl.signal.addEventListener(
          'abort',
          () => {
            window.clearTimeout(id)
            reject(new DOMException('aborted', 'AbortError'))
          },
          { once: true },
        )
      })
    // Start on the next tick so StrictMode's mount/unmount/mount never runs a timeline twice.
    wait(0)
      .then(() => runRef.current({ wait, signal: ctrl.signal }))
      .catch((err) => {
        if (err?.name !== 'AbortError') throw err
      })
    return () => ctrl.abort()
  }, [enabled])
}

export function useViewport() {
  const [size, setSize] = useState(() => (typeof window === 'undefined' ? { w: 1440, h: 900 } : { w: window.innerWidth, h: window.innerHeight }))
  useLayoutEffect(() => {
    let raf = 0
    const onResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setSize({ w: window.innerWidth, h: window.innerHeight }))
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])
  return size
}

/** requestAnimationFrame loop with delta time in seconds. */
export function useFrame(cb: (dt: number, t: number) => void, active = true) {
  const cbRef = useRef(cb)
  useLayoutEffect(() => {
    cbRef.current = cb
  })
  useEffect(() => {
    if (!active) return
    let raf = 0
    let last = performance.now()
    const start = last
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      cbRef.current(dt, (now - start) / 1000)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active])
}

/** Counts from 0 to `to` over `ms` once `start` flips true. */
export function useCountUp(to: number, ms: number, start = true) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!start) return
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms)
      const e = 1 - Math.pow(1 - p, 3)
      setV(Math.round(to * e))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, ms, start])
  return v
}

/** Seeded random so layouts are stable between renders. */
export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** USDC amount; small or fractional amounts keep their decimals (testnet prices are often < 1 USDC). */
export const usdc = (n: number, dp?: number) => {
  const d = dp ?? (Number.isInteger(n) ? 0 : n < 1 ? 4 : 2)
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' USDC'
}
