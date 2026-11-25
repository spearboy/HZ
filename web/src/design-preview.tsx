import './design.css'
// Development-only visual fixture. Every network request is intercepted; no real account or writes.
if (import.meta.env.DEV) {
  const params = new URLSearchParams(location.search)
  const { setCurrentLanguage } = await import('./language')
  setCurrentLanguage(params.get('language') === 'en' ? 'en' : 'ko')
  localStorage.setItem('mui-mode', params.get('mode') === 'dark' ? 'dark' : 'light')
  const day = new Date(); day.setHours(12, 0, 0, 0)
  const date = (offset: number) => new Date(+day + offset * 864e5).toISOString()
  const requestedDays = Number(params.get('celebrate'))
  const previewDays = Number.isInteger(requestedDays) && requestedDays > 0 && requestedDays < 10000 ? requestedDays : 200
  const start = new Date(day); start.setDate(start.getDate() - previewDays + 1)
  const previewStart = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
  const profiles = ['서연', '지우'].map((display_name, i) => ({ id: `preview-${i}`, display_name, color: i ? '#5b8def' : '#a487cf', avatar_path: null, avatar_zoom: 1, avatar_x: 50, avatar_y: 50 }))
  const events = ['함께하는 점심', '저녁 산책', '주말 영화 보기'].map((title, i) => ({ id: `event-${i}`, title, note: null, start_at: date(i === 2 ? 2 : 0), all_day: false, created_by: profiles[i % 2].id, end_date: null, end_at: null, repeat_yearly: false, repeat_until_year: null, dday: i === 2 }))
  const supportTickets = [{ id: 'preview-ticket', user_id: 'preview-0', subject: '사진 업로드 문의', body: '사진을 올리는 방법이 궁금해요.', reply: null as string | null, created_at: date(0), replied_at: null as string | null }]
  const adminCouples = [
    { couple_id: 'sample-couple-1', created_at: date(-140), members: ['서연', '지우'], event_count: 34, photo_count: 82, latest_record_at: date(-1) },
    { couple_id: 'sample-couple-2', created_at: date(-220), members: ['하늘', '수민'], event_count: 18, photo_count: 46, latest_record_at: date(-3) },
    { couple_id: 'sample-couple-3', created_at: date(-30), members: ['민지'], event_count: 0, photo_count: 0, latest_record_at: null },
  ]
  const requests: string[] = []
  Object.assign(window, { moroPreviewRequests: requests })
  window.fetch = async (input, init) => {
    const url = String(input instanceof Request ? input.url : input)
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
    requests.push(url)
    let data: unknown = []
    if (url.includes('/rpc/admin_couple_overview')) data = adminCouples
    else if (url.includes('/rpc/admin_couple_activity')) data = Array.from({ length: 14 }, (_, i) => ({ day: date(i - 13).slice(0, 10), events: i % 4 === 0 ? 2 : i % 3 === 0 ? 1 : 0, photos: i % 5 === 0 ? 2 : i % 4 === 0 ? 1 : 0 }))
    else if (url.includes('/support_admins')) data = params.has('admin-preview') ? [{ user_id: 'preview-0' }] : []
    else if (url.includes('/support_tickets')) {
      if (method === 'POST' && typeof init?.body === 'string') {
        const row = JSON.parse(init.body) as { user_id: string; subject: string; body: string }
        supportTickets.unshift({ ...row, id: `preview-${Date.now()}`, reply: null, created_at: new Date().toISOString(), replied_at: null })
        data = null
      } else if (method === 'PATCH' && typeof init?.body === 'string') {
        const changes = JSON.parse(init.body) as { reply: string; replied_at: string }
        const ticket = supportTickets.find(item => url.includes(`id=eq.${item.id}`))
        if (ticket) Object.assign(ticket, changes)
        data = ticket ?? null
      } else if (method === 'DELETE') {
        const index = supportTickets.findIndex(item => url.includes(`id=eq.${item.id}`))
        data = index < 0 ? [] : supportTickets.splice(index, 1).map(({ id }) => ({ id }))
      } else data = supportTickets
    }
    else if (url.includes('/profiles')) data = profiles
    else if (url.includes('/events')) data = params.has('empty') ? [] : url.includes('dday=eq.true') ? events.filter(event => event.dday) : events
    else if (url.includes('/couples')) data = { started_on: params.has('unstarted') ? null : params.has('celebrate') ? previewStart : '2025-04-12', cover_path: null, cover_zoom: 1, cover_x: 50, cover_y: 50 }
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  const { supabase } = await import('./supabase')
  const channel = { on() { return this }, subscribe() { return this }, unsubscribe: async () => 'ok' }
  supabase.channel = () => channel as unknown as ReturnType<typeof supabase.channel>
  supabase.removeChannel = async () => 'ok'
  const [{ createRoot }, { default: Preview }] = await Promise.all([import('react-dom/client'), import('./DesignPreview')])
  createRoot(document.getElementById('root')!).render(<Preview/>)
  const observer = new MutationObserver(() => {
    const tabs = document.querySelectorAll<HTMLButtonElement>('.MuiBottomNavigationAction-root')
    if (!tabs.length) return
    observer.disconnect()
    tabs[Number(params.get('tab') ?? 0)]?.click()
  })
  observer.observe(document.getElementById('root')!, { childList: true, subtree: true })
}
