import type { CSSProperties } from 'react'
import { Avatar } from '@mui/material'

// 사진의 '보일 영역': 확대 배율과 가로/세로 위치(%). DB에 숫자로만 저장한다
export type Fit = { zoom: number; x: number; y: number }
export const DEFAULT_FIT: Fit = { zoom: 1, x: 50, y: 50 }

// object-position은 cover로 잘린 부분을, transform-origin은 확대해 잘린 부분을 조절한다.
// 부모에 overflow:hidden만 있으면 동그란 프로필이든 넓은 배경이든 같은 코드로 쓴다
export const fitImg = (f: Fit): CSSProperties => ({
  width: '100%', height: '100%', display: 'block', objectFit: 'cover',
  objectPosition: `${f.x}% ${f.y}%`, transform: `scale(${f.zoom})`, transformOrigin: `${f.x}% ${f.y}%`,
})

export function FitAvatar({ url, fit, size, bg, fg, label }: {
  url?: string | null; fit: Fit; size: number; bg: string; fg: string; label: string
}) {
  return (
    <Avatar sx={{ width: size, height: size, fontSize: Math.round(size * 0.42), bgcolor: bg, color: fg, border: '2px solid #fff' }}>
      {url ? <img src={url} alt="" style={fitImg(fit)} /> : (label[0] ?? '?')}
    </Avatar>
  )
}
