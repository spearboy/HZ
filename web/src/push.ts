import { supabase } from './supabase'

// VAPID 공개키의 출처는 서버(Edge Function) 하나뿐이다.
// 빌드 시점 환경변수에 따로 넣어 두면, 서버 키와 어긋났을 때 구독은 정상으로 보이는데
// 발송만 조용히 실패한다(푸시 서버가 400을 돌려준다). 그래서 한 곳에서만 가져온다.
let cached: string | null | undefined

async function serverKey(): Promise<string | null> {
  if (cached !== undefined) return cached
  const { data } = await supabase.functions.invoke('hyper-endpoint', { body: { type: 'vapid' } })
  cached = (data as { publicKey?: string } | null)?.publicKey ?? null
  return cached
}

const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

// 아이폰은 '홈 화면에 추가'로 연 앱에서만 PushManager가 있다 [검증 필요: iOS 16.4+]
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window

export async function enablePush(userId: string) {
  const key = await serverKey()
  if (!key) throw new Error('서버에서 알림 키를 받지 못했어요. 잠시 뒤 다시 시도해 주세요.')
  if (await Notification.requestPermission() !== 'granted') throw new Error('알림 권한이 거부됐어요. 브라우저 설정에서 허용해 주세요.')

  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  // 서버 키가 바뀌었으면 옛 구독으로는 영영 못 받는다. 버리고 새로 받는다
  const old = await reg.pushManager.getSubscription()
  if (old) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', old.endpoint)
    await old.unsubscribe()
  }

  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  const { endpoint, keys } = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions')
    .upsert({ endpoint, user_id: userId, p256dh: keys!.p256dh, auth: keys!.auth })
  if (error) throw error
}

// 구독이 '있다'가 아니라 '지금 서버 키로 받은 구독이다'를 확인한다.
// 키가 어긋난 구독을 켜진 상태로 보여 주면, 안 오는 알림을 켜 둔 채로 계속 기다리게 된다
export async function pushEnabled() {
  if (!pushSupported()) return false
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return false
  const key = await serverKey()
  if (!key) return true // 서버에 못 물어봤으면 일단 켜진 것으로 둔다
  const used = sub.options.applicationServerKey
  return !!used && b64url(used) === key
}
