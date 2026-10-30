import { useCallback, useEffect, useState } from 'react'
import {
  Avatar, Box, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography, useTheme,
} from '@mui/material'
import FavoriteRounded from '@mui/icons-material/FavoriteRounded'
import EditRounded from '@mui/icons-material/EditRounded'
import { koError, supabase } from './supabase'
import { coupleDays, dayDiff, dLabel, groupByDay, hm, nextStart, ymd, type Event } from './repeat'
import { ddayEvents, eventsInRange } from './events'
import type { TabProps } from './Home'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const md = (k: string) => `${+k.slice(5, 7)}월 ${+k.slice(8)}일`

export default function Summary({ coupleId, userId, version, notify, profiles, colorOf }: TabProps) {
  const { palette } = useTheme()
  const [startedOn, setStartedOn] = useState<string | null | undefined>(undefined)
  const [week, setWeek] = useState<Event[]>([])
  const [ddays, setDdays] = useState<Event[]>([])
  const [editing, setEditing] = useState(false)

  const now = new Date()
  const today = ymd(now)
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())
  const days = Array.from({ length: 7 }, (_, i) => ymd(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)))
  const fromDay = days[0]
  const from = weekStart.toISOString()
  const to = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7).toISOString()

  const load = useCallback(async () => {
    const [c, w, d] = await Promise.all([
      supabase.from('couples').select('started_on').eq('id', coupleId).single(),
      eventsInRange(from, to, fromDay),
      ddayEvents(),
    ])
    if (c.error || w.error || d.error) return notify(koError((c.error ?? w.error ?? d.error)!))
    setStartedOn(c.data.started_on)
    setWeek(w.data)
    setDdays(d.data)
  }, [coupleId, from, to, fromDay, notify])

  useEffect(() => { load() }, [load, version])

  const saveStart = async (value: string) => {
    const { error } = await supabase.from('couples').update({ started_on: value || null }).eq('id', coupleId)
    if (error) return notify(koError(error))
    setEditing(false)
    load()
  }

  const me = profiles.find((p) => p.id === userId)
  const partner = profiles.find((p) => p.id !== userId)
  const together = startedOn ? coupleDays(startedOn, today) : null
  const byDay = groupByDay(week, days[0], days[6])
  const upcoming = ddays
    .map((ev) => ({ ev, on: nextStart(ev, today) }))
    .filter((x): x is { ev: Event; on: string } => x.on !== null)
    .sort((a, b) => a.on.localeCompare(b.on))

  return (
    <Box sx={{ p: 2, pb: 12 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>홈</Typography>

      {/* 커플 디데이 */}
      <Card sx={{ mb: 3, p: 2.5, border: 0, color: 'primary.contrastText',
        background: 'linear-gradient(135deg, var(--mui-palette-primary-main), var(--mui-palette-secondary-main))' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
          {[me, partner].map((p, i) => p && (
            <Stack key={p.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              {i === 1 && <FavoriteRounded sx={{ fontSize: 18, mx: 0.5 }} />}
              <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: colorOf(p.id), color: palette.getContrastText(colorOf(p.id)), border: '2px solid #fff' }}>
                {p.display_name?.[0] ?? '?'}
              </Avatar>
            </Stack>
          ))}
          <Box sx={{ flex: 1 }} />
          {startedOn && <IconButton aria-label="사귄 날 바꾸기" size="small" sx={{ color: 'inherit' }} onClick={() => setEditing(true)}><EditRounded fontSize="small" /></IconButton>}
        </Stack>
        {together ? (
          <>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>함께한 지</Typography>
            <Typography sx={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1 }}>{together.n.toLocaleString()}일</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', rowGap: 1 }}>
              <Chip size="small" label={`${together.hundred.n}일 ${dLabel(together.hundred.left)}`} sx={{ bgcolor: '#ffffff40', color: 'inherit', fontWeight: 700 }} />
              <Chip size="small" label={`${together.anniversary.years}주년 ${dLabel(together.anniversary.left)}`} sx={{ bgcolor: '#ffffff40', color: 'inherit', fontWeight: 700 }} />
            </Stack>
          </>
        ) : startedOn === null && (
          <>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>사귄 날을 알려 주세요</Typography>
            <Button variant="contained" onClick={() => setEditing(true)} sx={{ bgcolor: '#fff', color: 'primary.main' }}>사귄 날 설정</Button>
          </>
        )}
      </Card>

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
                  <Typography variant="caption" color="text.secondary">{md(on)} {WEEK[new Date(`${on}T00:00`).getDay()]}요일</Typography>
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
          const isToday = k === today
          return (
            <Stack key={k} direction="row" spacing={1.5} sx={{ px: 1.5, py: 1.25, alignItems: 'flex-start',
              borderTop: i ? 1 : 0, borderColor: 'divider', bgcolor: isToday ? 'action.hover' : 'transparent', opacity: k < today ? 0.5 : 1 }}>
              <Box sx={{ width: 40, textAlign: 'center', flexShrink: 0 }}>
                <Typography variant="caption" sx={{ color: i === 0 ? 'error.main' : i === 6 ? 'info.main' : 'text.secondary', fontWeight: 600 }}>{WEEK[i]}</Typography>
                <Typography sx={{ fontWeight: isToday ? 800 : 600, color: isToday ? 'primary.main' : 'text.primary', lineHeight: 1.2 }}>{+k.slice(8)}</Typography>
              </Box>
              <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0, pt: 0.25 }}>
                {list.map(({ ev }) => (
                  <Stack key={ev.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colorOf(ev.created_by), flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{ev.title}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>{ev.all_day ? '종일' : hm(new Date(ev.start_at))}</Typography>
                  </Stack>
                ))}
                {!list.length && <Typography variant="body2" color="text.disabled">일정 없음</Typography>}
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
