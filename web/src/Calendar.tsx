import { useToday } from './useToday'
import { monthRange } from './calendarDates'
import { isEnglish, locale, tr } from './language'
import { memo, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  Box, Button, ButtonBase, Card, CardActionArea, DialogActions, DialogContent, DialogTitle, Drawer,
  FormControlLabel, IconButton, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material'
import {
  CameraIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, HeartIcon, ImageIcon, ListIcon, PlusIcon,
} from './icons'
import { keyframes } from '@emotion/react'
import { koError, supabase } from './supabase'
import { PhotoGrid } from './Photos'
import { PHOTO_COLUMNS, uploadPhotos, withThumbs, type Photo, type PhotoUpload } from './photoStorage'
import type { TabProps } from './homeTypes'
import { groupByDay, hm, layout, slotOf, ymd, type Event } from './repeat'
import { eventsInRange } from './events'
import { holidayName } from './holidays'
import { CalendarSkeleton } from './Skeletons'
import { poke } from './poke'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const slideFromRight = keyframes`from { opacity: 0; transform: translateX(24px) } to { opacity: 1; transform: none }`
const slideFromLeft = keyframes`from { opacity: 0; transform: translateX(-24px) } to { opacity: 1; transform: none }`
// 일정 막대: 연한 배경 + 진한 글자. 어떤 색을 골라도, 다크 모드에서도 읽히게 글자색을 본문색 쪽으로 섞는다
const tint = (c: string) => `color-mix(in srgb, ${c} 22%, transparent)`
const ink = (c: string) => `color-mix(in srgb, ${c} 65%, var(--mui-palette-text-primary))`
const md = (k: string) => `${+k.slice(5, 7)}/${+k.slice(8)}`
const VIEW_KEY = 'dayView'
const HOUR_PX = 54

type CalendarProps = Pick<TabProps, 'coupleId' | 'userId' | 'active' | 'eventVersion' | 'photoVersion' | 'notify' | 'colorOf'> & { target: { date: string; id: number } | null }

function Calendar({ coupleId, userId, active, eventVersion, photoVersion, notify, colorOf, target }: CalendarProps) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [events, setEvents] = useState<Event[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [dayPhotoResult, setDayPhotoResult] = useState<{ photos: Photo[]; date: string; source: Photo[] } | null>(null)
  const [selected, setSelected] = useState(() => ymd(new Date()))
  const dayPhotos = dayPhotoResult?.date === selected && dayPhotoResult.source === photos ? dayPhotoResult.photos : []
  const [editing, setEditing] = useState<Event | 'new' | null>(null)
  const [uploading, setUploading] = useState(false)
  const [failedUpload, setFailedUpload] = useState<{ files: PhotoUpload[]; date: string } | null>(null)
  const [photoRefresh, setPhotoRefresh] = useState(0)
  const uploadRef = useRef(false)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const eventLoadId = useRef(0)
  const photoLoadId = useRef(0)
  const eventKey = useRef('')
  const photoKey = useRef('')
  const eventsFetchedAt = useRef(0)
  const photosFetchedAt = useRef(0)
  const [dir, setDir] = useState(0)
  const [eventsReady, setEventsReady] = useState(false)
  const [photosReady, setPhotosReady] = useState(false)
  const [eventsError, setEventsError] = useState(false)
  const [photosError, setPhotosError] = useState(false)
  const [eventsRange, setEventsRange] = useState('')
  const [photosRange, setPhotosRange] = useState('')
  const [view, setView] = useState<'list' | 'grid'>(() => {
    try { return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list' } catch { return 'list' }
  })
  const setViewSaved = (v: 'list' | 'grid') => {
    setView(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* 저장 못 해도 이번 세션엔 적용된다 */ }
  }
  const [previousTarget, setPreviousTarget] = useState<CalendarProps['target']>(null)
  if (target !== previousTarget) {
    setPreviousTarget(target)
    if (target) {
      const [year, monthNumber] = target.date.split('-').map(Number)
      setSelected(target.date)
      setMonth(new Date(year, monthNumber - 1, 1))
    }
  }
  const { days, from, to, fromDay, toDay } = useMemo(() => monthRange(month), [month])

  const loadEvents = useCallback(async () => {
    const id = ++eventLoadId.current
    setEventsError(false)
    const ev = await eventsInRange(coupleId, from, to, fromDay)
    if (id !== eventLoadId.current) return
    if (ev.error) { eventKey.current = ''; setEventsError(true); return notify(koError(ev.error)) }
    setEvents(ev.data)
    setEventsRange(`${from}/${to}`)
    eventsFetchedAt.current = Date.now()
    setEventsReady(true)
  }, [coupleId, from, to, fromDay, notify])
  const loadPhotos = useCallback(async () => {
    const id = ++photoLoadId.current
    setPhotosError(false)
    const ph = await supabase.from('photos').select(PHOTO_COLUMNS).eq('couple_id', coupleId).gte('photo_date', fromDay).lte('photo_date', toDay).order('created_at')
    if (id !== photoLoadId.current) return
    if (ph.error) { photoKey.current = ''; setPhotosError(true); return notify(koError(ph.error)) }
    setPhotos(ph.data)
    setPhotosRange(`${fromDay}/${toDay}`)
    photosFetchedAt.current = Date.now()
    setPhotosReady(true)
  }, [coupleId, fromDay, toDay, notify])

  useEffect(() => {
    const key = `${from}/${to}/${eventVersion}`
    if (active && (eventKey.current !== key || (eventsFetchedAt.current > 0 && Date.now() - eventsFetchedAt.current > 60_000))) { eventKey.current = key; loadEvents() }
  }, [active, from, to, eventVersion, loadEvents])
  useEffect(() => {
    const key = `${fromDay}/${toDay}/${photoVersion}/${photoRefresh}`
    if (active && (photoKey.current !== key || (photosFetchedAt.current > 0 && Date.now() - photosFetchedAt.current > 60_000))) { photoKey.current = key; loadPhotos() }
  }, [active, fromDay, toDay, photoVersion, photoRefresh, loadPhotos])

  useEffect(() => {
    let active = true
    withThumbs(photos.filter((p) => p.photo_date === selected)).then((rows) => {
      if (active) setDayPhotoResult({ photos: rows, date: selected, source: photos })
    })
    return () => { active = false }
  }, [photos, selected])

  const photoDays = useMemo(() => new Set(photos.map((p) => p.photo_date)), [photos])
  const byDay = useMemo(() => groupByDay(events, fromDay, toDay), [events, fromDay, toDay])

  const upload = async (files: PhotoUpload[], date: string) => {
    if (uploadRef.current || !files.length) return
    uploadRef.current = true
    setUploading(true)
    try {
      const failed = await uploadPhotos(files, coupleId, userId, date)
      setFailedUpload(failed.length ? { files: failed, date } : null)
      const count = files.length - failed.length
      notify(isEnglish() ? `${count} uploaded, ${failed.length} failed.` : `${count}장 업로드, ${failed.length}장 실패했어요.`)
      if (count) setPhotoRefresh(value => value + 1)
    } catch (e) {
      setFailedUpload({ files, date })
      notify(e instanceof Error ? koError(e) : String(e))
    } finally { uploadRef.current = false; setUploading(false) }
  }

  const today = useToday()
  const shift = (n: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + n, 1)
    const day = Math.min(+selected.slice(8), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate())
    setDir(n); setMonth(next); setSelected(ymd(new Date(next.getFullYear(), next.getMonth(), day)))
  }
  const goToday = () => {
    const now = new Date()
    setDir(now > month ? 1 : -1)
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelected(today)
  }
  const isThisMonth = today.slice(0, 7) === ymd(month).slice(0, 7)
  const selectedDow = new Date(`${selected}T00:00`).toLocaleDateString(locale(), { weekday: 'short' })
  const dayList = byDay.get(selected) ?? []
  const color = (ev: Event) => colorOf(ev.created_by)

  const eventsCurrent = eventsReady && eventsRange === `${from}/${to}`
  const photosCurrent = photosReady && photosRange === `${fromDay}/${toDay}`
  if (!eventsCurrent || !photosCurrent) {
    if (eventsError || photosError) return <Box sx={{ p: 3 }}><Card sx={{ p: 3 }}>
      <Typography>{isEnglish() ? 'Could not load the calendar.' : '캘린더를 불러오지 못했어요.'}</Typography>
      <Button onClick={() => { if (!eventsCurrent) loadEvents(); if (!photosCurrent) loadPhotos() }}>{isEnglish() ? 'Try again' : '다시 불러오기'}</Button>
    </Card></Box>
    return <CalendarSkeleton />
  }

  return (
    <Box className="screen calendar-screen">
      <Stack className="screen-heading" direction="row" spacing={0.5} sx={{ alignItems: 'center', mb: 2, px: 0.5 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{month.getFullYear()}</Typography>
          <Typography component="h1" sx={{ fontSize: { xs: 32, md: 34 }, fontWeight: 700, letterSpacing: '-.04em', lineHeight: 1.15 }}>{month.toLocaleDateString(locale(), { month: 'long' })}</Typography>
        </Box>
        {!isThisMonth && <Button size="small" variant="outlined" onClick={goToday}>{tr("오늘")}</Button>}
        <IconButton aria-label={tr("이전 달")} onClick={() => shift(-1)}><ChevronLeftIcon size={22} /></IconButton>
        <IconButton aria-label={tr("다음 달")} onClick={() => shift(1)}><ChevronRightIcon size={22} /></IconButton>
        <Button variant="contained" aria-label={tr("일정 추가")} onClick={() => setEditing('new')} sx={{ minWidth: 44, px: 1.5, ml: 1 }}><PlusIcon size={22} /></Button>
      </Stack>

      {/* 좌우 스와이프로 달 이동. 세로 스크롤과 헷갈리지 않게 가로 이동이 더 클 때만 */}
      <Box className="calendar-layout">
      <Card className="month-grid" sx={{ p: 1, overflow: 'hidden', borderRadius: '16px' }}
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
            <Typography key={w} variant="caption" sx={{ textAlign: 'center', py: 1, fontWeight: 600, color: i === 0 ? 'error.main' : i === 6 ? 'info.main' : 'text.secondary' }}>{isEnglish() ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i] : w}</Typography>
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
            const hol = tr(holidayName(k) ?? '')
            return (
              <ButtonBase key={k} onClick={() => setSelected(k)} aria-pressed={isSel}
                aria-label={`${d.toLocaleDateString(locale(), { month: 'long', day: 'numeric' })}${hol ? `, ${hol}` : ''}${list.length ? isEnglish() ? `, ${list.length} events` : `, 일정 ${list.length}개` : ''}${photoDays.has(k) ? isEnglish() ? ', has photos' : ', 사진 있음' : ''}`}
                sx={{ flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', gap: '2px', py: 0.5, minHeight: { xs: 66, md: 78 }, borderRadius: '4px',
                  opacity: d.getMonth() !== month.getMonth() ? 0.6 : 1,
                  bgcolor: 'transparent', outlineOffset: -1,
                  transition: 'background-color 180ms ease, transform 240ms cubic-bezier(.2,.8,.2,1), outline-color 180ms ease',
                  '&:active': { transform: 'scale(.94)' },
                  '&.Mui-focusVisible': { outline: '2px solid var(--mui-palette-primary-main)', outlineOffset: -2 },
                  '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:active': { transform: 'none' } } }}>
                <Box sx={{ alignSelf: 'center', width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center',
                  fontSize: 13, fontWeight: isToday ? 800 : 500,
                  bgcolor: isSel ? 'primary.main' : isToday ? 'action.selected' : 'transparent',
                  color: isSel ? 'primary.contrastText' : hol || dow === 0 ? 'error.main' : dow === 6 ? 'info.main' : 'text.primary' }}>
                  {d.getDate()}
                </Box>
                {hol && (
                  <Typography sx={{ fontSize: 11, lineHeight: '12px', px: 0.25, textAlign: 'center', fontWeight: 700,
                    color: 'error.main', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{hol}</Typography>
                )}
                {photoDays.has(k) && <Box sx={{ position: 'absolute', top: 4, right: 3, color: 'text.secondary', lineHeight: 0 }}><CameraIcon size={11} /></Box>}
                {/* 기간 일정은 이어지는 막대로: 시작일·일요일에만 제목, 끝/토요일이 아니면 옆 칸과 붙인다 */}
                {list.slice(0, 2).map(({ ev, first, last }) => {
                  const cont = k !== first && dow !== 0
                  const more = k !== last && dow !== 6
                  return (
                    <Box key={ev.id} sx={{ height: 17, lineHeight: '17px', fontSize: 11, fontWeight: 600, px: 0.5, overflow: 'hidden', whiteSpace: 'nowrap',
                      textAlign: 'left', bgcolor: tint(color(ev)), color: ink(color(ev)),
                      borderLeft: cont ? 0 : `3px solid ${color(ev)}`,
                      ml: cont ? 0 : '2px', mr: more ? 0 : '2px',
                      borderRadius: `${cont ? 0 : 4}px ${more ? 0 : 4}px ${more ? 0 : 4}px ${cont ? 0 : 4}px` }}>
                      {cont ? ' ' : ev.title}
                    </Box>
                  )
                })}
                {list.length > 2 && <Typography sx={{ fontSize: 11, lineHeight: 1.2, color: 'text.secondary', fontWeight: 600 }}>+{list.length - 2}</Typography>}
              </ButtonBase>
            )
          })}
        </Box>
      </Card>

      <Box className="day-panel">
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h6" component="h2" sx={{ flex: 1, minWidth: 0 }} noWrap>
          {new Date(`${selected}T00:00`).toLocaleDateString(locale(), { month: 'long', day: 'numeric' })} <Typography component="span" color="text.secondary" sx={{ fontWeight: 500 }}>{selectedDow}</Typography>
          {holidayName(selected) && <Typography component="span" color="error.main" sx={{ fontWeight: 700, ml: 0.75, fontSize: 14 }}>{tr(holidayName(selected)!)}</Typography>}
        </Typography>
        <Button size="small" variant="outlined" onClick={() => poke(notify)} startIcon={<HeartIcon size={17} />}
          sx={{ flexShrink: 0, px: 1.5 }}>
          {tr("콕")}
        </Button>
      </Stack>

      <ToggleButtonGroup exclusive fullWidth size="small" value={view} onChange={(_, v) => v && setViewSaved(v)}
        aria-label={tr("일정 보기 방식")} sx={{ mb: 1.5, p: 0.5, gap: 0.5, borderRadius: 2, bgcolor: 'action.hover',
          '& .MuiToggleButtonGroup-grouped': { border: 0, borderRadius: '8px !important', minHeight: 40, gap: 1, fontWeight: 600,
            transition: 'background-color 180ms, color 180ms, transform 220ms cubic-bezier(.2,.8,.2,1)',
            '&.Mui-selected': { bgcolor: 'background.paper', color: 'primary.main' }, '&:active': { transform: 'scale(.97)' },
            '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:active': { transform: 'none' } } } }}>
        <ToggleButton value="list"><ListIcon size={18} />{tr("목록")}</ToggleButton>
        <ToggleButton value="grid"><ClockIcon size={18} />{tr("시간표")}</ToggleButton>
      </ToggleButtonGroup>

      {view === 'grid' ? (
        <Timetable date={selected} list={dayList} color={color} onPick={setEditing} onAdd={() => setEditing('new')} />
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
                    {[first !== last && `${md(first)} ~ ${md(last)}`, ev.all_day ? tr('하루 종일') : hm(new Date(ev.start_at)), ev.repeat_yearly && tr('매년 반복'), ev.dday && tr('디데이')]
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
            <PlusIcon size={18} /> {tr("이날 일정 추가하기")}
          </ButtonBase>
        )}
      </Stack>
      )}

      <Stack className="day-photos-heading" direction="row" sx={{ alignItems: 'center', mt: 3.5, mb: 1 }}>
        <Typography component="h2" sx={{ fontSize: 17, fontWeight: 700, flex: 1 }}>{tr("이날의 사진")}</Typography>
        <Button component="label" size="small" startIcon={<ImageIcon size={18} />} disabled={uploading || !!failedUpload}>
          {uploading ? tr('올리는 중…') : tr("사진 올리기")}
          <input type="file" accept="image/*" multiple hidden onChange={(e) => {
            const files = Array.from(e.target.files ?? []).map(file => ({ file, id: crypto.randomUUID() }))
            e.target.value = ''
            void upload(files, selected)
          }} />
        </Button>
      </Stack>
      {failedUpload && <Card sx={{ p: 2, mb: 1 }}>
        <Typography variant="body2">{isEnglish() ? `${failedUpload.files.length} photos for ${failedUpload.date} could not be uploaded.` : `${failedUpload.date} 사진 ${failedUpload.files.length}장을 올리지 못했어요.`}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }}>{failedUpload.files.map(item => item.file.name).join(', ')}</Typography>
        <Button size="small" disabled={uploading} onClick={() => upload(failedUpload.files, failedUpload.date)}>{isEnglish() ? 'Retry failed photos' : '실패한 사진 다시 올리기'}</Button>
        <Button size="small" disabled={uploading} onClick={() => setFailedUpload(null)}>{isEnglish() ? 'Dismiss' : '닫기'}</Button>
      </Card>}
      <PhotoGrid photos={dayPhotos} userId={userId} onChanged={loadPhotos} onError={notify} />
      {!dayPhotos.length && <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>{isEnglish() ? 'Keep a little memory of this day.' : '사진으로 이날의 기억을 남겨보세요.'}</Typography>}

      </Box>
      </Box>


      {editing && (
        <EventDialog key={editing === 'new' ? 'new' : editing.id} event={editing === 'new' ? null : editing} date={selected}
          coupleId={coupleId} userId={userId} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); loadEvents() }} notify={notify} />
      )}
    </Box>
  )
}

export default memo(Calendar)

function EventDialog({ event, date, coupleId, userId, onClose, onSaved, notify }: {
  event: Event | null; date: string; coupleId: string; userId: string; onClose: () => void; onSaved: () => void; notify: (m: string) => void
}) {
  const [allDay, setAllDay] = useState(event?.all_day ?? false)
  const [yearly, setYearly] = useState(event?.repeat_yearly ?? false)
  const [dday, setDday] = useState(event?.dday ?? false)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const day = event ? ymd(new Date(event.start_at)) : date

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (savingRef.current) return
    const f = new FormData(e.currentTarget)
    const start = String(f.get('day'))
    const end = String(f.get('end') ?? '')
    if (end && end < start) return notify(tr("종료 날짜가 시작 날짜보다 빨라요"))
    const until = Number(f.get('until')) || null
    const endTime = allDay ? '' : String(f.get('endTime') ?? '')
    if (endTime && (!end || end === start) && endTime <= String(f.get('time'))) return notify(tr("끝나는 시간이 시작 시간보다 빨라요"))
    const row = {
      title: String(f.get('title')).trim(),
      note: String(f.get('note')).trim() || null,
      all_day: allDay,
      start_at: new Date(`${start}T${allDay ? '00:00' : f.get('time')}`).toISOString(),
      end_at: endTime ? new Date(`${end || start}T${endTime}`).toISOString() : null,
      end_date: end && end !== start ? end : null,
      repeat_yearly: yearly,
      repeat_until_year: yearly ? until : null,
      dday,
    }
    savingRef.current = true
    setSaving(true)
    try {
      const { error } = event
        ? await supabase.from('events').update(row).eq('id', event.id)
        : await supabase.from('events').insert({ ...row, couple_id: coupleId, created_by: userId })
      if (error) return notify(koError(error))
      onSaved()
    } catch (error) {
      notify(error instanceof Error ? koError(error) : String(error))
    } finally { savingRef.current = false; setSaving(false) }
  }

  const remove = async () => {
    if (!event || !confirm(isEnglish() ? `Delete “${event.title}”?${event.repeat_yearly ? ' All yearly occurrences will be deleted.' : ''}` : `'${event.title}' 일정을 삭제할까요?${event.repeat_yearly ? ' 모든 해의 반복이 함께 지워져요.' : ''}`)) return
    const { error } = await supabase.from('events').delete().eq('id', event.id)
    if (error) return notify(koError(error))
    onSaved()
  }

  return (
    // 휴대폰에서 손이 닿기 쉬운 아래쪽 시트
    <Drawer open anchor="bottom" onClose={saving ? undefined : onClose} slotProps={{ paper: { component: 'form', onSubmit: save,
      sx: { maxWidth: 560, mx: 'auto', maxHeight: '92dvh', borderRadius: '24px 24px 0 0', pb: 'env(safe-area-inset-bottom)' } } as object }}>
      <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'divider', mx: 'auto', mt: 1.5 }} />
      <DialogTitle>{event ? tr('일정 수정') : tr("새 일정")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField name="title" label={tr("제목")} required autoFocus defaultValue={event?.title} slotProps={{ htmlInput: { maxLength: 200 } }} />
          <Stack direction="row" spacing={1}>
            <TextField name="day" type="date" label={tr("시작 날짜")} required fullWidth defaultValue={day} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField name="end" type="date" label={tr("종료 날짜 (선택)")} fullWidth defaultValue={event?.end_date ?? ''} slotProps={{ inputLabel: { shrink: true } }} />
          </Stack>
          <FormControlLabel control={<Switch checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />} label={tr("하루 종일")} />
          {!allDay && (
            <Stack direction="row" spacing={1}>
              <TextField name="time" type="time" label={tr("시작 시간")} required fullWidth defaultValue={event ? hm(new Date(event.start_at)) : '12:00'}
                slotProps={{ inputLabel: { shrink: true } }} />
              <TextField name="endTime" type="time" label={tr("끝나는 시간 (선택)")} fullWidth
                defaultValue={event?.end_at ? hm(new Date(event.end_at)) : ''}
                helperText={tr("넣으면 시간표에 길이대로 그려져요")}
                slotProps={{ inputLabel: { shrink: true } }} />
            </Stack>
          )}
          <FormControlLabel control={<Switch checked={yearly} onChange={(e) => setYearly(e.target.checked)} />} label={tr("매년 반복")} />
          {yearly && (
            <TextField name="until" type="number" label={tr("몇 년도까지 (비우면 계속)")} defaultValue={event?.repeat_until_year ?? ''}
              slotProps={{ htmlInput: { min: +day.slice(0, 4), max: 2200 } }} />
          )}
          <FormControlLabel control={<Switch checked={dday} onChange={(e) => setDday(e.target.checked)} />} label={tr("홈에 디데이로 표시")} />
          <TextField name="note" label={tr("메모 (선택)")} multiline minRows={2} defaultValue={event?.note ?? ''} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {event && <Button color="error" onClick={remove} disabled={saving}>{tr("삭제")}</Button>}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} disabled={saving}>{tr("취소")}</Button>
        <Button type="submit" variant="contained" disabled={saving}>{saving ? (isEnglish() ? 'Saving…' : '저장 중…') : event ? tr('저장') : tr("추가")}</Button>
      </DialogActions>
    </Drawer>
  )
}

// 하루를 시간축으로 보여 준다. 하루 종일 일정은 위에 따로, 시간 있는 일정만 축에 올린다
function Timetable({ date, list, color, onPick, onAdd }: {
  date: string
  list: { ev: Event; first: string; last: string }[]
  color: (ev: Event) => string
  onPick: (ev: Event) => void
  onAdd: () => void
}) {
  const timed = list.filter((o) => !o.ev.all_day)
  const allDay = list.filter((o) => o.ev.all_day)
  const slots = layout(timed.map((o) => ({ ev: o.ev, ...slotOf(o.ev, { date, first: o.first, last: o.last }) })))

  if (!list.length) {
    return (
      <ButtonBase onClick={onAdd} sx={{ width: '100%', py: 3, borderRadius: 4, border: '1.5px dashed', borderColor: 'divider', color: 'text.secondary', gap: 1 }}>
        <PlusIcon size={18} /> {tr("이날 일정 추가하기")}
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
              {tr('하루 종일')} · {ev.title}
            </ButtonBase>
          ))}
        </Stack>
      )}

      <Box sx={{ position: 'relative', height: (h1 - h0) * HOUR_PX + 8 }}>
        {hours.map((h) => (
          <Box key={h} sx={{ position: 'absolute', left: 0, right: 0, top: y(h * 60), height: 0, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" sx={{ position: 'absolute', top: -9, left: 0, width: 38, textAlign: 'right', color: 'text.secondary' }}>
              {isEnglish() ? `${h}:00` : `${h}시`}
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
              <Typography sx={{ fontSize: 11, opacity: 0.8, lineHeight: 1.2 }}>
                {hm(new Date(s.ev.start_at))}{s.ev.end_at && ` ~ ${hm(new Date(s.ev.end_at))}`}
              </Typography>
            </ButtonBase>
          ))}
        </Box>
      </Box>
    </Card>
  )
}
