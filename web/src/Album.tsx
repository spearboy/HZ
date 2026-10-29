import { useCallback, useEffect, useState } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import PhotoLibraryRounded from '@mui/icons-material/PhotoLibraryRounded'
import { koError, supabase } from './supabase'
import { PHOTO_COLUMNS, PhotoGrid, withThumbs, type Photo } from './Photos'
import type { TabProps } from './Home'

// shortcut: 최근 300장만 불러온다. 사진이 많아지면 월 단위 무한 스크롤로 바꾼다
const LIMIT = 300

export default function Album({ userId, version, notify }: TabProps) {
  const [photos, setPhotos] = useState<Photo[] | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('photos').select(PHOTO_COLUMNS)
      .order('photo_date', { ascending: false }).order('created_at', { ascending: false }).limit(LIMIT)
    if (error) return notify(koError(error))
    setPhotos(await withThumbs(data))
  }, [notify])

  useEffect(() => { load() }, [load, version])

  // 월별로 묶는다 (photo_date 내림차순이라 순서가 유지된다)
  const months = new Map<string, Photo[]>()
  for (const p of photos ?? []) {
    const k = p.photo_date.slice(0, 7)
    months.set(k, [...(months.get(k) ?? []), p])
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>앨범</Typography>
      {photos?.length === 0 && (
        <Stack spacing={1} sx={{ alignItems: 'center', py: 8, color: 'text.secondary' }}>
          <PhotoLibraryRounded sx={{ fontSize: 48 }} />
          <Typography>아직 사진이 없어요. 캘린더에서 날짜를 골라 올려 보세요.</Typography>
        </Stack>
      )}
      <Stack spacing={3}>
        {[...months].map(([ym, list]) => (
          <Box key={ym}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>{ym.slice(0, 4)}년 {+ym.slice(5)}월 <Typography component="span" color="text.secondary">· {list.length}장</Typography></Typography>
            <PhotoGrid photos={list} userId={userId} onChanged={load} onError={notify} />
          </Box>
        ))}
      </Stack>
    </Box>
  )
}
