import { useEffect, useState } from 'react'
import { Alert, Box, Button, Card, CircularProgress, Stack, Typography } from '@mui/material'
import { isEnglish } from './language'
import { koError, supabase } from './supabase'

type Couple = { couple_id: string; created_at: string; members: string[]; event_count: number; photo_count: number; latest_record_at: string | null }
type Activity = { day: string; events: number; photos: number }
const PAGE_SIZE = 50

export default function AdminCouples() {
  const en = isEnglish()
  const [couples, setCouples] = useState<Couple[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [activity, setActivity] = useState<Activity[] | null>(null)
  const [error, setError] = useState('')
  const [activityError, setActivityError] = useState('')
  const [page, setPage] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    let active = true
    void supabase.rpc('admin_couple_overview', { p_offset: 0, p_limit: PAGE_SIZE }).then(({ data, error: queryError }) => {
      if (!active) return
      if (queryError) { setError(koError(queryError)); setCouples([]); return }
      const items = data as Couple[]
      setCouples(items); setHasMore(items.length === PAGE_SIZE); setSelected(items[0]?.couple_id ?? null)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selected) return
    let active = true
    void supabase.rpc('admin_couple_activity', { p_couple_id: selected }).then(({ data, error: queryError }) => {
      if (!active) return
      if (queryError) { setActivityError(koError(queryError)); return }
      setActivity(data as Activity[])
    })
    return () => { active = false }
  }, [selected])

  const more = async () => {
    if (loadingMore) return
    setLoadingMore(true)
    const result = await supabase.rpc('admin_couple_overview', { p_offset: (page + 1) * PAGE_SIZE, p_limit: PAGE_SIZE })
    setLoadingMore(false)
    if (result.error) { setError(koError(result.error)); return }
    const items = result.data as Couple[]
    setCouples(previous => [...(previous ?? []), ...items.filter(item => !(previous ?? []).some(old => old.couple_id === item.couple_id))])
    setPage(value => value + 1); setHasMore(items.length === PAGE_SIZE)
  }
  const select = (id: string) => { if (id !== selected) { setActivity(null); setActivityError(''); setSelected(id) } }
  const current = couples?.find(item => item.couple_id === selected)
  const peak = Math.max(1, ...(activity ?? []).map(item => item.events + item.photos))
  const formatDate = (date: string) => new Date(date).toLocaleDateString(en ? 'en-US' : 'ko-KR', { timeZone: 'Asia/Seoul' })

  return <Box>
    <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>{en ? 'Counts show saved records, not visits or time spent.' : '저장된 기록을 기준으로 집계해요. 방문 횟수나 이용 시간은 포함되지 않아요.'}</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(260px, 340px) minmax(0, 1fr)' }, gap: 2, alignItems: 'start' }}>
      <Card sx={{ p: 1 }}>
        <Typography component="h2" sx={{ px: 1.5, py: 1, fontWeight: 700 }}>{en ? 'Couples' : '커플 목록'}</Typography>
        {couples === null ? <Box sx={{ p: 2 }}><CircularProgress size={22} /></Box> : couples.length === 0 ? <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>{en ? 'No couples yet.' : '등록된 커플이 없어요.'}</Typography> : couples.map(item => <Button key={item.couple_id} fullWidth onClick={() => select(item.couple_id)} aria-pressed={selected === item.couple_id} sx={{ display: 'block', textAlign: 'left', color: 'text.primary', p: 1.5, bgcolor: selected === item.couple_id ? 'action.selected' : 'transparent' }}>
          <Typography noWrap sx={{ fontWeight: 700 }}>{item.members.join(' · ')}</Typography>
          <Typography variant="caption" color="text.secondary">{item.members.length < 2 ? (en ? 'Waiting for partner' : '상대방 연결 대기') : (en ? 'Connected' : '연결됨')} · {formatDate(item.created_at)}</Typography>
        </Button>)}
        {hasMore && <Button fullWidth onClick={more} disabled={loadingMore}>{loadingMore ? (en ? 'Loading…' : '불러오는 중…') : (en ? 'Load more' : '더 보기')}</Button>}
      </Card>
      {current && <Card sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography component="h2" sx={{ fontSize: 21, fontWeight: 750, overflowWrap: 'anywhere' }}>{current.members.join(' · ')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{en ? 'Couple created' : '커플 생성'} {formatDate(current.created_at)} · {en ? 'Latest record' : '최근 기록'} {current.latest_record_at ? formatDate(current.latest_record_at) : (en ? 'None' : '없음')}</Typography>
        <Stack direction="row" spacing={5} sx={{ mt: 3, mb: 4 }}>
          <Box><Typography variant="body2" color="text.secondary">{en ? 'Saved events' : '저장된 일정'}</Typography><Typography sx={{ fontSize: 27, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{current.event_count}</Typography></Box>
          <Box><Typography variant="body2" color="text.secondary">{en ? 'Saved photos' : '저장된 사진'}</Typography><Typography sx={{ fontSize: 27, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{current.photo_count}</Typography></Box>
        </Stack>
        <Typography component="h3" sx={{ fontWeight: 700 }}>{en ? 'Records added in the last 14 days' : '최근 14일간 새로 남긴 기록'}</Typography>
        <Typography variant="caption" color="text.secondary">{en ? 'Events and photos by creation date · Korea time' : '일정과 사진의 생성일 기준 · 한국 시간'}</Typography>
        {activityError ? <Alert severity="error" sx={{ mt: 2 }}>{activityError}</Alert> : activity === null ? <Box sx={{ mt: 2 }}><CircularProgress size={20} /></Box> : <>
          <Box role="img" aria-label={activity.map(item => `${item.day}: ${en ? 'events' : '일정'} ${item.events}, ${en ? 'photos' : '사진'} ${item.photos}`).join('; ')} sx={{ display: 'flex', gap: { xs: 0.5, sm: 1 }, height: 160, alignItems: 'end', mt: 2 }}>
            {activity.map(item => <Box key={item.day} title={`${item.day} · ${en ? 'Events' : '일정'} ${item.events} · ${en ? 'Photos' : '사진'} ${item.photos}`} sx={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'end', minWidth: 0 }}>
              <Box sx={{ height: `${item.photos / peak * 100}%`, bgcolor: '#7895a8' }} /><Box sx={{ height: `${item.events / peak * 100}%`, bgcolor: '#273e4a' }} />
              <Box sx={{ height: 1, bgcolor: 'divider' }} />
            </Box>)}
          </Box>
          <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 0.75 }}><Typography variant="caption" color="text.secondary">{activity[0]?.day.slice(5)}</Typography><Typography variant="caption" color="text.secondary">{activity.at(-1)?.day.slice(5)}</Typography></Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>■ {en ? 'Events' : '일정'}　<span style={{ color: '#7895a8' }}>■</span> {en ? 'Photos' : '사진'}</Typography>
        </>}
      </Card>}
    </Box>
  </Box>
}
