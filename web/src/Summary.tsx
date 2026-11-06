import { useCallback, useEffect, useState } from 'react'
import {
  Box, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography, useTheme,
} from '@mui/material'
import { HeartIcon, PencilIcon } from '@animateicons/react/lucide'
import { koError, supabase } from './supabase'
import { signedUrl } from './Photos'
import { DEFAULT_FIT, FitAvatar, fitImg, type Fit } from './ImageFit'
import { avatarFit } from './Home'
import WeatherCard, { WeatherFx } from './WeatherCard'
import GlassFx, { fxOn } from './GlassFx'
import { getWeather, weatherFx, type Weather } from './weather'
import { coupleDays, dayDiff, dLabel, groupByDay, hm, nextStart, ymd, type Event } from './repeat'
import { ddayEvents, eventsInRange } from './events'
import { holidayName } from './holidays'
import { SummarySkeleton } from './Skeletons'
import type { TabProps } from './Home'

// 홈의 '이번 주'는 월요일에 시작해 일요일에 끝난다 (캘린더 탭의 월 그리드는 일요일 시작 그대로)
const WEEK = ['월', '화', '수', '목', '금', '토', '일']
const SAT = 5
const SUN = 6
const md = (k: string) => `${+k.slice(5, 7)}월 ${+k.slice(8)}일`
// Date.getDay()는 일요일이 0이라, 월요일부터인 WEEK에 넣으려면 한 칸 돌린다
const dow = (k: string) => WEEK[(new Date(`${k}T00:00`).getDay() + 6) % 7]

export default function Summary({ coupleId, userId, version, notify, profiles, colorOf }: TabProps) {
  const { palette } = useTheme()
  const [startedOn, setStartedOn] = useState<string | null | undefined>(undefined)
  const [week, setWeek] = useState<Event[]>([])
  const [ddays, setDdays] = useState<Event[]>([])
  const [cover, setCover] = useState<{ url: string | null; fit: Fit }>({ url: null, fit: DEFAULT_FIT })
  const [weather, setWeather] = useState<Weather | null | undefined>(undefined)
  // 설정에서 끄면 효과를 아예 안 그린다. 탭을 옮기면 다시 읽히므로 따로 전파할 필요가 없다
  const [fx] = useState(fxOn)
  const [editing, setEditing] = useState(false)

  const now = new Date()
  const today = ymd(now)
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const days = Array.from({ length: 7 }, (_, i) => ymd(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)))
  const fromDay = days[0]
  const from = weekStart.toISOString()
  const to = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7).toISOString()

  const load = useCallback(async () => {
    const [c, w, d] = await Promise.all([
      supabase.from('couples').select('started_on,cover_path,cover_zoom,cover_x,cover_y').eq('id', coupleId).single(),
      eventsInRange(from, to, fromDay),
      ddayEvents(),
    ])
    if (c.error || w.error || d.error) return notify(koError((c.error ?? w.error ?? d.error)!))
    setStartedOn(c.data.started_on)
    setWeek(w.data)
    setDdays(d.data)
    setCover({ url: await signedUrl(c.data.cover_path), fit: { zoom: c.data.cover_zoom, x: c.data.cover_x, y: c.data.cover_y } })
  }, [coupleId, from, to, fromDay, notify])

  useEffect(() => { load() }, [load, version])
  // 날씨는 커플 데이터와 무관해서 version과 상관없이 한 번만 (안에서 10분 캐시한다)
  useEffect(() => { getWeather().then(setWeather) }, [])

  const saveStart = async (value: string) => {
    const { error } = await supabase.from('couples').update({ started_on: value || null }).eq('id', coupleId)
    if (error) return notify(koError(error))
    setEditing(false)
    load()
  }

  if (startedOn === undefined) return <SummarySkeleton />

  const me = profiles.find((p) => p.id === userId)
  const partner = profiles.find((p) => p.id !== userId)
  const together = startedOn ? coupleDays(startedOn, today) : null
  const byDay = groupByDay(week, days[0], days[6])
  const glass = fx && weather ? weatherFx(weather.code) : 'none'
  const upcoming = ddays
    .map((ev) => ({ ev, on: nextStart(ev, today) }))
    .filter((x): x is { ev: Event; on: string } => x.on !== null)
    .sort((a, b) => a.on.localeCompare(b.on))

  return (
    <Box sx={{ p: 2, pb: 12 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>홈</Typography>

      {/* 커플 디데이 (배경 사진은 설정 > 메인 카드 배경에서 바꾼다) */}
      <Card sx={{ mb: 3, border: 0, position: 'relative', overflow: 'hidden', minHeight: 176,
        color: cover.url ? '#fff' : 'primary.contrastText',
        background: 'linear-gradient(135deg, var(--mui-palette-primary-main), var(--mui-palette-secondary-main))' }}>
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
              <Typography variant="body2" noWrap sx={{ fontWeight: 700, maxWidth: 78 }}>{p.display_name ?? '이름 없음'}</Typography>
            </Stack>
          ))}
          <Box sx={{ flex: 1 }} />
          {startedOn && <IconButton aria-label="사귄 날 바꾸기" size="small" sx={{ color: 'inherit', pointerEvents: 'auto' }} onClick={() => setEditing(true)}><PencilIcon size={18} /></IconButton>}
        </Stack>
        {together ? (
          <>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>함께한 지</Typography>
            <Typography sx={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1 }}>{together.n.toLocaleString()}일</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', rowGap: 1 }}>
              <Chip size="small" label={`${together.hundred.n}일 ${dLabel(together.hundred.left)}`} sx={{ bgcolor: '#ffffff40', color: 'inherit' }} />
              <Chip size="small" label={`${together.anniversary.years}주년 ${dLabel(together.anniversary.left)}`} sx={{ bgcolor: '#ffffff40', color: 'inherit' }} />
            </Stack>
          </>
        ) : startedOn === null && (
          <>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>사귄 날을 알려 주세요</Typography>
            <Button variant="contained" onClick={() => setEditing(true)} sx={{ bgcolor: '#fff', color: 'primary.main', pointerEvents: 'auto' }}>사귄 날 설정</Button>
          </>
        )}
        </Box>
      </Card>

      <WeatherCard w={weather} />

      {/* 일정 디데이 */}
      <Typography component="h2" sx={{ fontWeight: 700, mb: 1 }}>디데이</Typography>
      <Stack spacing={1} sx={{ mb: 3 }}>
        {upcoming.map(({ ev, on }) => {
          const left = dayDiff(today, on)
          return (
            <Card key={ev.id}>
              <Stack direction="row" spacing={1.5} sx={{ p: 1.5, alignItems: 'center' }}>
                <Box sx={{ minWidth: 64, py: 0.5, borderRadius: 2, textAlign: 'center', fontWeight: 800, fontSize: 15,
                  bgcolor: left === 0 ? 'primary.main' : 'action.hover', color: left === 0 ? 'primary.contrastText' : 'primary.main' }}>
                  {dLabel(left)}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }} noWrap>{ev.title}</Typography>
                  <Typography variant="caption" color="text.secondary">{md(on)} {dow(on)}요일</Typography>
                </Box>
              </Stack>
            </Card>
          )
        })}
        {!upcoming.length && (
          <Typography variant="body2" color="text.secondary">일정을 만들 때 '홈에 디데이로 표시'를 켜면 여기에 나와요.</Typography>
        )}
      </Stack>

      {/* 이번 주 */}
      <Typography component="h2" sx={{ fontWeight: 700, mb: 1 }}>이번 주</Typography>
      <Card>
        {days.map((k, i) => {
          const list = byDay.get(k) ?? []
          const hol = holidayName(k)
          const isToday = k === today
          return (
            <Stack key={k} direction="row" spacing={1.5} sx={{ px: 1.5, py: 1.25, alignItems: 'flex-start',
              borderTop: i ? 1 : 0, borderColor: 'divider', bgcolor: isToday ? 'action.hover' : 'transparent', opacity: k < today ? 0.5 : 1 }}>
              <Box sx={{ width: 40, textAlign: 'center', flexShrink: 0 }}>
                <Typography variant="caption" sx={{ color: hol || i === SUN ? 'error.main' : i === SAT ? 'info.main' : 'text.secondary', fontWeight: 600 }}>{WEEK[i]}</Typography>
                <Typography sx={{ fontWeight: isToday ? 800 : 600, lineHeight: 1.2,
                  color: isToday ? 'primary.main' : hol ? 'error.main' : 'text.primary' }}>{+k.slice(8)}</Typography>
              </Box>
              <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0, pt: 0.25 }}>
                {hol && <Typography variant="body2" sx={{ fontWeight: 700, color: 'error.main' }}>{hol}</Typography>}
                {list.map(({ ev }) => (
                  <Stack key={ev.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colorOf(ev.created_by), flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{ev.title}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>{ev.all_day ? '종일' : hm(new Date(ev.start_at))}</Typography>
                  </Stack>
                ))}
                {!list.length && !hol && <Typography variant="body2" color="text.disabled">일정 없음</Typography>}
              </Stack>
            </Stack>
          )
        })}
      </Card>

      {editing && <StartDialog value={startedOn ?? ''} onClose={() => setEditing(false)} onSave={saveStart} />}
    </Box>
  )
}

function StartDialog({ value, onClose, onSave }: { value: string; onClose: () => void; onSave: (v: string) => void }) {
  const [v, setV] = useState(value)
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>사귄 날</DialogTitle>
      <DialogContent>
        <TextField type="date" label="날짜" value={v} onChange={(e) => setV(e.target.value)} sx={{ mt: 1 }}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: ymd(new Date()) } }} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>취소</Button>
        <Button variant="contained" disabled={!v} onClick={() => onSave(v)}>저장</Button>
      </DialogActions>
    </Dialog>
  )
}
