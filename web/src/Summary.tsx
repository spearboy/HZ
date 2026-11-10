import { isEnglish, locale, tr } from './language'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Box, Button, ButtonBase, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Skeleton, Stack, TextField, Typography, useTheme,
} from '@mui/material'
import { ChevronRightIcon, HeartIcon, PencilIcon } from '@animateicons/react/lucide'
import { koError, supabase } from './supabase'
import { signedUrl } from './Photos'
import ImageFitDialog, { DEFAULT_FIT, FitAvatar, fitImg, type Fit } from './ImageFit'
import { avatarFit } from './Home'
import WeatherCard, { WeatherFx } from './WeatherCard'
import GlassFx, { fxOn } from './GlassFx'
import { getWeather, weatherFx, type Weather } from './weather'
import { coupleDays, dayDiff, dLabel, groupByDay, hm, nextStart, ymd, type Event } from './repeat'
import { ddayEvents, eventsInRange } from './events'
import { holidayName } from './holidays'
import { SummarySkeleton } from './Skeletons'
import type { TabProps } from './Home'
import { poke } from './poke'

// 홈의 '이번 주'는 월요일에 시작해 일요일에 끝난다 (캘린더 탭의 월 그리드는 일요일 시작 그대로)
const WEEK = ['월', '화', '수', '목', '금', '토', '일']
const md = (k: string) => new Date(`${k}T00:00`).toLocaleDateString(locale(), { month: 'long', day: 'numeric' })
// Date.getDay()는 일요일이 0이라, 월요일부터인 WEEK에 넣으려면 한 칸 돌린다
const dow = (k: string) => new Date(`${k}T00:00`).toLocaleDateString(locale(), { weekday: 'short' })

export default function Summary({ coupleId, userId, active, eventVersion, coupleVersion, notify, profiles, colorOf, openCalendar }: TabProps) {
  const { palette } = useTheme()
  const [startedOn, setStartedOn] = useState<string | null | undefined>(undefined)
  const [week, setWeek] = useState<Event[]>([])
  const [ddays, setDdays] = useState<Event[]>([])
  const [eventsReady, setEventsReady] = useState(false)
  const [eventsError, setEventsError] = useState(false)
  const [cover, setCover] = useState<{ url: string | null; path: string | null; fit: Fit }>({ url: null, path: null, fit: DEFAULT_FIT })
  const [weather, setWeather] = useState<Weather | null | undefined>(undefined)
  // 설정에서 끄면 효과를 아예 안 그린다. 탭을 옮기면 다시 읽히므로 따로 전파할 필요가 없다
  const [fx, setFx] = useState(fxOn)
  const [editing, setEditing] = useState(false)
  const [pickingCover, setPickingCover] = useState(false)
  const [coverRatio, setCoverRatio] = useState(16 / 9)
  const cardRef = useRef<HTMLDivElement>(null)
  const eventKey = useRef('')
  const coupleKey = useRef(-1)
  const coupleLoadId = useRef(0)
  const eventLoadId = useRef(0)
  const coupleFetchedAt = useRef(0)
  const eventsFetchedAt = useRef(0)

  const now = new Date()
  const today = ymd(now)
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const days = Array.from({ length: 7 }, (_, i) => ymd(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)))
  const fromDay = days[0]
  const from = weekStart.toISOString()
  const to = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7).toISOString()

  const loadCouple = useCallback(async () => {
    const id = ++coupleLoadId.current
    const c = await supabase.from('couples').select('started_on,cover_path,cover_zoom,cover_x,cover_y').eq('id', coupleId).single()
    if (id !== coupleLoadId.current) return
    if (c.error) { coupleKey.current = -1; return notify(koError(c.error)) }
    const url = await signedUrl(c.data.cover_path)
    if (id !== coupleLoadId.current) return
    setStartedOn(c.data.started_on)
    coupleFetchedAt.current = Date.now()
    setCover({ url, path: c.data.cover_path, fit: { zoom: c.data.cover_zoom, x: c.data.cover_x, y: c.data.cover_y } })
  }, [coupleId, notify])

  const loadEvents = useCallback(async () => {
    const id = ++eventLoadId.current
    const [w, d] = await Promise.all([eventsInRange(from, to, fromDay), ddayEvents()])
    if (id !== eventLoadId.current) return
    if (w.error || d.error) { eventKey.current = ''; setEventsError(true); return notify(koError((w.error ?? d.error)!)) }
    setWeek(w.data); setDdays(d.data); setEventsReady(true); setEventsError(false); eventsFetchedAt.current = Date.now()
  }, [from, to, fromDay, notify])

  useEffect(() => {
    if (active && (coupleKey.current !== coupleVersion || (coupleFetchedAt.current > 0 && Date.now() - coupleFetchedAt.current > 60_000))) { coupleKey.current = coupleVersion; loadCouple() }
  }, [active, coupleVersion, loadCouple])
  useEffect(() => {
    const key = `${from}/${to}/${eventVersion}`
    if (active && (eventKey.current !== key || (eventsFetchedAt.current > 0 && Date.now() - eventsFetchedAt.current > 60_000))) { eventKey.current = key; loadEvents() }
  }, [active, from, to, eventVersion, loadEvents])
  useEffect(() => { if (active) { setFx(fxOn()); getWeather().then(setWeather) } }, [active])

  const saveStart = async (value: string) => {
    const { error } = await supabase.from('couples').update({ started_on: value || null }).eq('id', coupleId)
    if (error) return notify(koError(error))
    setEditing(false)
    loadCouple()
  }

  const saveCover = async (v: Fit & { path: string | null }) => {
    const { error } = await supabase.from('couples')
      .update({ cover_path: v.path, cover_zoom: v.zoom, cover_x: v.x, cover_y: v.y }).eq('id', coupleId)
    if (error) throw error
    setPickingCover(false)
    loadCouple()
  }

  const editCover = () => {
    const card = cardRef.current
    if (card && card.clientHeight) setCoverRatio(card.clientWidth / card.clientHeight)
    setEditing(false)
    setPickingCover(true)
  }

  if (startedOn === undefined) return <SummarySkeleton />

  const me = profiles.find((p) => p.id === userId)
  const partner = profiles.find((p) => p.id !== userId)
  const together = startedOn ? coupleDays(startedOn, today) : null
  const byDay = groupByDay(week, days[0], days[6])
  const todayList = byDay.get(today) ?? []
  const weekWithEvents = days.filter(day => day !== today && ((byDay.get(day)?.length ?? 0) > 0 || holidayName(day)))
  const glass = fx && weather ? weatherFx(weather.code) : 'none'
  const upcoming = ddays
    .map((ev) => ({ ev, on: nextStart(ev, today) }))
    .filter((x): x is { ev: Event; on: string } => x.on !== null)
    .sort((a, b) => a.on.localeCompare(b.on))

  return (
    <Box sx={{ p: 2, pb: 12 }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 2.5, pt: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h1" sx={{ fontSize: 25, fontWeight: 750, letterSpacing: '-.04em', lineHeight: 1.2 }}>MORO</Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">{now.toLocaleDateString(locale(), { month: 'long', day: 'numeric', weekday: 'short' })}</Typography>
            <WeatherCard w={weather} compact />
          </Stack>
        </Box>
        <Button variant="outlined" startIcon={<HeartIcon size={17} />} onClick={() => poke(notify)} sx={{ flexShrink: 0 }}>{tr('콕 찌르기')}</Button>
      </Stack>

      {/* 커플 디데이 */}
      <Card ref={cardRef} sx={{ mb: 3, border: 0, position: 'relative', overflow: 'hidden', minHeight: 196,
        color: '#fff', background: 'linear-gradient(125deg, #29233f 0%, #514574 56%, #596a9b 100%)' }}>
        {cover.url && (
          <>
            <Box sx={{ position: 'absolute', inset: 0 }}><img src={cover.url} alt="" style={fitImg(cover.fit)} /></Box>
            {/* 어떤 사진을 올려도 글자가 읽히게 덮는다 */}
            <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #00000052, #000000ad)' }} />
          </>
        )}
        {fx && weather && <WeatherFx code={weather.code} />}
        {glass !== 'none' && <GlassFx kind={glass} seed={+today.replaceAll('-', '')} />}
        <Box sx={{ position: 'relative', p: 2.5, pointerEvents: 'none', userSelect: 'none' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
          {[me, partner].map((p, i) => p && (
            <Stack key={p.id} direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
              {i === 1 && <Box sx={{ mr: 0.25, lineHeight: 0 }}><HeartIcon size={16} /></Box>}
              <FitAvatar url={p.avatarUrl} fit={avatarFit(p)} size={32} bg={colorOf(p.id)}
                fg={palette.getContrastText(colorOf(p.id))} label={p.display_name ?? '?'} />
              <Typography variant="body2" noWrap sx={{ fontWeight: 700, maxWidth: 78 }}>{p.display_name ?? tr("이름 없음")}</Typography>
            </Stack>
          ))}
          <Box sx={{ flex: 1 }} />
          <IconButton aria-label={tr("홈 카드 수정")} size="small" sx={{ color: 'inherit', pointerEvents: 'auto' }} onClick={() => setEditing(true)}><PencilIcon size={18} /></IconButton>
        </Stack>
        {together ? (
          <>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>{tr("함께한 지")}</Typography>
            <Typography sx={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.15 }}>{together.n.toLocaleString(locale())}{isEnglish() ? ' days' : '일'}</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', rowGap: 1 }}>
              <Chip size="small" label={`${together.hundred.n}${isEnglish() ? ' days' : '일'} ${dLabel(together.hundred.left)}`}
                sx={{ bgcolor: '#251e3de6', color: 'inherit', border: '1px solid #ffffff40', '@supports (backdrop-filter: blur(8px))': { bgcolor: '#251e3dba', backdropFilter: 'blur(8px)' }, '@media (prefers-reduced-transparency: reduce)': { bgcolor: '#251e3d', backdropFilter: 'none' } }} />
              <Chip size="small" label={`${together.anniversary.years}${isEnglish() ? '-year anniversary' : '주년'} ${dLabel(together.anniversary.left)}`}
                sx={{ bgcolor: '#251e3de6', color: 'inherit', border: '1px solid #ffffff40', '@supports (backdrop-filter: blur(8px))': { bgcolor: '#251e3dba', backdropFilter: 'blur(8px)' }, '@media (prefers-reduced-transparency: reduce)': { bgcolor: '#251e3d', backdropFilter: 'none' } }} />
            </Stack>
          </>
        ) : startedOn === null && (
          <>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>{tr("사귄 날을 알려 주세요")}</Typography>
            <Button variant="contained" onClick={() => setEditing(true)} sx={{ bgcolor: '#fff', color: 'primary.main', pointerEvents: 'auto' }}>{tr("사귄 날 설정")}</Button>
          </>
        )}
        </Box>
      </Card>

      <Box component="section" sx={{ mb: 3 }}>
        <Stack direction="row" sx={{ alignItems: 'baseline', mb: 1.25 }}>
          <Typography component="h2" sx={{ fontSize: 17, fontWeight: 750, flex: 1 }}>{isEnglish() ? 'Today' : '오늘의 일정'}</Typography>
          <Button size="small" onClick={() => openCalendar(today)} endIcon={<ChevronRightIcon size={16} />} sx={{ minHeight: 32, px: 0.5 }}>
            {isEnglish() ? 'Calendar' : '캘린더'}
          </Button>
        </Stack>
        {!eventsReady && !eventsError ? <Skeleton variant="rounded" height={86} /> : eventsError && !eventsReady ? (
          <Card sx={{ p: 2 }}><Typography variant="body2" color="text.secondary">{isEnglish() ? 'Could not load your events.' : '일정을 불러오지 못했어요.'}</Typography>
            <Button size="small" onClick={loadEvents} sx={{ mt: 0.5, px: 0 }}>{isEnglish() ? 'Try again' : '다시 불러오기'}</Button></Card>
        ) : todayList.length ? (
          <Card>
            {todayList.map(({ ev }, i) => <ButtonBase key={ev.id} onClick={() => openCalendar(today)}
              sx={{ width: '100%', display: 'flex', textAlign: 'left', alignItems: 'center', gap: 1.5, px: 2, py: 1.5,
                borderTop: i ? 1 : 0, borderColor: 'divider', '&:hover': { bgcolor: 'action.hover' },
                '&.Mui-focusVisible': { outline: '2px solid var(--mui-palette-primary-main)', outlineOffset: -3 } }}>
              <Box sx={{ width: 4, alignSelf: 'stretch', minHeight: 32, borderRadius: 1, bgcolor: colorOf(ev.created_by) }} />
              <Box sx={{ minWidth: 0, flex: 1 }}><Typography noWrap sx={{ fontWeight: 700 }}>{ev.title}</Typography>
                <Typography variant="body2" color="text.secondary">{ev.all_day ? tr('하루 종일') : hm(new Date(ev.start_at))}</Typography></Box>
              <Box sx={{ color: 'text.disabled', lineHeight: 0 }}><ChevronRightIcon size={18} /></Box>
            </ButtonBase>)}
          </Card>
        ) : (
          <ButtonBase onClick={() => openCalendar(today)} sx={{ width: '100%', borderRadius: '14px', textAlign: 'left', justifyContent: 'space-between',
            bgcolor: 'background.paper', border: 1, borderColor: 'divider', px: 2, py: 2, gap: 1,
            '&:hover': { bgcolor: 'action.hover' }, '&.Mui-focusVisible': { outline: '2px solid var(--mui-palette-primary-main)', outlineOffset: 2 } }}>
            <Box><Typography sx={{ fontWeight: 700 }}>{isEnglish() ? 'A little room to breathe' : '오늘은 여유로운 하루예요'}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{isEnglish() ? 'Open the calendar to add a plan.' : '캘린더에서 새로운 일정을 추가해 보세요.'}</Typography></Box>
            <Box sx={{ color: 'text.disabled', lineHeight: 0 }}><ChevronRightIcon size={18} /></Box>
          </ButtonBase>
        )}
      </Box>

      <Box component="section" sx={{ mb: 3 }}>
        <Typography component="h2" sx={{ fontSize: 17, fontWeight: 750, mb: 1.25 }}>{isEnglish() ? 'Coming up' : '다가오는 날'}</Typography>
        {!eventsReady && !eventsError ? <Skeleton variant="rounded" height={72} /> : !eventsReady ? null : upcoming.length ? (
          <Card>{upcoming.map(({ ev, on }, i) => {
            const left = dayDiff(today, on)
            return <ButtonBase key={ev.id} onClick={() => openCalendar(on)} sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5,
              textAlign: 'left', borderTop: i ? 1 : 0, borderColor: 'divider', '&:hover': { bgcolor: 'action.hover' },
              '&.Mui-focusVisible': { outline: '2px solid var(--mui-palette-primary-main)', outlineOffset: -3 } }}>
              <Typography sx={{ minWidth: 56, color: 'primary.main', fontSize: 15, fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}>{dLabel(left)}</Typography>
              <Box sx={{ minWidth: 0, flex: 1 }}><Typography noWrap sx={{ fontWeight: 700 }}>{ev.title}</Typography>
                <Typography variant="body2" color="text.secondary">{md(on)} {dow(on)}</Typography></Box>
              <Box sx={{ color: 'text.disabled', lineHeight: 0 }}><ChevronRightIcon size={18} /></Box>
            </ButtonBase>
          })}</Card>
        ) : <Typography variant="body2" color="text.secondary" sx={{ px: 0.25 }}>{tr("일정을 만들 때 '홈에 디데이로 표시'를 켜면 여기에 나와요.")}</Typography>}
      </Box>

      <Box component="section">
        <Stack direction="row" sx={{ alignItems: 'baseline', mb: 1.25 }}>
          <Typography component="h2" sx={{ fontSize: 17, fontWeight: 750, flex: 1 }}>{tr('이번 주')}</Typography>
          <Button size="small" onClick={() => openCalendar(today)} endIcon={<ChevronRightIcon size={16} />} sx={{ minHeight: 32, px: 0.5 }}>{isEnglish() ? 'View calendar' : '캘린더 보기'}</Button>
        </Stack>
        <Card sx={{ p: 1 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
            {days.map((day, i) => {
              const isToday = day === today, hasEvents = (byDay.get(day)?.length ?? 0) > 0
              const name = isEnglish() ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i] : WEEK[i]
              return <ButtonBase key={day} onClick={() => openCalendar(day)} aria-label={new Date(day + 'T00:00').toLocaleDateString(locale(), { month: 'long', day: 'numeric', weekday: 'long' })}
                sx={{ minWidth: 0, minHeight: 68, borderRadius: '10px', flexDirection: 'column', gap: 0.5, bgcolor: isToday ? 'action.selected' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' }, '&.Mui-focusVisible': { outline: '2px solid var(--mui-palette-primary-main)', outlineOffset: -2 } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>{name}</Typography>
                <Typography sx={{ fontSize: 16, lineHeight: 1.2, fontWeight: isToday ? 750 : 600, color: isToday ? 'primary.main' : 'text.primary' }}>{+day.slice(8)}</Typography>
                <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: hasEvents ? 'primary.main' : 'transparent' }} />
              </ButtonBase>
            })}
          </Box>
          {eventsReady && weekWithEvents.length > 0 && <Box sx={{ mt: 0.75, pt: 0.75, borderTop: 1, borderColor: 'divider' }}>
            {weekWithEvents.map(day => <ButtonBase key={day} onClick={() => openCalendar(day)} sx={{ width: '100%', px: 1, py: 1,
              borderRadius: 1, display: 'flex', alignItems: 'flex-start', gap: 1, textAlign: 'left', '&:hover': { bgcolor: 'action.hover' },
              '&.Mui-focusVisible': { outline: '2px solid var(--mui-palette-primary-main)', outlineOffset: -2 } }}>
              <Typography variant="body2" color="text.secondary" sx={{ width: 48, flexShrink: 0 }}>{+day.slice(5, 7)}/{+day.slice(8)}</Typography>
              <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                {holidayName(day) && <Typography variant="body2" color="error.main" noWrap>{tr(holidayName(day)!)}</Typography>}
                {(byDay.get(day) ?? []).map(({ ev }) => <Stack key={ev.id} direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: colorOf(ev.created_by), flexShrink: 0 }} />
                  <Typography variant="body2" noWrap sx={{ fontWeight: 600, minWidth: 0, flex: 1 }}>{ev.title}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>{ev.all_day ? tr('종일') : hm(new Date(ev.start_at))}</Typography>
                </Stack>)}
              </Stack>
            </ButtonBase>)}
          </Box>}
        </Card>
      </Box>

      {editing && <StartDialog value={startedOn ?? ''} onClose={() => setEditing(false)} onSave={saveStart} onEditCover={editCover} />}
      {pickingCover && <ImageFitDialog title={tr("메인 카드 배경")} ratio={coverRatio} max={1600} prefix={`${coupleId}/cover`}
        url={cover.url} path={cover.path} fit={cover.fit} onClose={() => setPickingCover(false)} onSave={saveCover} onError={notify} />}
    </Box>
  )
}

function StartDialog({ value, onClose, onSave, onEditCover }: { value: string; onClose: () => void; onSave: (v: string) => void; onEditCover: () => void }) {
  const [v, setV] = useState(value)
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{tr("홈 카드 수정")}</DialogTitle>
      <DialogContent>
        <Button fullWidth variant="outlined" onClick={onEditCover} sx={{ mb: 2 }}>{tr("배경 사진 변경 · 위치 조정")}</Button>
        <TextField type="date" label={tr("날짜")} value={v} onChange={(e) => setV(e.target.value)} sx={{ mt: 1 }}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: ymd(new Date()) } }} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{tr("취소")}</Button>
        <Button variant="contained" disabled={!v} onClick={() => onSave(v)}>{tr("저장")}</Button>
      </DialogActions>
    </Dialog>
  )
}
