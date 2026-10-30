import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  Box, Button, ButtonBase, Card, CardActionArea, DialogActions, DialogContent, DialogTitle, Drawer, Fab,
  FormControlLabel, IconButton, Stack, Switch, TextField, Typography,
} from '@mui/material'
import AddRounded from '@mui/icons-material/AddRounded'
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded'
import AddPhotoAlternateRounded from '@mui/icons-material/AddPhotoAlternateRounded'
import PhotoCameraRounded from '@mui/icons-material/PhotoCameraRounded'
import FavoriteRounded from '@mui/icons-material/FavoriteRounded'
import { keyframes } from '@emotion/react'
import { koError, supabase } from './supabase'
import { PHOTO_COLUMNS, PhotoGrid, uploadPhotos, withThumbs, type Photo } from './Photos'
import type { TabProps } from './Home'
import { dayDiff, expand, ymd, type Event, type Occ } from './repeat'

const COLUMNS = 'id,title,note,start_at,all_day,created_by,end_date,repeat_yearly,repeat_until_year'
const hm = (d: Date) => d.toTimeString().slice(0, 5)
const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const slideFromRight = keyframes`from { opacity: 0; transform: translateX(24px) } to { opacity: 1; transform: none }`
const slideFromLeft = keyframes`from { opacity: 0; transform: translateX(-24px) } to { opacity: 1; transform: none }`
// 일정 막대: 연한 배경 + 진한 글자. 어떤 색을 골라도, 다크 모드에서도 읽히게 글자색을 본문색 쪽으로 섞는다
const tint = (c: string) => `color-mix(in srgb, ${c} 22%, transparent)`
const ink = (c: string) => `color-mix(in srgb, ${c} 65%, var(--mui-palette-text-primary))`
const md = (k: string) => `${+k.slice(5, 7)}/${+k.slice(8)}`

export default function Calendar({ coupleId, userId, version, notify, colorOf }: TabProps) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [events, setEvents] = useState<Event[]>([])
  const [photoDays, setPhotoDays] = useState<Set<string>>(new Set())
  const [dayPhotos, setDayPhotos] = useState<Photo[]>([])
  const [selected, setSelected] = useState(() => ymd(new Date()))
  const [editing, setEditing] = useState<Event | 'new' | null>(null)
  const [uploading, setUploading] = useState(false)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const [dir, setDir] = useState(0)

  // 6주 고정 그리드: 그 달 1일이 속한 주의 일요일부터 42일
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay())
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i))
  const from = days[0].toISOString()
  const to = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + 42).toISOString()
  const fromDay = ymd(days[0])
  const toDay = ymd(days[41])

  const load = useCallback(async () => {
    const [ev, ph] = await Promise.all([
      // 이 화면에 걸치는 일정: 안에서 시작, 앞에서 시작해 이어지는 기간 일정, 매년 반복(전부 가져와 펼친다)
      supabase.from('events').select(COLUMNS).lt('start_at', to)
        .or(`start_at.gte."${from}",end_date.gte.${fromDay},repeat_yearly.is.true`).order('start_at'),
      supabase.from('photos').select(PHOTO_COLUMNS).gte('photo_date', fromDay).lte('photo_date', toDay).order('created_at'),
    ])
    if (ev.error || ph.error) return notify(koError((ev.error ?? ph.error)!))
    setEvents(ev.data)
    setPhotoDays(new Set(ph.data.map((p) => p.photo_date)))
    setDayPhotos(await withThumbs(ph.data.filter((p) => p.photo_date === selected)))
  }, [from, to, fromDay, toDay, selected, notify])

  useEffect(() => { load() }, [load, version])

  // 연말·연초에 걸친 반복 기간 일정도 잡히게 앞 해까지 펼친다
  const years = [days[0].getFullYear() - 1, days[0].getFullYear(), days[41].getFullYear()]
  const byDay = new Map<string, Occ[]>()
  for (const o of events.flatMap((ev) => expand(ev, [...new Set(years)]))) {
    const [y, m, d] = o.first.split('-').map(Number)
    for (let i = 0; i <= dayDiff(o.first, o.last); i++) {
      const k = ymd(new Date(y, m - 1, d + i))
      if (k >= fromDay && k <= toDay) byDay.set(k, [...(byDay.get(k) ?? []), o])
    }
  }
  // 이어지는 기간 일정이 같은 줄에 오게 먼저 시작한 것부터, 같은 날 시작이면 시간순
  for (const list of byDay.values()) {
    list.sort((a, b) => a.first.localeCompare(b.first) || (a.ev.all_day ? '' : hm(new Date(a.ev.start_at))).localeCompare(b.ev.all_day ? '' : hm(new Date(b.ev.start_at))))
  }

  const poke = async () => {
    // 대시보드 에디터로 배포해서 함수 주소(slug)가 hyper-endpoint다. 코드는 supabase/functions/notify
    const { error } = await supabase.functions.invoke('hyper-endpoint', { body: { type: 'poke' } })
    if (!error) return notify('콕 찔렀어요 👉')
    const body = await (error as { context?: Response }).context?.json().catch(() => null)
    notify(body?.code === '23505' ? '오늘은 이미 찔렀어요. 내일 다시!' : koError(body ?? error))
  }

  const upload = async (files: FileList) => {
    setUploading(true)
    try { await uploadPhotos(files, coupleId, userId, selected) }
    catch (e) { notify(e instanceof Error ? koError(e) : String(e)) }
    setUploading(false)
    load()
  }

  const today = ymd(new Date())
  const shift = (n: number) => { setDir(n); setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1)) }
  const goToday = () => {
    const now = new Date()
    setDir(now > month ? 1 : -1)
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelected(today)
  }
  const isThisMonth = today.slice(0, 7) === ymd(month).slice(0, 7)
  const [, mm, dd] = selected.split('-')
  const selectedDow = WEEK[new Date(`${selected}T00:00`).getDay()]
  const dayList = byDay.get(selected) ?? []
  const color = (ev: Event) => colorOf(ev.created_by)

  return (
    <Box sx={{ p: 2, pb: 12 }}>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mb: 1.5, px: 0.5 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{month.getFullYear()}</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1 }}>{month.getMonth() + 1}월</Typography>
        </Box>
        {!isThisMonth && <Button size="small" variant="outlined" onClick={goToday}>오늘</Button>}
        <IconButton aria-label="이전 달" onClick={() => shift(-1)}><ChevronLeftRounded /></IconButton>
        <IconButton aria-label="다음 달" onClick={() => shift(1)}><ChevronRightRounded /></IconButton>
      </Stack>

      {/* 좌우 스와이프로 달 이동. 세로 스크롤과 헷갈리지 않게 가로 이동이 더 클 때만 */}
      <Card sx={{ p: 0.75, overflow: 'hidden' }}
        onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
        onTouchEnd={(e) => {
          if (!touch.current) return
          const dx = e.changedTouches[0].clientX - touch.current.x
          const dy = e.changedTouches[0].clientY - touch.current.y
          touch.current = null
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) shift(dx < 0 ? 1 : -1)
        }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {WEEK.map((w, i) => (
            <Typography key={w} variant="caption" sx={{ textAlign: 'center', py: 0.5, fontWeight: 600, color: i === 0 ? 'error.main' : i === 6 ? 'secondary.main' : 'text.secondary' }}>{w}</Typography>
          ))}
        </Box>
        <Box key={ymd(month)} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          animation: dir ? `${dir > 0 ? slideFromRight : slideFromLeft} .25s ease-out` : 'none',
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }}>
          {days.map((d) => {
            const k = ymd(d)
            const list = byDay.get(k) ?? []
            const isSel = k === selected
            const isToday = k === today
            const dow = d.getDay()
            return (
              <ButtonBase key={k} onClick={() => setSelected(k)} aria-pressed={isSel}
                aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일${list.length ? `, 일정 ${list.length}개` : ''}${photoDays.has(k) ? ', 사진 있음' : ''}`}
                sx={{ flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', gap: '2px', py: 0.5, minHeight: 72, borderRadius: 2.5,
                  opacity: d.getMonth() !== month.getMonth() ? 0.35 : 1,
                  bgcolor: isSel ? 'color-mix(in srgb, var(--mui-palette-primary-main) 14%, transparent)' : 'transparent',
                  outline: isSel ? '1.5px solid var(--mui-palette-primary-main)' : 'none', outlineOffset: -1.5,
                  transition: 'background-color .15s' }}>
                <Box sx={{ alignSelf: 'center', width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center',
                  fontSize: 13, fontWeight: isToday ? 800 : 500,
                  bgcolor: isToday ? 'primary.main' : 'transparent',
                  color: isToday ? 'primary.contrastText' : dow === 0 ? 'error.main' : dow === 6 ? 'secondary.main' : 'text.primary' }}>
                  {d.getDate()}
                </Box>
                {photoDays.has(k) && <PhotoCameraRounded sx={{ position: 'absolute', top: 4, right: 3, fontSize: 11, color: 'text.secondary' }} />}
                {/* 기간 일정은 이어지는 막대로: 시작일·일요일에만 제목, 끝/토요일이 아니면 옆 칸과 붙인다 */}
                {list.slice(0, 2).map(({ ev, first, last }) => {
                  const cont = k !== first && dow !== 0
                  const more = k !== last && dow !== 6
                  return (
                    <Box key={ev.id} sx={{ height: 15, lineHeight: '15px', fontSize: 10, fontWeight: 600, px: 0.5, overflow: 'hidden', whiteSpace: 'nowrap',
                      textAlign: 'left', bgcolor: tint(color(ev)), color: ink(color(ev)),
                      borderLeft: cont ? 0 : `3px solid ${color(ev)}`,
                      ml: cont ? 0 : '2px', mr: more ? 0 : '2px',
                      borderRadius: `${cont ? 0 : 4}px ${more ? 0 : 4}px ${more ? 0 : 4}px ${cont ? 0 : 4}px` }}>
                      {cont ? ' ' : ev.title}
                    </Box>
                  )
                })}
                {list.length > 2 && <Typography sx={{ fontSize: 10, lineHeight: 1.2, color: 'text.secondary', fontWeight: 600 }}>+{list.length - 2}</Typography>}
              </ButtonBase>
            )
          })}
        </Box>
      </Card>

      <Stack direction="row" sx={{ alignItems: 'center', mt: 3, mb: 1.5 }}>
        <Typography variant="h6" component="h2" sx={{ flex: 1 }}>
          {+mm}월 {+dd}일 <Typography component="span" color="text.secondary" sx={{ fontWeight: 500 }}>{selectedDow}요일</Typography>
        </Typography>
        <Button size="small" variant="contained" startIcon={<FavoriteRounded />} onClick={poke}
          sx={{ background: 'linear-gradient(135deg, var(--mui-palette-primary-main), var(--mui-palette-secondary-main))', color: '#fff' }}>
          콕 찌르기
        </Button>
      </Stack>

      <Stack spacing={1}>
        {dayList.map(({ ev, first, last }) => (
          <Card key={ev.id}>
            <CardActionArea onClick={() => setEditing(ev)}>
              <Stack direction="row" spacing={1.5} sx={{ p: 1.5, alignItems: 'center' }}>
                <Box sx={{ width: 4, alignSelf: 'stretch', borderRadius: 2, bgcolor: color(ev) }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }} noWrap>{ev.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {[first !== last && `${md(first)} ~ ${md(last)}`, ev.all_day ? '하루 종일' : hm(new Date(ev.start_at)), ev.repeat_yearly && '매년 반복']
                      .filter(Boolean).join(' · ')}
                  </Typography>
                  {ev.note && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>{ev.note}</Typography>}
                </Box>
                <ChevronRightRounded sx={{ color: 'text.disabled' }} />
              </Stack>
            </CardActionArea>
          </Card>
        ))}
        {!dayList.length && (
          <ButtonBase onClick={() => setEditing('new')} sx={{ py: 3, borderRadius: 4, border: '1.5px dashed', borderColor: 'divider', color: 'text.secondary', gap: 1 }}>
            <AddRounded fontSize="small" /> 이날 일정 추가하기
          </ButtonBase>
        )}
      </Stack>

      <Stack direction="row" sx={{ alignItems: 'center', mt: 3, mb: 1 }}>
        <Typography component="h2" sx={{ fontWeight: 700, flex: 1 }}>이날의 사진</Typography>
        <Button component="label" size="small" startIcon={<AddPhotoAlternateRounded />} disabled={uploading}>
          {uploading ? '올리는 중…' : '사진 올리기'}
          <input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
        </Button>
      </Stack>
      <PhotoGrid photos={dayPhotos} userId={userId} onChanged={load} onError={notify} />

      <Fab color="primary" aria-label="일정 추가" onClick={() => setEditing('new')}
        sx={{ position: 'fixed', right: 20, bottom: 'calc(88px + env(safe-area-inset-bottom))' }}>
        <AddRounded />
      </Fab>

      {editing && (
        <EventDialog key={editing === 'new' ? 'new' : editing.id} event={editing === 'new' ? null : editing} date={selected}
          coupleId={coupleId} userId={userId} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} notify={notify} />
      )}
    </Box>
  )
}

function EventDialog({ event, date, coupleId, userId, onClose, onSaved, notify }: {
  event: Event | null; date: string; coupleId: string; userId: string; onClose: () => void; onSaved: () => void; notify: (m: string) => void
}) {
  const [allDay, setAllDay] = useState(event?.all_day ?? false)
  const [yearly, setYearly] = useState(event?.repeat_yearly ?? false)
  const day = event ? ymd(new Date(event.start_at)) : date

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const start = String(f.get('day'))
    const end = String(f.get('end') ?? '')
    if (end && end < start) return notify('종료 날짜가 시작 날짜보다 빨라요')
    const until = Number(f.get('until')) || null
    const row = {
      title: String(f.get('title')).trim(),
      note: String(f.get('note')).trim() || null,
      all_day: allDay,
      start_at: new Date(`${start}T${allDay ? '00:00' : f.get('time')}`).toISOString(),
      end_date: end && end !== start ? end : null,
      repeat_yearly: yearly,
      repeat_until_year: yearly ? until : null,
    }
    const { error } = event
      ? await supabase.from('events').update(row).eq('id', event.id)
      : await supabase.from('events').insert({ ...row, couple_id: coupleId, created_by: userId })
    if (error) return notify(koError(error))
    onSaved()
  }

  const remove = async () => {
    if (!event || !confirm(`'${event.title}' 일정을 삭제할까요?${event.repeat_yearly ? ' 모든 해의 반복이 함께 지워져요.' : ''}`)) return
    const { error } = await supabase.from('events').delete().eq('id', event.id)
    if (error) return notify(koError(error))
    onSaved()
  }

  return (
    // 휴대폰에서 손이 닿기 쉬운 아래쪽 시트
    <Drawer open anchor="bottom" onClose={onClose} slotProps={{ paper: { component: 'form', onSubmit: save,
      sx: { maxWidth: 560, mx: 'auto', maxHeight: '92dvh', borderRadius: '24px 24px 0 0', pb: 'env(safe-area-inset-bottom)' } } as object }}>
      <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'divider', mx: 'auto', mt: 1.5 }} />
      <DialogTitle>{event ? '일정 수정' : '새 일정'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField name="title" label="제목" required autoFocus defaultValue={event?.title} slotProps={{ htmlInput: { maxLength: 200 } }} />
          <Stack direction="row" spacing={1}>
            <TextField name="day" type="date" label="시작 날짜" required fullWidth defaultValue={day} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField name="end" type="date" label="종료 날짜 (선택)" fullWidth defaultValue={event?.end_date ?? ''} slotProps={{ inputLabel: { shrink: true } }} />
          </Stack>
          <FormControlLabel control={<Switch checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />} label="하루 종일" />
          {!allDay && (
            <TextField name="time" type="time" label="시간" required defaultValue={event ? hm(new Date(event.start_at)) : '12:00'}
              slotProps={{ inputLabel: { shrink: true } }} />
          )}
          <FormControlLabel control={<Switch checked={yearly} onChange={(e) => setYearly(e.target.checked)} />} label="매년 반복" />
          {yearly && (
            <TextField name="until" type="number" label="몇 년도까지 (비우면 계속)" defaultValue={event?.repeat_until_year ?? ''}
              slotProps={{ htmlInput: { min: +day.slice(0, 4), max: 2200 } }} />
          )}
          <TextField name="note" label="메모 (선택)" multiline minRows={2} defaultValue={event?.note ?? ''} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {event && <Button color="error" onClick={remove}>삭제</Button>}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>취소</Button>
        <Button type="submit" variant="contained">{event ? '저장' : '추가'}</Button>
      </DialogActions>
    </Drawer>
  )
}
