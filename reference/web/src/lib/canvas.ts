import { useEffect, useLayoutEffect, useRef } from 'react'

export type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, t: number) => void

/** Full-size canvas driven by requestAnimationFrame, DPR-aware and resize-safe. */
export function useCanvas(draw: Draw, active = true) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef(draw)
  useLayoutEffect(() => {
    drawRef.current = draw
  })

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !active) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let w = 0
    let h = 0
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const resize = () => {
      const r = canvas.getBoundingClientRect()
      w = r.width
      h = r.height
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    let raf = 0
    let last = performance.now()
    const t0 = last
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      drawRef.current(ctx, w, h, dt, (now - t0) / 1000)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [active])

  return ref
}

export const PURPLE = [171, 159, 242] as const

export function rgba(c: readonly number[], a: number) {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`
}
