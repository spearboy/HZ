import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  Box, Button, ButtonBase, Card, CardActionArea, Dialog, DialogActions, DialogContent, DialogTitle, Fab,
  FormControlLabel, IconButton, Stack, Switch, TextField, Typography,
} from '@mui/material'
import AddRounded from '@mui/icons-material/AddRounded'
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded'
import AddPhotoAlternateRounded from '@mui/icons-material/AddPhotoAlternateRounded'
import { koError, supabase } from './supabase'
import { PHOTO_COLUMNS, PhotoGrid, uploadPhotos, withThumbs, type Photo } from './Photos'
import type { TabProps } from './Home'

type Event = { id: string; title: string; note: string | null; start_at: string; all_day: boolean; created_by: string }

// shortcut: 브라우저 시간대 = KST로 가정, 둘 다 한국 밖에서 쓰면 Asia/Seoul 고정 변환으로 바꾼다
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const hm = (d: Date) => d.toTimeString().slice(0, 5)
const WEEK = ['일', '월', '화', '수', '목', '금', '토']

export default function Calendar({ coupleId, userId, version, notify }: TabProps) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [events, setEvents] = useState<Event[]>([])
  const [photoDays, setPhotoDays] = useState<Set<string>>(new Set())
  const [dayPhotos, setDayPhotos] = useState<Photo[]>([])
  const [selected, setSelected] = useState(() => ymd(new Date()))
  const [editing, setEditing] = useState<Event | 'new' | null>(null)
  const [uploading, setUploading] = useState(false)

  // 6주 고정 그리드: 그 달 1일이 속한 주의 일요일부터 42일
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay())
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i))
  const from = days[0].toISOString()
  const to = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + 42).toISOString()
  const fromDay = ymd(days[0])
  const toDay = ymd(days[41])

  const load = useCallback(async () => {
    const [ev, ph] = await Promise.all([
      supabase.from('events').select('id,title,note,start_at,all_day,created_by')
        .gte('start_at', from).lt('start_at', to).order('start_at'),
      supabase.from('photos').select(PHOTO_COLUMNS).gte('photo_date', fromDay).lte('photo_date', toDay).order('created_at'),
    ])
    if (ev.error || ph.error) return notify(koError((ev.error ?? ph.error)!))
    setEvents(ev.data)
    setPhotoDays(new Set(ph.data.map((p) => p.photo_date)))
    setDayPhotos(await withThumbs(ph.data.filter((p) => p.photo_date === selected)))
  }, [from, to, fromDay, toDay, selected, notify])

  useEffect(() => { load() }, [load, version])

  const byDay = new Map<string, Event[]>()
  for (const ev of events) {
    const k = ymd(new Date(ev.start_at))
    byDay.set(k, [...(byDay.get(k) ?? []), ev])
  }

  const poke = async () => {
    const { error } = await supabase.functions.invoke('notify', { body: { type: 'poke' } })
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
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))
  const [, mm, dd] = selected.split('-')
  const selectedDow = WEEK[new Date(`${selected}T00:00`).getDay()]

  return (
    <Box sx={{ p: 2, pb: 10 }}>
      <Stack direction="row" sx={{ alignItems: 'center', mb: 1 }}>
        <IconButton aria-label="이전 달" onClick={() => shift(-1)}><ChevronLeftRounded /></IconButton>
        <Typography variant="h6" sx={{ minWidth: 120, textAlign: 'center' }}>{month.getFullYear()}. {month.getMonth() + 1}</Typography>
        <IconButton aria-label="다음 달" onClick={() => shift(1)}><ChevronRightRounded /></IconButton>
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="outlined" onClick={poke}>👉 콕 찌르기</Button>
      </Stack>

      <Card sx={{ p: 1 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {WEEK.map((w, i) => (
            <Typography key={w} variant="caption" sx={{ textAlign: 'center', py: 0.5, fontWeight: 600, color: i === 0 ? 'error.main' : i === 6 ? 'secondary.main' : 'text.secondary' }}>{w}</Typography>
          ))}
          {days.map((d) => {
            const k = ymd(d)
            const list = byDay.get(k) ?? []
            const isSel = k === selected
            return (
              <ButtonBase key={k} onClick={() => setSelected(k)}
                sx={{ flexDirection: 'column', justifyContent: 'flex-start', gap: 0.5, py: 0.75, minHeight: 56, borderRadius: 3,
                  opacity: d.getMonth() !== month.getMonth() ? 0.35 : 1, bgcolor: isSel ? 'primary.main' : 'transparent',
                  color: isSel ? 'primary.contrastText' : 'text.primary', transition: 'background-color .15s' }}>
                <Typography variant="body2" sx={{ fontWeight: k === today ? 800 : 500, color: k === today && !isSel ? 'primary.main' : 'inherit' }}>
                  {d.getDate()}
                </Typography>
                <Stack direction="row" spacing={0.4} sx={{ alignItems: 'center', height: 6 }}>
                  {list.slice(0, 3).map((ev) => (
                    <Box key={ev.id} sx={{ width: 6, height: 6, borderRadius: '50%',
                      bgcolor: isSel ? 'primary.contrastText' : ev.created_by === userId ? 'primary.main' : 'secondary.main' }} />
                  ))}
                  {photoDays.has(k) && <Typography sx={{ fontSize: 9, lineHeight: 1 }}>📷</Typography>}
                </Stack>
              </ButtonBase>
            )
          })}
        </Box>
      </Card>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', mt: 3, mb: 1.5 }}>
        <Typography variant="h6">{+mm}월 {+dd}일</Typography>
        <Typography color="text.secondary">{selectedDow}요일</Typography>
      </Stack>

      <Stack spacing={1}>
        {(byDay.get(selected) ?? []).map((ev) => (
          <Card key={ev.id}>
            <CardActionArea onClick={() => setEditing(ev)} sx={{ display: 'flex', alignItems: 'stretch', justifyContent: 'flex-start' }}>
              <Box sx={{ width: 5, bgcolor: ev.created_by === userId ? 'primary.main' : 'secondary.main' }} />
              <Box sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">{ev.all_day ? '하루 종일' : hm(new Date(ev.start_at))}</Typography>
                <Typography sx={{ fontWeight: 600 }}>{ev.title}</Typography>
                {ev.note && <Typography variant="body2" color="text.secondary">{ev.note}</Typography>}
              </Box>
            </CardActionArea>
          </Card>
        ))}
        {!byDay.get(selected) && <Typography color="text.secondary" variant="body2">일정이 없어요. + 버튼으로 추가해 보세요.</Typography>}
      </Stack>

      <Stack direction="row" sx={{ alignItems: 'center', mt: 3, mb: 1 }}>
        <Typography sx={{ fontWeight: 700, flex: 1 }}>이날의 사진</Typography>
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
  const day = event ? ymd(new Date(event.start_at)) : date

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const row = {
      title: String(f.get('title')).trim(),
      note: String(f.get('note')).trim() || null,
      all_day: allDay,
      start_at: new Date(`${f.get('day')}T${allDay ? '00:00' : f.get('time')}`).toISOString(),
    }
    const { error } = event
      ? await supabase.from('events').update(row).eq('id', event.id)
      : await supabase.from('events').insert({ ...row, couple_id: coupleId, created_by: userId })
    if (error) return notify(koError(error))
    onSaved()
  }

  const remove = async () => {
    if (!event || !confirm(`'${event.title}' 일정을 삭제할까요?`)) return
    const { error } = await supabase.from('events').delete().eq('id', event.id)
    if (error) return notify(koError(error))
    onSaved()
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" slotProps={{ paper: { component: 'form', onSubmit: save } as object }}>
      <DialogTitle>{event ? '일정 수정' : '새 일정'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField name="title" label="제목" required autoFocus defaultValue={event?.title} slotProps={{ htmlInput: { maxLength: 200 } }} />
          <TextField name="day" type="date" label="날짜" required defaultValue={day} slotProps={{ inputLabel: { shrink: true } }} />
          <FormControlLabel control={<Switch checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />} label="하루 종일" />
          {!allDay && (
            <TextField name="time" type="time" label="시간" required defaultValue={event ? hm(new Date(event.start_at)) : '12:00'}
              slotProps={{ inputLabel: { shrink: true } }} />
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
    </Dialog>
  )
}
