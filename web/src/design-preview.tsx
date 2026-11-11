import './design.css'
// Development-only visual fixture. Every network request is intercepted; no real account or writes.
if (import.meta.env.DEV) {
  const params = new URLSearchParams(location.search)
  const { setCurrentLanguage, LanguageChoice } = await import('./language')
  setCurrentLanguage(params.get('language') === 'en' ? 'en' : 'ko')
  localStorage.setItem('mui-mode', params.get('mode') === 'dark' ? 'dark' : 'light')
  const day = new Date(); day.setHours(12, 0, 0, 0)
  const date = (offset: number) => new Date(+day + offset * 864e5).toISOString()
  const profiles = ['서연', '지우'].map((display_name, i) => ({ id: `preview-${i}`, display_name, color: i ? '#5b8def' : '#a487cf', avatar_path: null, avatar_zoom: 1, avatar_x: 50, avatar_y: 50 }))
  const events = ['함께하는 점심', '저녁 산책', '주말 영화 보기'].map((title, i) => ({ id: `event-${i}`, title, note: null, start_at: date(i === 2 ? 2 : 0), all_day: false, created_by: profiles[i % 2].id, end_date: null, end_at: null, repeat_yearly: false, repeat_until_year: null, dday: i === 2 }))
  const requests: string[] = []
  Object.assign(window, { moroPreviewRequests: requests })
  window.fetch = async (input) => {
    const url = String(input instanceof Request ? input.url : input)
    requests.push(url)
    let data: unknown = []
    if (url.includes('/profiles')) data = profiles
    else if (url.includes('/events')) data = params.has('empty') ? [] : url.includes('dday=eq.true') ? events.filter(event => event.dday) : events
    else if (url.includes('/couples')) data = { started_on: '2025-04-12', cover_path: null, cover_zoom: 1, cover_x: 50, cover_y: 50 }
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  const { supabase } = await import('./supabase')
  const channel = { on() { return this }, subscribe() { return this }, unsubscribe: async () => 'ok' }
  supabase.channel = () => channel as unknown as ReturnType<typeof supabase.channel>
  supabase.removeChannel = async () => 'ok'
  const [{ createRoot }, { useState }, { ThemeProvider, CssBaseline }, { theme }, { default: Home }] = await Promise.all([import('react-dom/client'), import('react'), import('@mui/material'), import('./theme'), import('./Home')])
  function Preview() {
    const [language, updateLanguage] = useState<'ko' | 'en'>(params.get('language') === 'en' ? 'en' : 'ko')
    return <LanguageChoice.Provider value={{ language, setLanguage: next => { setCurrentLanguage(next); updateLanguage(next) } }}><ThemeProvider theme={theme} defaultMode="light"><CssBaseline/><Home coupleId="preview" userId="preview-0" onLeft={() => {}}/></ThemeProvider></LanguageChoice.Provider>
  }
  createRoot(document.getElementById('root')!).render(<Preview/>)
  const observer = new MutationObserver(() => {
    const tabs = document.querySelectorAll<HTMLButtonElement>('.MuiBottomNavigationAction-root')
    if (!tabs.length) return
    observer.disconnect()
    tabs[Number(params.get('tab') ?? 0)]?.click()
  })
  observer.observe(document.getElementById('root')!, { childList: true, subtree: true })
}
