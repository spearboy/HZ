import { useCallback, useEffect, useRef } from 'react'
import { Box } from '@mui/material'

// 카드 유리에 서린 김과 맺힌 물방울. 손으로 문지르면 닦인다.
// 캔버스에 한 번만 그려 두고, 닦을 때는 그 자리를 지우기만 한다(destination-out). 매 프레임 다시 그리지 않는다
export const FX_KEY = 'weatherFx'
export const fxOn = () => { try { return localStorage.getItem(FX_KEY) !== 'off' } catch { return true } }
export const setFxOn = (on: boolean) => { try { localStorage.setItem(FX_KEY, on ? 'on' : 'off') } catch { /* 저장 못 해도 이번 세션엔 적용된다 */ } }

// 같은 날에는 같은 모양이 나오게 하는 작은 난수 (seed만 있으면 재현된다)
const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)

type Drop = { x: number; y: number; r: number; trail: number }

function makeDrops(kind: 'rain' | 'snow', w: number, h: number, seed: number): Drop[] {
  const rand = rng(seed)
  const density = kind === 'snow' ? 620 : 950 // 물방울 하나가 맡는 넓이(px²). 작을수록 촘촘하다
  const n = Math.round((w * h) / density)
  return Array.from({ length: n }, () => {
    const t = rand()
    // 큰 방울은 드물게. 눈(김서림)일 때는 전체적으로 더 잘다
    const r = (kind === 'snow' ? 1.1 : 1.8) + t * t * t * (kind === 'snow' ? 4 : 8.5)
    return { x: rand() * w, y: rand() * h, r, trail: kind === 'rain' && r > 5.5 ? r * (3 + rand() * 9) : 0 }
  })
}

export default function GlassFx({ kind, seed }: { kind: 'rain' | 'snow'; seed: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const last = useRef<{ x: number; y: number } | null>(null)

  const paint = useCallback(() => {
    const cvs = canvas.current
    const host = cvs?.parentElement
    if (!cvs || !host) return
    const w = host.clientWidth
    const h = host.clientHeight
    if (!w || !h) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    cvs.width = Math.round(w * dpr)
    cvs.height = Math.round(h * dpr)
    const ctx = cvs.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctxRef.current = ctx

    // 1) 유리에 낀 김. 눈 올 때가 더 뿌옇다
    ctx.fillStyle = kind === 'snow' ? 'rgba(234, 242, 255, 0.58)' : 'rgba(220, 234, 252, 0.36)'
    ctx.fillRect(0, 0, w, h)

    const drops = makeDrops(kind, w, h, seed)

    // 2) 물방울 자리는 김을 뚫는다. 방울 안쪽은 사진이 그대로 비쳐 보인다
    ctx.globalCompositeOperation = 'destination-out'
    for (const d of drops) {
      if (d.trail) { // 흘러내린 자국
        ctx.beginPath()
        ctx.roundRect(d.x - d.r * 0.24, d.y - d.trail, d.r * 0.48, d.trail, d.r)
        ctx.fill()
      }
      ctx.beginPath()
      ctx.ellipse(d.x, d.y, d.r, d.r * 1.08, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    // 3) 테두리와 반사. 빛을 왼쪽 위에서 받는다고 보고, 한 바퀴를 똑같이 그리지 않는다
    //    (고르게 두르면 물방울이 아니라 비눗방울로 보인다)
    ctx.globalCompositeOperation = 'source-over'
    for (const d of drops) {
      // 오른쪽 아래: 유리에 눌린 그림자
      ctx.beginPath()
      ctx.ellipse(d.x, d.y, d.r * 0.97, d.r * 1.05, 0, 0.25, 2.35)
      ctx.lineWidth = Math.max(0.6, d.r * 0.2)
      ctx.strokeStyle = 'rgba(10, 18, 32, 0.26)'
      ctx.stroke()

      // 왼쪽 위: 빛을 받아 반짝이는 가장자리
      ctx.beginPath()
      ctx.ellipse(d.x, d.y, d.r * 0.97, d.r * 1.05, 0, 3.45, 5.6)
      ctx.lineWidth = Math.max(0.5, d.r * 0.16)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.62)'
      ctx.stroke()

      // 작은 반사점. 너무 작은 방울엔 찍지 않는다
      if (d.r > 2.6) {
        ctx.beginPath()
        ctx.arc(d.x - d.r * 0.33, d.y - d.r * 0.38, Math.max(0.6, d.r * 0.2), 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.fill()
      }
    }
  }, [kind, seed])

  useEffect(() => {
    paint()
    const host = canvas.current?.parentElement
    if (!host || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(paint)
    ro.observe(host)
    return () => ro.disconnect()
  }, [paint])

  // 문지른 자리를 지운다. 이미 그려 둔 그림에서 지우기만 하므로 다시 그릴 필요가 없다
  const rub = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = ctxRef.current
    const cvs = canvas.current
    if (!ctx || !cvs || e.buttons === 0) return
    const box = cvs.getBoundingClientRect()
    const p = { x: e.clientX - box.left, y: e.clientY - box.top }
    const from = last.current ?? p
    ctx.globalCompositeOperation = 'destination-out'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 48
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
  }

  return (
    <Box component="canvas" ref={canvas} aria-hidden
      onPointerDown={(e) => {
        last.current = null
        // 손가락이 카드 밖으로 나가도 계속 닦이게. 브라우저가 거부하면 그냥 넘어간다
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* 무시 */ }
        rub(e)
      }}
      onPointerMove={rub}
      onPointerUp={() => { last.current = null }}
      onPointerLeave={() => { last.current = null }}
      // 세로 스크롤은 그대로 두고 옆으로 문지를 때만 닦인다
      sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'pan-y', cursor: 'grab' }} />
  )
}
