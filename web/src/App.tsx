import { isEnglish, tr } from './language'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Alert, Box, Button, Card, CardContent, CircularProgress, Divider, Stack, TextField, Typography } from '@mui/material'
import { auth, koError, supabase } from './supabase'
import Home from './Home'
import { clearSignedCache } from './Photos'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, s) => { if (event === 'SIGNED_OUT') clearSignedCache(); setSession(s) })
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <Loading />
  if (!session) return <Login />
  return <Paired userId={session.user.id} />
}

const Loading = () => (
  <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>
)

// 로그인/연결 화면 공통 틀: 가운데 카드 + 로고
function Centered({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 2,
      bgcolor: 'background.default' }}>
      <Stack spacing={3} sx={{ width: '100%', maxWidth: 400 }}>
        <Stack sx={{ alignItems: 'center' }} spacing={1}>
          <Box component="img" src="/icon-192.png" alt="MORO" sx={{ width: 72, height: 72, borderRadius: '22px', boxShadow: 4 }} />
          <Typography variant="h5" sx={{ letterSpacing: title === 'MORO' ? '.28em' : 0, pl: title === 'MORO' ? '.28em' : 0 }}>{title}</Typography>
          <Typography color="text.secondary" sx={{ textAlign: 'center' }}>{sub}</Typography>
        </Stack>
        <Card><CardContent><Stack spacing={2}>{children}</Stack></CardContent></Card>
      </Stack>
    </Box>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')

  const submit = async (e: FormEvent, mode: 'in' | 'up') => {
    e.preventDefault()
    const { data, error } = mode === 'in' ? await auth.signIn(email, password) : await auth.signUp(email, password)
    if (error) setMsg(koError(error))
    else if (mode === 'up' && !data.session) setMsg(tr("확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인하세요."))
  }

  return (
    <Centered title="MORO" sub={tr("둘만의 일정과 사진을 함께 모아요")}>
      <Button size="large" onClick={() => auth.oauth('kakao')}
        sx={{ bgcolor: '#fee500', color: '#191919', '&:hover': { bgcolor: '#f5dc00' } }}>
        {tr("카카오로 시작하기")}
      </Button>
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
        {tr("처음 가입한 방식으로 계속 로그인하세요. 방식이 다르면 다른 계정이 됩니다.")}
      </Typography>
      <Divider>{tr("또는 이메일")}</Divider>
      <Stack component="form" spacing={1.5} onSubmit={(e) => submit(e, 'in')}>
        <TextField type="email" label={tr("이메일")} required size="small" value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField type="password" label={tr("비밀번호 (6자 이상)")} required size="small" slotProps={{ htmlInput: { minLength: 6 } }}
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" variant="contained" size="large">{tr("로그인")}</Button>
        <Button onClick={(e) => submit(e, 'up')}>{tr("이메일로 가입")}</Button>
      </Stack>
      {msg && <Alert severity="info">{msg}</Alert>}
    </Centered>
  )
}

// 커플이 두 명 다 연결돼야 홈을 연다
function Paired({ userId }: { userId: string }) {
  const [coupleId, setCoupleId] = useState<string | null | undefined>(undefined)
  const [code, setCode] = useState('')
  const [input, setInput] = useState('')
  const [msg, setMsg] = useState('')

  const check = useCallback(async () => {
    setMsg('')
    const { data, error } = await supabase.from('couple_members').select('couple_id')
    if (error) return setMsg(koError(error))
    if (data.length !== 2) clearSignedCache()
    setCoupleId(data.length === 2 ? data[0].couple_id : null)
  }, [])

  useEffect(() => { check() }, [check])
  // 상대가 연결을 끊었을 수 있으니 앱으로 돌아올 때마다 다시 확인
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [check])

  const createCode = async () => {
    const { data, error } = await supabase.rpc('create_invite')
    if (error) setMsg(koError(error))
    else setCode(data)
  }

  const accept = async (e: FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.rpc('accept_invite', { p_code: input })
    if (error) setMsg(koError(error))
    else check()
  }

  if (coupleId === undefined) return msg ? (
    <Centered title={isEnglish() ? 'Could not check your connection' : '연결 상태를 불러오지 못했어요'} sub="">
      <Alert severity="error">{msg}</Alert>
      <Button variant="contained" onClick={check}>{isEnglish() ? 'Try again' : '다시 시도'}</Button>
    </Centered>
  ) : <Loading />
  if (coupleId) return <Home coupleId={coupleId} userId={userId} onLeft={() => { clearSignedCache(); setCoupleId(null); check() }} />

  return (
    <Centered title={tr("상대와 연결하기")} sub={tr("한 사람이 코드를 만들고, 다른 사람이 입력하면 연결돼요")}>
      {code ? (
        <>
          <Typography variant="overline" color="text.secondary">{tr("내 초대 코드 (24시간 유효)")}</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '0.2em', textAlign: 'center' }}>{code}</Typography>
          <Button onClick={() => navigator.clipboard?.writeText(code)}>{tr("코드 복사")}</Button>
          <Button variant="contained" onClick={check}>{tr("상대가 입력했어요")}</Button>
        </>
      ) : (
        <Button variant="contained" size="large" onClick={createCode}>{tr("초대 코드 만들기")}</Button>
      )}
      <Divider>{tr("받은 코드가 있나요?")}</Divider>
      <Stack component="form" direction="row" spacing={1} onSubmit={accept}>
        <TextField label={tr("8자리 코드")} size="small" required value={input} onChange={(e) => setInput(e.target.value)} />
        <Button type="submit" variant="outlined">{tr("연결")}</Button>
      </Stack>
      {msg && <Alert severity="error">{msg}</Alert>}
      <Button color="inherit" onClick={auth.signOut}>{tr("로그아웃")}</Button>
    </Centered>
  )
}
