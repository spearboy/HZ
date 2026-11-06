import { useEffect, useState, type CSSProperties } from 'react'
import { Avatar, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Slider, Stack, Typography } from '@mui/material'
import { ImageIcon } from '@animateicons/react/lucide'
import { bucket, resize } from './Photos'
import { koError } from './supabase'

// 사진의 '보일 영역': 확대 배율과 가로/세로 위치(%). DB에 숫자로만 저장한다
export type Fit = { zoom: number; x: number; y: number }
export const DEFAULT_FIT: Fit = { zoom: 1, x: 50, y: 50 }

// object-fit:cover가 잘라 주고, object-position이 어디를 보여 줄지, scale이 얼마나 당길지 정한다.
// 부모에 overflow:hidden만 있으면 동그란 프로필이든 넓은 배경이든 같은 코드로 쓴다
export const fitImg = (f: Fit): CSSProperties => ({
  width: '100%', height: '100%', display: 'block', objectFit: 'cover',
  objectPosition: `${f.x}% ${f.y}%`, transform: `scale(${f.zoom})`,
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

export default function ImageFitDialog({ title, url, path, fit, prefix, max, round, ratio, onClose, onSave, onError }: {
  title: string
  url: string | null            // 지금 저장된 사진의 서명 URL
  path: string | null           // 지금 저장된 파일 경로 (바꾸면 지운다)
  fit: Fit
  prefix: string                // 업로드 폴더. Storage 정책상 반드시 {couple_id}/ 로 시작해야 한다
  max: number                   // 긴 변 기준 저장 크기(px)
  round?: boolean
  ratio: number                 // 미리보기 비율 (가로/세로)
  onClose: () => void
  onSave: (v: Fit & { path: string | null }) => void
  onError: (m: string) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [cur, setCur] = useState(fit)
  const [busy, setBusy] = useState(false)

  // 미리보기용 blob URL은 파일이 바뀌거나 창이 닫힐 때 반드시 해제한다
  useEffect(() => {
    if (!file) return setPreview(null)
    const u = URL.createObjectURL(file)
    setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const shown = preview ?? url

  const save = async () => {
    setBusy(true)
    try {
      let next = path
      if (file) {
        next = `${prefix}/${crypto.randomUUID()}.jpg`
        const { error } = await bucket().upload(next, await resize(file, max), { contentType: 'image/jpeg' })
        if (error) throw error
        if (path) await bucket().remove([path])
      }
      onSave({ ...cur, path: next })
    } catch (e) {
      onError(e instanceof Error ? koError(e) : String(e))
      setBusy(false)
    }
  }

  const clear = async () => {
    setBusy(true)
    if (path) await bucket().remove([path])
    onSave({ ...DEFAULT_FIT, path: null })
  }

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ aspectRatio: String(ratio), width: round ? 180 : '100%', mx: 'auto', overflow: 'hidden',
          borderRadius: round ? '50%' : 4, bgcolor: 'action.hover', display: 'grid', placeItems: 'center' }}>
          {shown
            ? <img src={shown} alt="미리보기" style={fitImg(cur)} />
            : <Typography variant="body2" color="text.secondary">사진 없음</Typography>}
        </Box>

        <Button component="label" fullWidth startIcon={<ImageIcon size={18} />} disabled={busy} sx={{ mt: 2 }}>
          {shown ? '다른 사진 고르기' : '사진 고르기'}
          <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
        </Button>

        {shown && (
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            {([['확대', 'zoom', 1, 4, 0.05], ['가로 위치', 'x', 0, 100, 1], ['세로 위치', 'y', 0, 100, 1]] as const).map(([label, key, lo, hi, step]) => (
              <Box key={key}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Slider size="small" value={cur[key]} min={lo} max={hi} step={step} disabled={busy}
                  aria-label={label} onChange={(_, v) => setCur({ ...cur, [key]: v as number })} />
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {path && <Button color="error" disabled={busy} onClick={clear}>사진 지우기</Button>}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} disabled={busy}>취소</Button>
        <Button variant="contained" onClick={save} disabled={busy || !shown}>{busy ? '저장 중…' : '저장'}</Button>
      </DialogActions>
    </Dialog>
  )
}
