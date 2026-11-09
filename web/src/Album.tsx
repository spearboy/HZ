import { isEnglish, locale, tr } from './language'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { ImageIcon } from '@animateicons/react/lucide'
import { koError, supabase } from './supabase'
import { PHOTO_COLUMNS, PhotoGrid, withThumbs, type Photo } from './Photos'
import type { TabProps } from './Home'
import { GridSkeleton } from './Skeletons'

// shortcut: 최근 300장만 불러온다. 사진이 많아지면 월 단위 무한 스크롤로 바꾼다
const LIMIT = 300

// 사진 목록을 기기에 남겨 두고, 탭을 열면 네트워크를 기다리지 않고 먼저 그린다.
// 서버 응답이 오면 조용히 덮어쓴다. 상대가 사진을 올리면 Realtime이 version을 올려 다시 받아 온다.
// 커플별로 따로 저장한다 (연결을 바꿨을 때 옛 사진이 잠깐이라도 보이지 않게)
const cacheKey = (coupleId: string) => `albumRows:${coupleId}`
const readRows = (coupleId: string): Photo[] | null => {
  try { return JSON.parse(localStorage.getItem(cacheKey(coupleId)) ?? 'null') as Photo[] | null } catch { return null }
}
const writeRows = (coupleId: string, rows: Photo[]) => {
  try { localStorage.setItem(cacheKey(coupleId), JSON.stringify(rows)) } catch { /* 용량 초과면 캐시 없이 간다 */ }
}

export default function Album({ coupleId, userId, version, notify }: TabProps) {
  const [photos, setPhotos] = useState<Photo[] | null>(null)

  const load = useCallback(async (fromCache: boolean) => {
    // 저장해 둔 목록이 있으면 먼저 보여 준다. 썸네일 주소도 캐시에 있으면 요청이 아예 안 나간다
    if (fromCache) {
      const cached = readRows(coupleId)
      if (cached?.length) setPhotos(await withThumbs(cached))
    }
    const { data, error } = await supabase.from('photos').select(PHOTO_COLUMNS)
      .order('photo_date', { ascending: false }).order('created_at', { ascending: false }).limit(LIMIT)
    if (error) return notify(koError(error))
    writeRows(coupleId, data)
    setPhotos(await withThumbs(data))
  }, [coupleId, notify])

  // 캐시는 탭을 처음 열 때만 쓴다. version이 오르면(상대가 바꿈) 서버 것만 받는다
  const first = useRef(true)
  useEffect(() => {
    load(first.current)
    first.current = false
  }, [load, version])

  if (photos === null) return <GridSkeleton />

  // 월별로 묶는다 (photo_date 내림차순이라 순서가 유지된다)
  const months = new Map<string, Photo[]>()
  for (const p of photos ?? []) {
    const k = p.photo_date.slice(0, 7)
    months.set(k, [...(months.get(k) ?? []), p])
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>{tr("앨범")}</Typography>
      {photos?.length === 0 && (
        <Stack spacing={1} sx={{ alignItems: 'center', py: 8, color: 'text.secondary' }}>
          <ImageIcon size={48} />
          <Typography>{tr("아직 사진이 없어요. 캘린더에서 날짜를 골라 올려 보세요.")}</Typography>
        </Stack>
      )}
      <Stack spacing={3}>
        {[...months].map(([ym, list]) => (
          <Box key={ym}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>{new Date(`${ym}-01T00:00`).toLocaleDateString(locale(), { year: 'numeric', month: 'long' })} <Typography component="span" color="text.secondary">· {list.length}{isEnglish() ? ' photos' : '장'}</Typography></Typography>
            <PhotoGrid photos={list} userId={userId} onChanged={() => load(false)} onError={notify} />
          </Box>
        ))}
      </Stack>
    </Box>
  )
}
