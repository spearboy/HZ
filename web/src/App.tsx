import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Alert, Box, Button, Card, CardContent, CircularProgress, Divider, Stack, TextField, Typography } from '@mui/material'
import FavoriteRounded from '@mui/icons-material/FavoriteRounded'
import { auth, koError, supabase } from './supabase'
import Home from './Home'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
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
      background: (t) => `radial-gradient(circle at 20% 0%, ${t.vars!.palette.primary.main}33, transparent 60%)` }}>
      <Stack spacing={3} sx={{ width: '100%', maxWidth: 400 }}>
        <Stack sx={{ alignItems: 'center' }} spacing={1}>
          <Box sx={{ width: 64, height: 64, borderRadius: '22px', bgcolor: 'primary.main', color: 'primary.contrastText', display: 'grid', placeItems: 'center', boxShadow: 4 }}>
            <FavoriteRounded fontSize="large" />
          </Box>
          <Typography variant="h5">{title}</Typography>
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
    else if (mode === 'up' && !data.session) setMsg('확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인하세요.')
  }

  return (
    <Centered title="우리 캘린더" sub="둘만의 일정과 사진을 함께 모아요">
      <Button size="large" onClick={() => auth.oauth('kakao')}
        sx={{ bgcolor: '#fee500', color: '#191919', '&:hover': { bgcolor: '#f5dc00' } }}>
        카카오로 시작하기
      </Button>
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
        처음 가입한 방식으로 계속 로그인하세요. 방식이 다르면 다른 계정이 됩니다.
      </Typography>
      <Divider>또는 이메일</Divider>
      <Stack component="form" spacing={1.5} onSubmit={(e) => submit(e, 'in')}>
        <TextField type="email" label="이메일" required size="small" value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField type="password" label="비밀번호 (6자 이상)" required size="small" slotProps={{ htmlInput: { minLength: 6 } }}
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" variant="contained" size="large">로그인</Button>
        <Button onClick={(e) => submit(e, 'up')}>이메일로 가입</Button>
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
    const { data, error } = await supabase.from('couple_members').select('couple_id')
    if (error) return setMsg(koError(error))
    setCoupleId(data.length === 2 ? data[0].couple_id : null)
  }, [])

  useEffect(() => { check() }, [check])

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

  if (coupleId === undefined) return <Loading />
  if (coupleId) return <Home coupleId={coupleId} userId={userId} />

  return (
    <Centered title="상대와 연결하기" sub="한 사람이 코드를 만들고, 다른 사람이 입력하면 연결돼요">
      {code ? (
        <>
          <Typography variant="overline" color="text.secondary">내 초대 코드 (24시간 유효)</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '0.2em', textAlign: 'center' }}>{code}</Typography>
          <Button onClick={() => navigator.clipboard?.writeText(code)}>코드 복사</Button>
          <Button variant="contained" onClick={check}>상대가 입력했어요</Button>
        </>
      ) : (
        <Button variant="contained" size="large" onClick={createCode}>초대 코드 만들기</Button>
      )}
      <Divider>받은 코드가 있나요?</Divider>
      <Stack component="form" direction="row" spacing={1} onSubmit={accept}>
        <TextField label="8자리 코드" size="small" required value={input} onChange={(e) => setInput(e.target.value)} />
        <Button type="submit" variant="outlined">연결</Button>
      </Stack>
      {msg && <Alert severity="error">{msg}</Alert>}
      <Button color="inherit" onClick={auth.signOut}>로그아웃</Button>
    </Centered>
  )
}
