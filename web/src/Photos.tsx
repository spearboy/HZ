import { isEnglish, locale, tr } from './language'
import { useRef, useState } from 'react'
import { Box, Button, ButtonBase, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, ImageList, ImageListItem, Typography, useMediaQuery, useTheme } from '@mui/material'
import { ImageIcon, XIcon } from './icons'
import { supabase } from './supabase'
import { bucket, forgetSigned, signedUrl, type Photo } from './photoStorage'

function PhotoThumbnail({ photo }: { photo: Photo }) {
  const [url, setUrl] = useState(photo.thumbUrl)
  const retried = useRef(false)
  const refresh = async () => {
    if (!url || retried.current) return
    retried.current = true
    forgetSigned([photo.thumb_path])
    const next = await signedUrl(photo.thumb_path)
    setUrl(next && next !== url ? next : null)
  }
  if (!url) return <Box component="span" aria-hidden sx={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', bgcolor: 'action.hover', color: 'text.secondary' }}><ImageIcon size={22} /></Box>
  return <img src={url ?? undefined} alt="" loading="lazy" onError={refresh} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
}

// 썸네일 그리드 + 누르면 원본 보기(저장/삭제)
export function PhotoGrid({ photos, userId, cols = 3, onChanged, onError }: {
  photos: Photo[]; userId: string; cols?: number; onChanged: () => void; onError: (m: string) => void
}) {
  const [open, setOpen] = useState<Photo | null>(null)
  const [fullUrl, setFullUrl] = useState<string | null | undefined>()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const requestId = useRef(0)
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))

  const close = () => { requestId.current++; setConfirmDelete(false); setOpen(null) }

  const show = async (p: Photo) => {
    const id = ++requestId.current
    setOpen(p)
    setFullUrl(undefined)
    const url = await signedUrl(p.storage_path)
    if (id === requestId.current) setFullUrl(url)
  }

  const download = async (p: Photo) => {
    const { data, error } = await bucket().createSignedUrl(p.storage_path, 60, { download: `${p.photo_date}.jpg` })
    if (error) return onError(error.message)
    location.href = data.signedUrl
  }

  const remove = async (p: Photo) => {
    if (deleting) return
    setDeleting(true)
    try {
      // 행을 먼저 지워야 실패해도 화면에 깨진 사진이 남지 않는다. 파일 삭제가 실패하면 고아 파일만 남는다
      const { error } = await supabase.from('photos').delete().eq('id', p.id)
      if (error) return onError(error.message)
      await bucket().remove([p.storage_path, p.thumb_path])
      forgetSigned([p.storage_path, p.thumb_path])
      close()
      onChanged()
    } finally { setDeleting(false) }
  }

  return (
    <>
      <ImageList cols={cols} gap={6} sx={{ m: 0 }}>
        {photos.map((p) => (
          <ImageListItem key={p.id} sx={{ borderRadius: 2, overflow: 'hidden', aspectRatio: '1', bgcolor: 'action.hover',
            '& img': { transition: 'transform 300ms cubic-bezier(.2,.8,.2,1)' },
            '@media (hover: hover)': { '&:hover img': { transform: 'scale(1.04)' } },
            '&:active img': { transform: 'scale(.97)' },
            '@media (prefers-reduced-motion: reduce)': { '& img': { transition: 'none' }, '&:hover img, &:active img': { transform: 'none' } } }}>
            <ButtonBase onClick={() => show(p)} aria-label={isEnglish() ? `View photo from ${p.photo_date}` : `${p.photo_date} 사진 보기`}
              sx={{ width: '100%', height: '100%', display: 'block', '&.Mui-focusVisible': { outline: '3px solid var(--mui-palette-primary-main)', outlineOffset: -3 } }}>
              <PhotoThumbnail key={`${p.id}:${p.thumbUrl}`} photo={p} />
            </ButtonBase>
          </ImageListItem>
        ))}
      </ImageList>

      <Dialog open={!!open} onClose={close} fullScreen={fullScreen} fullWidth maxWidth="md" aria-labelledby="photo-dialog-title"
        slotProps={{ paper: { sx: { bgcolor: '#111113', color: '#fff', backgroundImage: 'none', overflow: 'hidden', borderRadius: fullScreen ? 0 : 2 } } }}>
        <DialogTitle id="photo-dialog-title" sx={{ minHeight: 64, pl: 2.5, pr: 7, pt: 'max(16px, env(safe-area-inset-top))', fontSize: 16, fontWeight: 650 }}>
          {open && new Date(`${open.photo_date}T00:00`).toLocaleDateString(locale(), { year: 'numeric', month: 'long', day: 'numeric' })}
        </DialogTitle>
        <Box sx={{ position: 'relative', bgcolor: '#111113', flex: 1, minHeight: 240, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
          {fullUrl && <img src={fullUrl} alt={tr("원본 사진")} onError={() => setFullUrl(null)} style={{ maxWidth: '100%', maxHeight: 'min(75dvh, 760px)', objectFit: 'contain', display: 'block' }} />}
          {fullUrl === undefined && <CircularProgress size={28} sx={{ color: 'white' }} aria-label={isEnglish() ? 'Loading photo' : '사진 불러오는 중'} />}
          {fullUrl === null && <Typography sx={{ color: 'white', p: 2 }}>{isEnglish() ? 'Could not load this photo.' : '사진을 불러오지 못했어요.'}</Typography>}
        </Box>
        <IconButton aria-label={tr("닫기")} onClick={close} sx={{ position: 'absolute', top: 'max(8px, env(safe-area-inset-top))', right: 8, color: '#fff' }}><XIcon size={22} /></IconButton>
        {open && (
          <DialogActions sx={{ p: 2, pb: 'max(16px, env(safe-area-inset-bottom))', borderTop: '1px solid #ffffff26' }}>
            {open.uploaded_by === userId && <Button onClick={() => setConfirmDelete(true)} sx={{ color: '#ff9c9c' }}>{tr("삭제")}</Button>}
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" onClick={() => download(open)} sx={{ bgcolor: '#fff', color: '#111113', '&:hover': { bgcolor: '#e8e8e8' } }}>{tr("저장")}</Button>
          </DialogActions>
        )}
      </Dialog>
      <Dialog open={confirmDelete} onClose={() => { if (!deleting) setConfirmDelete(false) }} aria-labelledby="delete-photo-title" aria-describedby="delete-photo-description">
        <DialogTitle id="delete-photo-title">{tr('이 사진을 삭제할까요?')}</DialogTitle>
        <DialogContent><DialogContentText id="delete-photo-description">{isEnglish() ? 'This photo will be removed from your shared album.' : '공유 앨범에서 이 사진이 삭제돼요.'}</DialogContentText></DialogContent>
        <DialogActions>
          <Button disabled={deleting} onClick={() => setConfirmDelete(false)}>{tr('취소')}</Button>
          <Button color="error" disabled={deleting} onClick={() => { if (open) void remove(open) }}>{deleting ? (isEnglish() ? 'Deleting…' : '삭제 중…') : tr('삭제')}</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
