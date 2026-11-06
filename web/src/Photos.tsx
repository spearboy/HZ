import { useState } from 'react'
import { Box, Button, Dialog, DialogActions, IconButton, ImageList, ImageListItem } from '@mui/material'
import { XIcon } from '@animateicons/react/lucide'
import { supabase } from './supabase'

export type Photo = { id: string; photo_date: string; storage_path: string; thumb_path: string; uploaded_by: string; thumbUrl?: string | null }
export const PHOTO_COLUMNS = 'id,photo_date,storage_path,thumb_path,uploaded_by'

export const bucket = () => supabase.storage.from('photos')

// 비공개 버킷이라 모든 이미지는 서명 URL로만 보인다.
// 그런데 서명할 때마다 URL이 달라져서, 같은 사진인데도 브라우저가 매번 다시 받아 온다.
// 그래서 경로별 URL을 기기에 저장해 두고 유효한 동안 그대로 재사용한다.
// 같은 URL이면 브라우저 디스크 캐시가 그림을 바로 꺼내 주므로 서명 요청도, 다운로드도 사라진다.
const URL_TTL = 6 * 60 * 60          // 서명 URL 유효기간(초)
const REUSE_MARGIN = 10 * 60 * 1000  // 만료 10분 전부터는 새로 받는다
const CACHE_KEY = 'signedUrls'

type Signed = Record<string, { url: string; exp: number }>

const readCache = (): Signed => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Signed } catch { return {} }
}
const writeCache = (c: Signed) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)) } catch { /* 용량 초과 등은 그냥 캐시 없이 간다 */ }
}

// 캐시에 없거나 곧 만료될 것만 한 번에 서명해서 채운다
export async function signedUrls(paths: string[]): Promise<(string | null)[]> {
  const cache = readCache()
  const now = Date.now()
  const stale = [...new Set(paths.filter((p) => !(cache[p] && cache[p].exp - now > REUSE_MARGIN)))]

  if (stale.length) {
    const { data } = await bucket().createSignedUrls(stale, URL_TTL)
    data?.forEach((d, i) => {
      if (d.signedUrl) cache[stale[i]] = { url: d.signedUrl, exp: now + URL_TTL * 1000 }
    })
    // 여러 화면이 동시에 서명을 요청하면 서로의 결과를 덮어쓴다. 쓰기 직전에 다시 읽어 합친다
    const merged = { ...readCache(), ...cache }
    for (const k of Object.keys(merged)) if (merged[k].exp <= now) delete merged[k] // 만료된 건 버린다
    writeCache(merged)
    Object.assign(cache, merged)
  }
  return paths.map((p) => cache[p]?.url ?? null)
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
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('이미지 변환 실패'))), 'image/jpeg', 0.85))
}

export async function uploadPhotos(files: FileList, coupleId: string, userId: string, date: string) {
  for (const file of Array.from(files)) {
    const id = crypto.randomUUID()
    const storage_path = `${coupleId}/${date}/${id}.jpg`
    const thumb_path = `${coupleId}/${date}/thumb_${id}.jpg`
    const [full, thumb] = await Promise.all([resize(file, 2048), resize(file, 400)])
    const up = await bucket().upload(storage_path, full, { contentType: 'image/jpeg' })
    if (up.error) throw up.error
    const upThumb = await bucket().upload(thumb_path, thumb, { contentType: 'image/jpeg' })
    if (upThumb.error) throw upThumb.error
    const { error } = await supabase.from('photos').insert({ couple_id: coupleId, uploaded_by: userId, photo_date: date, storage_path, thumb_path })
    if (error) throw error
  }
}

// 썸네일 그리드 + 누르면 원본 보기(저장/삭제)
export function PhotoGrid({ photos, userId, cols = 3, onChanged, onError }: {
  photos: Photo[]; userId: string; cols?: number; onChanged: () => void; onError: (m: string) => void
}) {
  const [open, setOpen] = useState<Photo | null>(null)
  const [fullUrl, setFullUrl] = useState<string>()

  const show = async (p: Photo) => {
    setOpen(p)
    setFullUrl(undefined)
    setFullUrl((await signedUrl(p.storage_path)) ?? undefined)
  }

  const download = async (p: Photo) => {
    const { data, error } = await bucket().createSignedUrl(p.storage_path, 60, { download: `${p.photo_date}.jpg` })
    if (error) return onError(error.message)
    location.href = data.signedUrl
  }

  const remove = async (p: Photo) => {
    if (!confirm('이 사진을 삭제할까요?')) return
    // 행을 먼저 지워야 실패해도 화면에 깨진 사진이 남지 않는다. 파일 삭제가 실패하면 고아 파일만 남는다
    const { error } = await supabase.from('photos').delete().eq('id', p.id)
    if (error) return onError(error.message)
    await bucket().remove([p.storage_path, p.thumb_path])
    forgetSigned([p.storage_path, p.thumb_path])
    setOpen(null)
    onChanged()
  }

  return (
    <>
      <ImageList cols={cols} gap={6} sx={{ m: 0 }}>
        {photos.map((p) => (
          <ImageListItem key={p.id} onClick={() => show(p)} sx={{ cursor: 'pointer', borderRadius: 3, overflow: 'hidden', aspectRatio: '1' }}>
            <img src={p.thumbUrl ?? undefined} alt={`${p.photo_date} 사진`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </ImageListItem>
        ))}
      </ImageList>

      <Dialog open={!!open} onClose={() => setOpen(null)} fullWidth maxWidth="md">
        <Box sx={{ position: 'relative', bgcolor: 'black', minHeight: 240, display: 'grid', placeItems: 'center' }}>
          {fullUrl && <img src={fullUrl} alt="원본 사진" style={{ maxWidth: '100%', maxHeight: '75dvh', display: 'block' }} />}
          <IconButton aria-label="닫기" onClick={() => setOpen(null)} sx={{ position: 'absolute', top: 8, right: 8, color: 'white', bgcolor: '#0006' }}>
            <XIcon size={22} />
          </IconButton>
        </Box>
        {open && (
          <DialogActions>
            {open.uploaded_by === userId && <Button color="error" onClick={() => remove(open)}>삭제</Button>}
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" onClick={() => download(open)}>저장</Button>
          </DialogActions>
        )}
      </Dialog>
    </>
  )
}
