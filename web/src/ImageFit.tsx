import { tr } from './language'
import { useEffect, useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Slider, Stack, Typography } from '@mui/material'
import { ImageIcon } from './icons'
import { bucket, resize } from './Photos'
import { koError } from './supabase'

import { DEFAULT_FIT, fitImg, type Fit } from './imageFitView'

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
  onSave: (v: Fit & { path: string | null }) => Promise<void>
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
      }
      try { await onSave({ ...cur, path: next }) }
      catch (e) {
        if (next && next !== path) await bucket().remove([next])
        throw e
      }
      if (path && next !== path) await bucket().remove([path])
    } catch (e) {
      onError(e && typeof e === 'object' && 'message' in e ? koError(e as { message: string }) : String(e))
      setBusy(false)
    }
  }

  const clear = async () => {
    setBusy(true)
    try {
      await onSave({ ...DEFAULT_FIT, path: null })
      if (path) await bucket().remove([path])
    } catch (e) {
      onError(e && typeof e === 'object' && 'message' in e ? koError(e as { message: string }) : String(e))
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ aspectRatio: String(ratio), width: round ? 180 : '100%', mx: 'auto', overflow: 'hidden',
          borderRadius: round ? '50%' : 4, bgcolor: 'action.hover', display: 'grid', placeItems: 'center' }}>
          {shown
            ? <img src={shown} alt={tr("미리보기")} style={fitImg(cur)} />
            : <Typography variant="body2" color="text.secondary">{tr("사진 없음")}</Typography>}
        </Box>

        <Button component="label" fullWidth startIcon={<ImageIcon size={18} />} disabled={busy} sx={{ mt: 2 }}>
          {shown ? tr('다른 사진 고르기') : tr("사진 고르기")}
          <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
        </Button>

        {shown && (
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">{tr("이동할 여백이 없으면 먼저 확대해 주세요.")}</Typography>
            {([[tr("확대"), 'zoom', 1, 4, 0.05], [tr("가로 위치"), 'x', 0, 100, 1], [tr("세로 위치"), 'y', 0, 100, 1]] as const).map(([label, key, lo, hi, step]) => (
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
        {path && <Button color="error" disabled={busy} onClick={clear}>{tr("사진 지우기")}</Button>}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} disabled={busy}>{tr("취소")}</Button>
        <Button variant="contained" onClick={save} disabled={busy || !shown}>{busy ? tr('저장 중…') : tr("저장")}</Button>
      </DialogActions>
    </Dialog>
  )
}
