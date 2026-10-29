import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!url || !anonKey) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 환경변수가 없습니다 (.env 확인)')

export const supabase = createClient(url, anonKey)

// 로그인 방식은 이 파일에만 둔다. 앱(Capacitor) 단계에서 네이티브 로그인으로 바꿀 때 여기만 고친다.
export const auth = {
  oauth: (provider: 'google' | 'kakao') =>
    supabase.auth.signInWithOAuth({ provider, options: { redirectTo: location.origin } }),
  signUp: (email: string, password: string) =>
    supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } }),
  signIn: (email: string, password: string) => supabase.auth.signInWithPassword({ email, password }),
  signOut: () => supabase.auth.signOut(),
}

const messages: Record<string, string> = {
  'invalid or expired code': '코드가 틀렸거나 만료됐어요.',
  'already in a couple': '이미 연결된 상태예요.',
  'couple already full': '이미 두 사람이 연결된 캘린더예요.',
  'Invalid login credentials': '이메일 또는 비밀번호가 틀렸어요.',
  'User already registered': '이미 가입된 이메일이에요.',
  'no partner yet': '아직 상대가 연결되지 않았어요.',
  'Failed to send a request to the Edge Function': '서버 함수(notify)에 연결하지 못했어요. 배포 상태를 확인하세요.',
  'The resource already exists': '같은 사진이 이미 있어요.',
}
export const koError = (e: { message: string }) => messages[e.message] ?? e.message
