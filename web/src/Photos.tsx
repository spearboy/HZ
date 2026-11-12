import { isEnglish, tr } from './language'
import { useRef, useState } from 'react'
import { Box, Button, ButtonBase, CircularProgress, Dialog, DialogActions, DialogTitle, IconButton, ImageList, ImageListItem, Typography } from '@mui/material'
import { XIcon } from './icons'
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
    if (next && next !== url) setUrl(next)
  }
  return <img src={url ?? undefined} alt="" loading="lazy" onError={refresh} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
}

// 썸네일 그리드 + 누르면 원본 보기(저장/삭제)
export function PhotoGrid({ photos, userId, cols = 3, onChanged, onError }: {
  photos: Photo[]; userId: string; cols?: number; onChanged: () => void; onError: (m: string) => void
}) {
  const [open, setOpen] = useState<Photo | null>(null)
  const [fullUrl, setFullUrl] = useState<string | null | undefined>()
  const requestId = useRef(0)

  const close = () => { requestId.current++; setOpen(null) }

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
    if (!confirm(tr("이 사진을 삭제할까요?"))) return
    // 행을 먼저 지워야 실패해도 화면에 깨진 사진이 남지 않는다. 파일 삭제가 실패하면 고아 파일만 남는다
    const { error } = await supabase.from('photos').delete().eq('id', p.id)
    if (error) return onError(error.message)
    await bucket().remove([p.storage_path, p.thumb_path])
    forgetSigned([p.storage_path, p.thumb_path])
    close()
    onChanged()
  }

  return (
    <>
      <ImageList cols={cols} gap={6} sx={{ m: 0 }}>
        {photos.map((p) => (
          <ImageListItem key={p.id} sx={{ borderRadius: 2, overflow: 'hidden', aspectRatio: '1',
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

      <Dialog open={!!open} onClose={close} fullWidth maxWidth="md" aria-labelledby="photo-dialog-title">
        <DialogTitle id="photo-dialog-title" sx={{ pr: 7 }}>{open?.photo_date}</DialogTitle>
        <Box sx={{ position: 'relative', bgcolor: 'black', minHeight: 240, display: 'grid', placeItems: 'center' }}>
          {fullUrl && <img src={fullUrl} alt={tr("원본 사진")} onError={() => setFullUrl(null)} style={{ maxWidth: '100%', maxHeight: '75dvh', display: 'block' }} />}
          {fullUrl === undefined && <CircularProgress size={28} sx={{ color: 'white' }} aria-label={isEnglish() ? 'Loading photo' : '사진 불러오는 중'} />}
          {fullUrl === null && <Typography sx={{ color: 'white', p: 2 }}>{isEnglish() ? 'Could not load this photo.' : '사진을 불러오지 못했어요.'}</Typography>}
        </Box>
        <IconButton aria-label={tr("닫기")} onClick={close} sx={{ position: 'absolute', top: 8, right: 8 }}><XIcon size={22} /></IconButton>
        {open && (
          <DialogActions>
            {open.uploaded_by === userId && <Button color="error" onClick={() => remove(open)}>{tr("삭제")}</Button>}
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" onClick={() => download(open)}>{tr("저장")}</Button>
          </DialogActions>
        )}
      </Dialog>
    </>
  )
}
