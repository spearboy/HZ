import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  Box, Button, ButtonBase, Card, CardActionArea, DialogActions, DialogContent, DialogTitle, Drawer, Fab,
  FormControlLabel, IconButton, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material'
import {
  CameraIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, HeartIcon, ImageIcon, ListIcon, PlusIcon,
} from '@animateicons/react/lucide'
import { keyframes } from '@emotion/react'
import { koError, supabase } from './supabase'
import { PHOTO_COLUMNS, PhotoGrid, uploadPhotos, withThumbs, type Photo } from './Photos'
import type { TabProps } from './Home'
import { groupByDay, hm, layout, slotOf, ymd, type Event } from './repeat'
import { eventsInRange } from './events'
import { holidayName } from './holidays'
import { CalendarSkeleton } from './Skeletons'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const slideFromRight = keyframes`from { opacity: 0; transform: translateX(24px) } to { opacity: 1; transform: none }`
const slideFromLeft = keyframes`from { opacity: 0; transform: translateX(-24px) } to { opacity: 1; transform: none }`
// 일정 막대: 연한 배경 + 진한 글자. 어떤 색을 골라도, 다크 모드에서도 읽히게 글자색을 본문색 쪽으로 섞는다
const tint = (c: string) => `color-mix(in srgb, ${c} 22%, transparent)`
const ink = (c: string) => `color-mix(in srgb, ${c} 65%, var(--mui-palette-text-primary))`
const md = (k: string) => `${+k.slice(5, 7)}/${+k.slice(8)}`
const VIEW_KEY = 'dayView'
const HOUR_PX = 54

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
  const [ready, setReady] = useState(false)
  const [view, setView] = useState<'list' | 'grid'>(() => {
    try { return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list' } catch { return 'list' }
  })
  const setViewSaved = (v: 'list' | 'grid') => {
    setView(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* 저장 못 해도 이번 세션엔 적용된다 */ }
  }

  // 6주 고정 그리드: 그 달 1일이 속한 주의 일요일부터 42일
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay())
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i))
  const from = days[0].toISOString()
  const to = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + 42).toISOString()
  const fromDay = ymd(days[0])
  const toDay = ymd(days[41])

  const load = useCallback(async () => {
    const [ev, ph] = await Promise.all([
      eventsInRange(from, to, fromDay),
      supabase.from('photos').select(PHOTO_COLUMNS).gte('photo_date', fromDay).lte('photo_date', toDay).order('created_at'),
    ])
    if (ev.error || ph.error) return notify(koError((ev.error ?? ph.error)!))
    setEvents(ev.data)
    setPhotoDays(new Set(ph.data.map((p) => p.photo_date)))
    setDayPhotos(await withThumbs(ph.data.filter((p) => p.photo_date === selected)))
    setReady(true)
  }, [from, to, fromDay, toDay, selected, notify])

  useEffect(() => { load() }, [load, version])

  const byDay = groupByDay(events, fromDay, toDay)

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

  if (!ready) return <CalendarSkeleton />

  return (
    <Box sx={{ p: 2, pb: 12 }}>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mb: 1.5, px: 0.5 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{month.getFullYear()}</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1 }}>{month.getMonth() + 1}월</Typography>
        </Box>
        {!isThisMonth && <Button size="small" variant="outlined" onClick={goToday}>오늘</Button>}
        <IconButton aria-label="이전 달" onClick={() => shift(-1)}><ChevronLeftIcon size={22} /></IconButton>
        <IconButton aria-label="다음 달" onClick={() => shift(1)}><ChevronRightIcon size={22} /></IconButton>
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
            <Typography key={w} variant="caption" sx={{ textAlign: 'center', py: 0.5, fontWeight: 600, color: i === 0 ? 'error.main' : i === 6 ? 'info.main' : 'text.secondary' }}>{w}</Typography>
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
            const hol = holidayName(k)
            return (
              <ButtonBase key={k} onClick={() => setSelected(k)} aria-pressed={isSel}
                aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일${hol ? `, ${hol}` : ''}${list.length ? `, 일정 ${list.length}개` : ''}${photoDays.has(k) ? ', 사진 있음' : ''}`}
                sx={{ flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', gap: '2px', py: 0.5, minHeight: 72, borderRadius: 2.5,
                  opacity: d.getMonth() !== month.getMonth() ? 0.35 : 1,
                  bgcolor: isSel ? 'color-mix(in srgb, var(--mui-palette-primary-main) 14%, transparent)' : 'transparent',
                  outline: isSel ? '1.5px solid var(--mui-palette-primary-main)' : 'none', outlineOffset: -1.5,
                  transition: 'background-color .15s' }}>
                <Box sx={{ alignSelf: 'center', width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center',
                  fontSize: 13, fontWeight: isToday ? 800 : 500,
                  bgcolor: isToday ? 'primary.main' : 'transparent',
                  color: isToday ? 'primary.contrastText' : hol || dow === 0 ? 'error.main' : dow === 6 ? 'info.main' : 'text.primary' }}>
                  {d.getDate()}
                </Box>
                {hol && (
                  <Typography sx={{ fontSize: 9, lineHeight: '11px', px: 0.25, textAlign: 'center', fontWeight: 700,
                    color: 'error.main', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{hol}</Typography>
                )}
                {photoDays.has(k) && <Box sx={{ position: 'absolute', top: 4, right: 3, color: 'text.secondary', lineHeight: 0 }}><CameraIcon size={11} /></Box>}
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

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 3, mb: 1.5 }}>
        <Typography variant="h6" component="h2" sx={{ flex: 1, minWidth: 0 }} noWrap>
          {+mm}월 {+dd}일 <Typography component="span" color="text.secondary" sx={{ fontWeight: 500 }}>{selectedDow}</Typography>
          {holidayName(selected) && <Typography component="span" color="error.main" sx={{ fontWeight: 700, ml: 0.75, fontSize: 14 }}>{holidayName(selected)}</Typography>}
        </Typography>
        {/* 글자 대신 아이콘이라 '콕 찌르기'와 한 줄에 들어간다 */}
        <ToggleButtonGroup exclusive size="small" value={view} onChange={(_, v) => v && setViewSaved(v)} sx={{ flexShrink: 0 }}>
          <ToggleButton value="list" aria-label="목록으로 보기" sx={{ p: 0.6, borderRadius: '999px 0 0 999px' }}><ListIcon size={18} /></ToggleButton>
          <ToggleButton value="grid" aria-label="시간표로 보기" sx={{ p: 0.6, borderRadius: '0 999px 999px 0' }}><ClockIcon size={18} /></ToggleButton>
        </ToggleButtonGroup>
        <Button size="small" variant="contained" onClick={poke} startIcon={<HeartIcon size={17} />}
          sx={{ flexShrink: 0, px: 1.5, background: 'linear-gradient(135deg, var(--mui-palette-primary-main), var(--mui-palette-secondary-main))', color: 'primary.contrastText' }}>
          콕
        </Button>
      </Stack>

      {view === 'grid' ? (
        <Timetable list={dayList} color={color} onPick={setEditing} onAdd={() => setEditing('new')} />
      ) : (
      <Stack spacing={1}>
        {dayList.map(({ ev, first, last }) => (
          <Card key={ev.id}>
            <CardActionArea onClick={() => setEditing(ev)}>
              <Stack direction="row" spacing={1.5} sx={{ p: 1.5, alignItems: 'center' }}>
                <Box sx={{ width: 4, alignSelf: 'stretch', borderRadius: 2, bgcolor: color(ev) }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }} noWrap>{ev.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {[first !== last && `${md(first)} ~ ${md(last)}`, ev.all_day ? '하루 종일' : hm(new Date(ev.start_at)), ev.repeat_yearly && '매년 반복', ev.dday && '디데이']
                      .filter(Boolean).join(' · ')}
                  </Typography>
                  {ev.note && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>{ev.note}</Typography>}
                </Box>
                <Box sx={{ color: 'text.disabled', lineHeight: 0 }}><ChevronRightIcon size={20} /></Box>
              </Stack>
            </CardActionArea>
          </Card>
        ))}
        {!dayList.length && (
          <ButtonBase onClick={() => setEditing('new')} sx={{ py: 3, borderRadius: 4, border: '1.5px dashed', borderColor: 'divider', color: 'text.secondary', gap: 1 }}>
            <PlusIcon size={18} /> 이날 일정 추가하기
          </ButtonBase>
        )}
      </Stack>
      )}

      <Stack direction="row" sx={{ alignItems: 'center', mt: 3, mb: 1 }}>
        <Typography component="h2" sx={{ fontWeight: 700, flex: 1 }}>이날의 사진</Typography>
        <Button component="label" size="small" startIcon={<ImageIcon size={18} />} disabled={uploading}>
          {uploading ? '올리는 중…' : '사진 올리기'}
          <input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
        </Button>
      </Stack>
      <PhotoGrid photos={dayPhotos} userId={userId} onChanged={load} onError={notify} />

      <Fab color="primary" aria-label="일정 추가" onClick={() => setEditing('new')}
        sx={{ position: 'fixed', right: 20, bottom: 'calc(88px + env(safe-area-inset-bottom))' }}>
        <PlusIcon size={26} />
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
  const [dday, setDday] = useState(event?.dday ?? false)
  const day = event ? ymd(new Date(event.start_at)) : date

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const start = String(f.get('day'))
    const end = String(f.get('end') ?? '')
    if (end && end < start) return notify('종료 날짜가 시작 날짜보다 빨라요')
    const until = Number(f.get('until')) || null
    const endTime = allDay ? '' : String(f.get('endTime') ?? '')
    if (endTime && endTime <= String(f.get('time'))) return notify('끝나는 시간이 시작 시간보다 빨라요')
    const row = {
      title: String(f.get('title')).trim(),
      note: String(f.get('note')).trim() || null,
      all_day: allDay,
      start_at: new Date(`${start}T${allDay ? '00:00' : f.get('time')}`).toISOString(),
      end_at: endTime ? new Date(`${start}T${endTime}`).toISOString() : null,
      end_date: end && end !== start ? end : null,
      repeat_yearly: yearly,
      repeat_until_year: yearly ? until : null,
      dday,
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
            <Stack direction="row" spacing={1}>
              <TextField name="time" type="time" label="시작 시간" required fullWidth defaultValue={event ? hm(new Date(event.start_at)) : '12:00'}
                slotProps={{ inputLabel: { shrink: true } }} />
              <TextField name="endTime" type="time" label="끝나는 시간 (선택)" fullWidth
                defaultValue={event?.end_at ? hm(new Date(event.end_at)) : ''}
                helperText="넣으면 시간표에 길이대로 그려져요"
                slotProps={{ inputLabel: { shrink: true } }} />
            </Stack>
          )}
          <FormControlLabel control={<Switch checked={yearly} onChange={(e) => setYearly(e.target.checked)} />} label="매년 반복" />
          {yearly && (
            <TextField name="until" type="number" label="몇 년도까지 (비우면 계속)" defaultValue={event?.repeat_until_year ?? ''}
              slotProps={{ htmlInput: { min: +day.slice(0, 4), max: 2200 } }} />
          )}
          <FormControlLabel control={<Switch checked={dday} onChange={(e) => setDday(e.target.checked)} />} label="홈에 디데이로 표시" />
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

// 하루를 시간축으로 보여 준다. 하루 종일 일정은 위에 따로, 시간 있는 일정만 축에 올린다
function Timetable({ list, color, onPick, onAdd }: {
  list: { ev: Event; first: string; last: string }[]
  color: (ev: Event) => string
  onPick: (ev: Event) => void
  onAdd: () => void
}) {
  const timed = list.filter((o) => !o.ev.all_day)
  const allDay = list.filter((o) => o.ev.all_day)
  const slots = layout(timed.map((o) => ({ ev: o.ev, ...slotOf(o.ev) })))

  if (!list.length) {
    return (
      <ButtonBase onClick={onAdd} sx={{ width: '100%', py: 3, borderRadius: 4, border: '1.5px dashed', borderColor: 'divider', color: 'text.secondary', gap: 1 }}>
        <PlusIcon size={18} /> 이날 일정 추가하기
      </ButtonBase>
    )
  }

  // 일정이 있는 시간대만 보여 주되 최소 4시간은 유지한다 (빈 축만 길게 늘어지지 않게)
  const first = slots.length ? Math.floor(Math.min(...slots.map((s) => s.from)) / 60) : 9
  const last = slots.length ? Math.ceil(Math.max(...slots.map((s) => s.to)) / 60) : 13
  const h0 = Math.max(0, Math.min(first, last - 4))
  const h1 = Math.min(24, Math.max(last, h0 + 4))
  const hours = Array.from({ length: h1 - h0 + 1 }, (_, i) => h0 + i)
  const y = (min: number) => ((min - h0 * 60) / 60) * HOUR_PX

  return (
    <Card sx={{ p: 1.5 }}>
      {!!allDay.length && (
        <Stack spacing={0.5} sx={{ mb: 1.5 }}>
          {allDay.map(({ ev }) => (
            <ButtonBase key={ev.id} onClick={() => onPick(ev)}
              sx={{ justifyContent: 'flex-start', gap: 1, px: 1, py: 0.6, borderRadius: 2, bgcolor: tint(color(ev)), color: ink(color(ev)),
                borderLeft: `3px solid ${color(ev)}`, fontSize: 13, fontWeight: 700 }}>
              하루 종일 · {ev.title}
            </ButtonBase>
          ))}
        </Stack>
      )}

      <Box sx={{ position: 'relative', height: (h1 - h0) * HOUR_PX + 8 }}>
        {hours.map((h) => (
          <Box key={h} sx={{ position: 'absolute', left: 0, right: 0, top: y(h * 60), height: 0, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" sx={{ position: 'absolute', top: -9, left: 0, width: 38, textAlign: 'right', color: 'text.secondary' }}>
              {h}시
            </Typography>
          </Box>
        ))}

        <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: '46px', right: 0 }}>
          {slots.map((s) => (
            <ButtonBase key={s.ev.id} onClick={() => onPick(s.ev)}
              sx={{ position: 'absolute', top: y(s.from) + 1, height: Math.max(22, y(s.to) - y(s.from) - 2),
                left: `${(s.lane / s.lanes) * 100}%`, width: `calc(${100 / s.lanes}% - 3px)`,
                flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', overflow: 'hidden',
                px: 0.75, py: 0.4, borderRadius: 2, textAlign: 'left',
                bgcolor: tint(color(s.ev)), color: ink(color(s.ev)), borderLeft: `3px solid ${color(s.ev)}` }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2, width: '100%' }} noWrap>{s.ev.title}</Typography>
              <Typography sx={{ fontSize: 10, opacity: 0.8, lineHeight: 1.2 }}>
                {hm(new Date(s.ev.start_at))}{s.ev.end_at && ` ~ ${hm(new Date(s.ev.end_at))}`}
              </Typography>
            </ButtonBase>
          ))}
        </Box>
      </Box>
    </Card>
  )
}
