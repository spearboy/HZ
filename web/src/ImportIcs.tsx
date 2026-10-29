import { useState } from 'react'
import { Alert, Box, Button, Checkbox, List, ListItemButton, ListItemIcon, ListItemText, Stack } from '@mui/material'
import UploadFileRounded from '@mui/icons-material/UploadFileRounded'
import { parseIcs, type IcsEvent } from './ics'
import { koError, supabase } from './supabase'

// 폰 캘린더 앱에서 내보낸 .ics 파일 중 오늘 이후 일정을 골라 복사한다. 같은 일정은 source_uid로 한 번만 들어간다
export default function ImportIcs({ coupleId, userId, onDone }: { coupleId: string; userId: string; onDone: () => void }) {
  const [list, setList] = useState<IcsEvent[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState('')

  const open = async (file: File) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const events = parseIcs(await file.text()).filter((e) => e.start >= today).sort((a, b) => +a.start - +b.start)
    setList(events)
    setPicked(new Set(events.map((e) => e.uid)))
    setMsg(events.length ? '' : '오늘 이후 일정이 없어요.')
  }

  const save = async () => {
    const rows = list!.filter((e) => picked.has(e.uid)).map((e) => ({
      couple_id: coupleId, created_by: userId, title: e.title, note: e.note,
      start_at: e.start.toISOString(), all_day: e.allDay, source: 'ics', source_uid: e.uid,
    }))
    const { error } = await supabase.from('events')
      .upsert(rows, { onConflict: 'couple_id,created_by,source_uid', ignoreDuplicates: true })
    if (error) return setMsg(koError(error))
    setList(null)
    onDone()
  }

  const toggle = (uid: string) => {
    const next = new Set(picked)
    if (!next.delete(uid)) next.add(uid)
    setPicked(next)
  }

  return (
    <Stack spacing={1.5}>
      {!list?.length && (
        <Button component="label" variant="outlined" startIcon={<UploadFileRounded />}>
          .ics 파일 선택
          <input type="file" accept=".ics,text/calendar" hidden onChange={(e) => e.target.files?.[0] && open(e.target.files[0])} />
        </Button>
      )}
      {!!list?.length && (
        <>
          <Box sx={{ maxHeight: '50dvh', overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 3 }}>
            <List dense disablePadding>
              {list.map((e) => (
                <ListItemButton key={e.uid} onClick={() => toggle(e.uid)}>
                  <ListItemIcon><Checkbox edge="start" checked={picked.has(e.uid)} tabIndex={-1} disableRipple /></ListItemIcon>
                  <ListItemText primary={e.title}
                    secondary={`${e.start.toLocaleDateString('ko-KR')} ${e.allDay ? '하루 종일' : e.start.toTimeString().slice(0, 5)}`} />
                </ListItemButton>
              ))}
            </List>
          </Box>
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
            <Button onClick={() => setList(null)}>취소</Button>
            <Button variant="contained" onClick={save} disabled={!picked.size}>{picked.size}개 가져오기</Button>
          </Stack>
        </>
      )}
      {msg && <Alert severity="info">{msg}</Alert>}
    </Stack>
  )
}
