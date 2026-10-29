// 푸시 발송 함수. 두 가지 호출:
//  - 앱: { type: 'poke' } + 사용자 JWT → send_poke RPC(하루 1회는 DB가 강제) 후 상대에게 푸시
//  - pg_cron: { type: 'reminders' } + x-cron-secret 헤더 → due_reminders() 결과대로 푸시
// 배포: supabase functions deploy notify --no-verify-jwt  (인증은 아래에서 직접 확인한다)
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const url = Deno.env.get('SUPABASE_URL')!
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

async function pushTo(userId: string, payload: { title: string; body: string }) {
  const { data: subs } = await admin.from('push_subscriptions').select('endpoint,p256dh,auth').eq('user_id', userId)
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload))
    } catch (e) {
      // 만료되거나 해지된 구독은 지운다
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
      else console.error('push failed', code, e)
    }
  }
}

const label: Record<string, string> = { '7d': '7일 뒤', '3d': '3일 뒤', '1d': '내일', '0d': '오늘' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const { type } = await req.json().catch(() => ({}))

  if (type === 'poke') {
    // 사용자 권한으로 RPC를 불러야 auth.uid()와 RLS가 그대로 적용된다
    const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: partner, error } = await user.rpc('send_poke')
    if (error) return json({ code: error.code, message: error.message }, 400)
    await pushTo(partner, { title: '콕! 👉', body: '상대가 찔렀어요' })
    return json({ ok: true })
  }

  if (type === 'reminders') {
    const secret = Deno.env.get('CRON_SECRET')
    if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ message: 'forbidden' }, 403)
    const { data, error } = await admin.rpc('due_reminders')
    if (error) return json({ message: error.message }, 500)
    for (const r of data ?? []) {
      await pushTo(r.recipient_id, { title: `📅 ${label[r.kind]} 일정`, body: r.title })
    }
    return json({ sent: data?.length ?? 0 })
  }

  return json({ message: 'unknown type' }, 400)
})
