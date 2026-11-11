import { isEnglish, tr } from './language'
import { useRef, useState } from 'react'
import { Box, Button, ButtonBase, CircularProgress, Dialog, DialogActions, DialogTitle, IconButton, ImageList, ImageListItem, Typography } from '@mui/material'
import { XIcon } from './icons'
import { supabase } from './supabase'
import { processPhotoUploads, type PhotoUpload } from './photoUpload'
export type { PhotoUpload } from './photoUpload'

export type Photo = { id: string; photo_date: string; storage_path: string; thumb_path: string; uploaded_by: string; thumbUrl?: string | null }
export const PHOTO_COLUMNS = 'id,photo_date,storage_path,thumb_path,uploaded_by'

export const bucket = () => supabase.storage.from('photos')

// 개별 서명 URL은 발급 후 취소할 수 없으므로 짧게 유지한다.
// https://supabase.com/docs/guides/storage/serving/downloads#revoke-signed-urls
const URL_TTL = 5 * 60
const REUSE_MARGIN = 30 * 1000

type Signed = Record<string, { url: string; exp: number }>
const pendingUrls = new Map<string, Promise<string | null>>()
let urlCache: Signed = {}
let cacheGeneration = 0

try { localStorage.removeItem('signedUrls') } catch { /* 저장소 접근 불가 */ }
const readCache = (): Signed => ({ ...urlCache })
const writeCache = (c: Signed) => { urlCache = c }
export function clearSignedCache() { cacheGeneration++; urlCache = {}; pendingUrls.clear() }

// 캐시에 없거나 곧 만료될 것만 한 번에 서명해서 채운다
export async function signedUrls(paths: string[]): Promise<(string | null)[]> {
  const cache = readCache()
  const now = Date.now()
  const stale = [...new Set(paths.filter((p) => !(cache[p] && cache[p].exp - now > REUSE_MARGIN)))]
  const missing = stale.filter(p => !pendingUrls.has(p))

  if (missing.length) {
    const generation = cacheGeneration
    const request = bucket().createSignedUrls(missing, URL_TTL).then(({ data }) => {
      if (generation !== cacheGeneration) return null
      const latest = readCache()
      const completedAt = Date.now()
      for (const k of Object.keys(latest)) if (latest[k].exp <= completedAt) delete latest[k]
      data?.forEach((d, i) => {
        if (d.signedUrl) latest[missing[i]] = { url: d.signedUrl, exp: now + URL_TTL * 1000 }
      })
      writeCache(latest)
      return data
    }).catch(() => null)
    missing.forEach((path, index) => {
      const promise = request.then(data => data?.[index]?.signedUrl || null)
      pendingUrls.set(path, promise)
      void promise.finally(() => { if (pendingUrls.get(path) === promise) pendingUrls.delete(path) })
    })
  }
  const fetched = await Promise.all(stale.map(p => pendingUrls.get(p) ?? Promise.resolve(null)))
  const byPath = new Map(stale.map((path, i) => [path, fetched[i]]))
  return paths.map(p => byPath.has(p) ? byPath.get(p) ?? null : cache[p]?.url ?? null)
}

export const signedUrl = async (path: string | null) => (path ? (await signedUrls([path]))[0] : null)

// 사진을 지우면 그 경로의 캐시도 같이 버린다
export function forgetSigned(paths: string[]) {
  const cache = readCache()
  for (const p of paths) delete cache[p]
  writeCache(cache)
}

export async function withThumbs(rows: Photo[]): Promise<Photo[]> {
  if (!rows.length) return []
  const urls = await signedUrls(rows.map((p) => p.thumb_path))
  return rows.map((p, i) => ({ ...p, thumbUrl: urls[i] }))
}

// 긴 변 기준으로 줄여 JPEG로 만든다. 원본 수 MB → 수백 KB
// shortcut: HEIC는 브라우저가 디코딩할 수 있을 때만 된다(사파리 O, 크롬 X). 문제가 되면 heic 변환 라이브러리 검토
export async function resize(file: File, max: number): Promise<Blob> {
  const img = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  img.close()
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('이미지 변환 실패'))), 'image/jpeg', 0.85))
}

export async function uploadPhotos(files: PhotoUpload[], coupleId: string, userId: string, date: string) {
  const paths = (id: string) => ({ storage_path: `${coupleId}/${date}/${id}.jpg`, thumb_path: `${coupleId}/${date}/thumb_${id}.jpg` })
  return processPhotoUploads(files, {
    exists: async id => {
      const existing = await supabase.from('photos').select('id').eq('id', id).maybeSingle()
      if (existing.error) throw existing.error
      return !!existing.data
    },
    save: async ({ file, id }) => {
      const { storage_path, thumb_path } = paths(id)
      const [full, thumb] = await Promise.all([resize(file, 2048), resize(file, 400)])
      for (const [path, blob] of [[storage_path, full], [thumb_path, thumb]] as const) {
        const result = await bucket().upload(path, blob, { contentType: 'image/jpeg' })
        if (result.error) {
          const exists = await bucket().exists(path)
          if (exists.error || !exists.data) throw result.error
        }
      }
      const { error } = await supabase.from('photos').insert({ id, couple_id: coupleId, uploaded_by: userId, photo_date: date, storage_path, thumb_path })
      if (error) throw error
    },
    clean: async ({ id }) => {
      const { storage_path, thumb_path } = paths(id)
      await bucket().remove([storage_path, thumb_path])
    },
  })
}

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
