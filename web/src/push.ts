import { supabase } from './supabase'

const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

// 아이폰은 '홈 화면에 추가'로 연 앱에서만 PushManager가 있다 [검증 필요: iOS 16.4+]
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && !!vapid

export async function enablePush(userId: string) {
  if (await Notification.requestPermission() !== 'granted') throw new Error('알림 권한이 거부됐어요. 브라우저 설정에서 허용해 주세요.')
  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapid })
  const { endpoint, keys } = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions')
    .upsert({ endpoint, user_id: userId, p256dh: keys!.p256dh, auth: keys!.auth })
  if (error) throw error
}

export async function pushEnabled() {
  const reg = pushSupported() ? await navigator.serviceWorker.getRegistration() : undefined
  return !!(await reg?.pushManager.getSubscription())
}
