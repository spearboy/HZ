import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Alert, Box, Button, CircularProgress, Dialog, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material'
import { isEnglish } from './language'
import { koError, supabase } from './supabase'
import { supportFields, type Ticket } from './supportTypes'

export default function Support({ userId, onClose }: { userId: string; onClose: () => void }) {
  const en = isEnglish()
  const [tickets, setTickets] = useState<Ticket[] | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(async () => {
    const result = await supabase.from('support_tickets').select(supportFields).eq('user_id', userId).order('created_at', { ascending: false }).order('id', { ascending: false }).range(0, 99)
    if (result.error) setError(koError(result.error))
    else { setTickets(result.data); setHasMore(result.data.length === 100); setError('') }
  }, [userId])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  const loadMore = async () => {
    if (!tickets || loadingMore) return
    setLoadingMore(true)
    const result = await supabase.from('support_tickets').select(supportFields).eq('user_id', userId).order('created_at', { ascending: false }).order('id', { ascending: false }).range(tickets.length, tickets.length + 99)
    setLoadingMore(false)
    if (result.error) { setError(koError(result.error)); return }
    setTickets(previous => { const ids = new Set((previous ?? []).map(item => item.id)); return [...(previous ?? []), ...result.data.filter(item => !ids.has(item.id))] })
    setHasMore(result.data.length === 100)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (sending || !subject.trim() || !body.trim()) return
    setSending(true); setError(''); setNotice('')
    const result = await supabase.from('support_tickets').insert({ user_id: userId, subject: subject.trim(), body: body.trim() })
    setSending(false)
    if (result.error) { setError(koError(result.error)); return }
    setSubject(''); setBody(''); setNotice(en ? 'Your message has been sent.' : '문의가 접수됐어요.'); await load()
  }

  return <Dialog open onClose={sending ? undefined : onClose} fullWidth maxWidth="sm" scroll="paper">
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
      {en ? 'Contact support' : '문의하기'}<Button onClick={onClose} disabled={sending}>{en ? 'Close' : '닫기'}</Button>
    </DialogTitle>
    <DialogContent dividers>
      <Stack spacing={2.5}>
        <Typography variant="body2" color="text.secondary">{en ? 'Send us a question. You can check our reply here.' : '궁금한 점을 남겨주세요. 답변은 이곳에서 확인할 수 있어요.'}</Typography>
        <Box component="form" onSubmit={submit}>
          <Stack spacing={1.5}>
            <TextField label={en ? 'Subject' : '제목'} value={subject} onChange={e => setSubject(e.target.value)} required fullWidth slotProps={{ htmlInput: { maxLength: 100 } }} />
            <TextField label={en ? 'Message' : '문의 내용'} value={body} onChange={e => setBody(e.target.value)} required fullWidth multiline minRows={4} slotProps={{ htmlInput: { maxLength: 3000 } }} helperText={en ? 'Please do not include passwords or sensitive personal information.' : '비밀번호나 민감한 개인정보는 입력하지 말아 주세요.'} />
            <Button type="submit" variant="contained" disabled={sending || !subject.trim() || !body.trim()} sx={{ alignSelf: 'flex-start' }}>{sending ? (en ? 'Sending…' : '보내는 중…') : (en ? 'Send message' : '문의 보내기')}</Button>
          </Stack>
        </Box>
        {notice && <Alert severity="success">{notice}</Alert>}
        {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>{en ? 'Retry' : '다시 불러오기'}</Button>}>{error}</Alert>}
        <Box>
          <Typography component="h2" sx={{ fontWeight: 700, mb: 1.5 }}>{en ? 'Your messages' : '내 문의 내역'}</Typography>
          {tickets === null && !error ? <CircularProgress size={22} /> : tickets?.length ? <Stack spacing={1.5}>
            {tickets.map(ticket => <Box key={ticket.id} sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 2 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1, alignItems: 'baseline' }}>
                <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{ticket.subject}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>{new Date(ticket.created_at).toLocaleDateString(en ? 'en-US' : 'ko-KR')}</Typography>
              </Stack>
              <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{ticket.body}</Typography>
              <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary">{ticket.reply ? (en ? 'Support reply' : '운영자 답변') : (en ? 'Awaiting a reply' : '답변 대기 중')}</Typography>
                {ticket.reply && <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{ticket.reply}</Typography>}
              </Box>
            </Box>)}
          </Stack> : tickets && <Typography variant="body2" color="text.secondary">{en ? 'No messages yet.' : '아직 보낸 문의가 없어요.'}</Typography>}
          {hasMore && <Button onClick={loadMore} disabled={loadingMore} sx={{ mt: 1 }}>{loadingMore ? (en ? 'Loading…' : '불러오는 중…') : (en ? 'Load older messages' : '이전 문의 더 보기')}</Button>}
        </Box>
      </Stack>
    </DialogContent>
  </Dialog>
}
