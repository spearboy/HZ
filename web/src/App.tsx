import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { auth, koError, supabase } from './supabase'
import Calendar from './Calendar'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (!session) return <Login />
  return <Paired userId={session.user.id} />
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
    <main className="narrow">
      <h1>우리 캘린더</h1>
      <button className="kakao" onClick={() => auth.oauth('kakao')}>카카오로 로그인</button>
      <p className="muted">처음 가입한 방식으로 계속 로그인하세요. 방식이 다르면 다른 계정이 됩니다.</p>
      <form onSubmit={(e) => submit(e, 'in')}>
        <input type="email" placeholder="이메일" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="비밀번호 (6자 이상)" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">이메일로 로그인</button>
        <button type="button" className="secondary" onClick={(e) => submit(e, 'up')}>이메일로 가입</button>
      </form>
      {msg && <p role="alert">{msg}</p>}
    </main>
  )
}

// 커플이 두 명 다 연결돼야 캘린더를 연다
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

  if (coupleId === undefined) return null
  if (coupleId) return <Calendar coupleId={coupleId} userId={userId} />

  return (
    <main className="narrow">
      <h1>상대와 연결하기</h1>
      <section>
        <h2>내가 코드를 만들기</h2>
        {code ? (
          <>
            <p className="code">{code}</p>
            <p className="muted">상대에게 이 코드를 보내세요. 24시간 동안 유효해요.</p>
            <button onClick={check}>상대가 입력했어요</button>
          </>
        ) : (
          <button onClick={createCode}>초대 코드 만들기</button>
        )}
      </section>
      <section>
        <h2>받은 코드 입력</h2>
        <form onSubmit={accept}>
          <input placeholder="8자리 코드" required value={input} onChange={(e) => setInput(e.target.value)} />
          <button type="submit">연결</button>
        </form>
      </section>
      {msg && <p role="alert">{msg}</p>}
      <button className="secondary" onClick={auth.signOut}>로그아웃</button>
    </main>
  )
}
