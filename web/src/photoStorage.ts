import { supabase } from './supabase'
import { processPhotoUploads, uploadTogether, type PhotoUpload } from './photoUpload'
export type { PhotoUpload } from './photoUpload'

export type Photo = { id: string; photo_date: string; created_at: string; storage_path: string; thumb_path: string; uploaded_by: string; thumbUrl?: string | null }
export const PHOTO_COLUMNS = 'id,photo_date,created_at,storage_path,thumb_path,uploaded_by'

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
  try { return await resizeBitmap(img, max) } finally { img.close() }
}

async function resizeBitmap(img: ImageBitmap, max: number): Promise<Blob> {
  const scale = Math.min(1, max / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
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
      const img = await createImageBitmap(file)
      let full: Blob, thumb: Blob
      try { [full, thumb] = await Promise.all([resizeBitmap(img, 2048), resizeBitmap(img, 400)]) } finally { img.close() }
      await uploadTogether(([[storage_path, full], [thumb_path, thumb]] as const).map(([path, blob]) => async () => {
        const result = await bucket().upload(path, blob, { contentType: 'image/jpeg' })
        if (result.error) {
          const exists = await bucket().exists(path)
          if (exists.error || !exists.data) throw result.error
        }
      }))
      const { error } = await supabase.from('photos').insert({ id, couple_id: coupleId, uploaded_by: userId, photo_date: date, storage_path, thumb_path })
      if (error) throw error
    },
    clean: async ({ id }) => {
      const { storage_path, thumb_path } = paths(id)
      await bucket().remove([storage_path, thumb_path])
    },
  })
}
