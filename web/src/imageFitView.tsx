import { Avatar } from '@mui/material'
import { fitImg, type Fit } from './imageFitStyles'

export function FitAvatar({ url, fit, size, bg, fg, label }: {
  url?: string | null; fit: Fit; size: number; bg: string; fg: string; label: string
}) {
  return (
    <Avatar sx={{ width: size, height: size, fontSize: Math.round(size * 0.42), bgcolor: bg, color: fg, border: '2px solid #fff' }}>
      {url ? <img src={url} alt="" style={fitImg(fit)} /> : (label[0] ?? '?')}
    </Avatar>
  )
}
