import { isEnglish, locale, tr } from './language'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Button, Card, Stack, Typography } from '@mui/material'
import { ImageIcon, ChevronRightIcon } from '@animateicons/react/lucide'
import { koError, supabase } from './supabase'
import { PHOTO_COLUMNS, PhotoGrid, withThumbs, type Photo } from './Photos'
import type { TabProps } from './Home'
import { GridSkeleton } from './Skeletons'
import { ymd } from './repeat'

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

export default function Album({ coupleId, userId, active, photoVersion, notify, openCalendar }: TabProps) {
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [failed, setFailed] = useState(false)
  const loadId = useRef(0)
  const lastVersion = useRef(-1)
  const fetchedAt = useRef(0)

  const load = useCallback(async (fromCache: boolean) => {
    const id = ++loadId.current
    let serverApplied = false
    // 저장해 둔 목록이 있으면 먼저 보여 준다. 썸네일 주소도 캐시에 있으면 요청이 아예 안 나간다
    if (fromCache) {
      const cached = readRows(coupleId)
      if (cached?.length) withThumbs(cached).then(rows => {
        if (id === loadId.current && !serverApplied) setPhotos(rows)
      })
    }
    const { data, error } = await supabase.from('photos').select(PHOTO_COLUMNS)
      .order('photo_date', { ascending: false }).order('created_at', { ascending: false }).limit(LIMIT)
    if (id !== loadId.current) return
    if (error) { lastVersion.current = -1; setFailed(true); return notify(koError(error)) }
    writeRows(coupleId, data)
    const rows = await withThumbs(data)
    if (id !== loadId.current) return
    serverApplied = true
    setFailed(false)
    fetchedAt.current = Date.now()
    setPhotos(rows)
  }, [coupleId, notify])

  // 캐시는 탭을 처음 열 때만 쓴다. version이 오르면(상대가 바꿈) 서버 것만 받는다
  useEffect(() => {
    if (!active || (lastVersion.current === photoVersion && (!fetchedAt.current || Date.now() - fetchedAt.current <= 60_000))) return
    const first = lastVersion.current === -1
    lastVersion.current = photoVersion
    load(first)
  }, [active, load, photoVersion])

  if (photos === null && !failed) return <GridSkeleton />

  // 월별로 묶는다 (photo_date 내림차순이라 순서가 유지된다)
  const months = new Map<string, Photo[]>()
  for (const p of photos ?? []) {
    const k = p.photo_date.slice(0, 7)
    months.set(k, [...(months.get(k) ?? []), p])
  }

  return (
    <Box sx={{ px: 2, pt: 3, pb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography component="h1" sx={{ fontSize: 25, fontWeight: 750, letterSpacing: '-.04em', lineHeight: 1.2 }}>{tr('앨범')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{isEnglish() ? 'The moments we saved together' : '함께 보낸 순간을 모아두었어요'}</Typography>
      </Box>
      {failed && photos === null && <Card sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">{isEnglish() ? 'Could not load your photos.' : '사진을 불러오지 못했어요.'}</Typography>
        <Button size="small" onClick={() => load(false)} sx={{ mt: 0.5, px: 0 }}>{isEnglish() ? 'Try again' : '다시 불러오기'}</Button>
      </Card>}
      {photos?.length === 0 && (
        <Card sx={{ p: 3, minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}>
          <Box sx={{ color: 'primary.main', lineHeight: 0, mb: 2 }}><ImageIcon size={26} /></Box>
          <Typography sx={{ fontSize: 17, fontWeight: 700 }}>{isEnglish() ? 'Your first moment together' : '우리의 첫 순간을 남겨보세요'}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.6 }}>{tr('아직 사진이 없어요. 캘린더에서 날짜를 골라 올려 보세요.')}</Typography>
          <Button onClick={() => openCalendar(ymd(new Date()))} endIcon={<ChevronRightIcon size={16} />} sx={{ mt: 1.5, px: 0 }}>
            {isEnglish() ? 'Open calendar' : '캘린더로 가기'}
          </Button>
        </Card>
      )}
      <Stack spacing={3}>
        {[...months].map(([ym, list]) => (
          <Box key={ym}>
            <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1, mb: 1.25 }}>
              <Typography component="h2" sx={{ fontSize: 17, fontWeight: 700, flex: 1 }}>{new Date(`${ym}-01T00:00`).toLocaleDateString(locale(), { year: 'numeric', month: 'long' })}</Typography>
              <Typography variant="caption" color="text.secondary">{list.length}{isEnglish() ? ' photos' : '장'}</Typography>
            </Stack>
            <PhotoGrid photos={list} userId={userId} onChanged={() => load(false)} onError={notify} />
          </Box>
        ))}
      </Stack>
    </Box>
  )
}
