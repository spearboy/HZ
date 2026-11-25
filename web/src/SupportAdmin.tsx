import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Alert, Box, Button, Card, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { isEnglish } from './language'
import { auth, koError, supabase } from './supabase'
import { supportFields, type Ticket } from './supportTypes'
import AdminCouples from './AdminCouples'

export default function SupportAdmin({ userId }: { userId: string }) {
  const en = isEnglish()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [tickets, setTickets] = useState<Ticket[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [section, setSection] = useState<'couples' | 'tickets'>('couples')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    const result = await supabase.from('support_tickets').select(supportFields).order('created_at', { ascending: false }).order('id', { ascending: false }).range(0, 99)
    if (result.error) setError(koError(result.error))
    else { setTickets(result.data); setHasMore(result.data.length === 100); setError('') }
  }, [])
  useEffect(() => {
    let active = true
    void supabase.from('support_admins').select('user_id').eq('user_id', userId).maybeSingle().then(({ data, error: queryError }) => {
      if (!active) return
      if (queryError) setError(koError(queryError))
      setAllowed(!!data && !queryError)
    })
    return () => { active = false }
  }, [userId])
  useEffect(() => { if (allowed) void Promise.resolve().then(load) }, [allowed, load])

  const loadMore = async () => {
    if (!tickets || loadingMore) return
    setLoadingMore(true)
    const result = await supabase.from('support_tickets').select(supportFields).order('created_at', { ascending: false }).order('id', { ascending: false }).range(tickets.length, tickets.length + 99)
    setLoadingMore(false)
    if (result.error) { setError(koError(result.error)); return }
    setTickets(previous => { const ids = new Set((previous ?? []).map(item => item.id)); return [...(previous ?? []), ...result.data.filter(item => !ids.has(item.id))] })
    setHasMore(result.data.length === 100)
  }
  const ticket = tickets?.find(item => item.id === selected)
  const selectTicket = (item: Ticket) => { setSelected(item.id); setReply(item.reply ?? '') }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!ticket || !reply.trim() || saving) return
    setSaving(true); setError('')
    const result = await supabase.from('support_tickets').update({ reply: reply.trim(), replied_at: new Date().toISOString() }).eq('id', ticket.id).select(supportFields).single()
    setSaving(false)
    if (result.error) { setError(koError(result.error)); return }
    setTickets(items => (items ?? []).map(item => item.id === result.data.id ? result.data : item))
  }
  const removeTicket = async () => {
    if (!ticket || saving) return
    setSaving(true); setError('')
    const result = await supabase.from('support_tickets').delete().eq('id', ticket.id).select('id').maybeSingle()
    setSaving(false)
    if (result.error || !result.data) { setError(result.error ? koError(result.error) : (en ? 'The message could not be deleted.' : '문의를 삭제하지 못했어요.')); setConfirmDelete(false); return }
    setTickets(items => (items ?? []).filter(item => item.id !== ticket.id))
    setSelected(null); setReply(''); setConfirmDelete(false)
  }

  return <Box component="main" sx={{ maxWidth: 1050, mx: 'auto', px: 2.5, py: 4 }}>
    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 4 }}>
      <Box><Typography variant="body2" color="text.secondary">MORO</Typography><Typography component="h1" sx={{ fontSize: 28, fontWeight: 750 }}>{en ? 'Dashboard' : '운영 대시보드'}</Typography></Box>
      <Stack direction="row"><Button href={location.pathname}>{en ? 'Back to app' : '앱으로'}</Button><Button onClick={auth.signOut}>{en ? 'Sign out' : '로그아웃'}</Button></Stack>
    </Stack>
    {allowed === null ? <CircularProgress aria-label={en ? 'Loading' : '불러오는 중'} /> : !allowed ? <Alert severity="error">{error || (en ? 'This account does not have support administrator access.' : '문의 관리자 권한이 없는 계정입니다.')}</Alert> : <>
      <Tabs value={section} onChange={(_, value: 'couples' | 'tickets') => setSection(value)} aria-label={en ? 'Dashboard sections' : '대시보드 메뉴'} sx={{ mb: 3 }}>
        <Tab value="couples" label={en ? 'Couples' : '커플 현황'} /><Tab value="tickets" label={en ? 'Messages' : '문의 관리'} />
      </Tabs>
      {section === 'couples' ? <AdminCouples /> : <>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}><Typography variant="body2" color="text.secondary">{en ? 'Messages, newest first' : '최신 문의순'}</Typography><Button onClick={load}>{en ? 'Refresh' : '새로고침'}</Button></Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(240px, 340px) minmax(0, 1fr)' }, gap: 2, alignItems: 'start' }}>
        <Card sx={{ p: 1 }}>
          {tickets === null ? <Box sx={{ p: 2 }}><CircularProgress size={22} /></Box> : tickets.length ? tickets.map(item => <Button key={item.id} fullWidth onClick={() => selectTicket(item)} sx={{ display: 'block', textAlign: 'left', color: 'text.primary', p: 1.5, bgcolor: selected === item.id ? 'action.selected' : 'transparent' }}>
            <Typography noWrap sx={{ fontWeight: 700 }}>{item.subject}</Typography>
            <Typography variant="caption" color="text.secondary">{new Date(item.created_at).toLocaleDateString(en ? 'en-US' : 'ko-KR')} · {item.reply ? (en ? 'Replied' : '답변 완료') : (en ? 'Awaiting reply' : '답변 대기')}</Typography>
          </Button>) : <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>{en ? 'No messages yet.' : '접수된 문의가 없어요.'}</Typography>}
          {hasMore && <Button fullWidth onClick={loadMore} disabled={loadingMore}>{loadingMore ? (en ? 'Loading…' : '불러오는 중…') : (en ? 'Load older messages' : '이전 문의 더 보기')}</Button>}
        </Card>
        {ticket ? <Card sx={{ p: 2.5 }}>
          <Typography component="h2" sx={{ fontSize: 20, fontWeight: 750, overflowWrap: 'anywhere' }}>{ticket.subject}</Typography>
          <Typography variant="caption" color="text.secondary">{new Date(ticket.created_at).toLocaleString(en ? 'en-US' : 'ko-KR')}</Typography>
          <Typography sx={{ mt: 2.5, mb: 3, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{ticket.body}</Typography>
          <Box component="form" onSubmit={submit}><Stack spacing={1.5}>
            <TextField label={en ? 'Reply' : '답변'} value={reply} onChange={e => setReply(e.target.value)} multiline minRows={5} fullWidth required slotProps={{ htmlInput: { maxLength: 3000 } }} />
            <Button type="submit" variant="contained" disabled={saving || !reply.trim()} sx={{ alignSelf: 'flex-start' }}>{saving ? (en ? 'Saving…' : '저장 중…') : ticket.reply ? (en ? 'Update reply' : '답변 수정') : (en ? 'Send reply' : '답변 등록')}</Button>
          </Stack></Box>
          <Button color="error" onClick={() => setConfirmDelete(true)} disabled={saving} sx={{ mt: 3 }}>{en ? 'Delete message' : '문의 삭제'}</Button>
        </Card> : <Typography color="text.secondary" sx={{ p: 2 }}>{en ? 'Select a message to reply.' : '문의를 선택하면 내용을 확인하고 답변할 수 있어요.'}</Typography>}
      </Box>
      <Dialog open={confirmDelete} onClose={() => !saving && setConfirmDelete(false)}>
        <DialogTitle>{en ? 'Delete this message?' : '문의를 삭제할까요?'}</DialogTitle>
        <DialogContent><DialogContentText>{en ? 'The message and its reply will also disappear from the customer’s inquiry history. This cannot be undone.' : '문의와 답변이 사용자 문의 내역에서도 삭제되며 되돌릴 수 없어요.'}</DialogContentText></DialogContent>
        <DialogActions><Button onClick={() => setConfirmDelete(false)} disabled={saving}>{en ? 'Cancel' : '취소'}</Button><Button color="error" onClick={removeTicket} disabled={saving}>{en ? 'Delete' : '삭제'}</Button></DialogActions>
      </Dialog>
      </>}
    </>}
  </Box>
}
