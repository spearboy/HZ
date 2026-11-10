import { tr } from './language'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { BottomNavigation, BottomNavigationAction, Box, Paper, Snackbar } from '@mui/material'
import { CalendarDaysIcon, HouseIcon, ImageIcon, SettingsIcon } from '@animateicons/react/lucide'
import { makeIcon, type Playable } from './icons'
import { keyframes } from '@emotion/react'
import Summary from './Summary'
import { CalendarSkeleton, GridSkeleton, SummarySkeleton } from './Skeletons'
import { signedUrls } from './Photos'
import { DEFAULT_FIT, type Fit } from './ImageFit'
import { supabase } from './supabase'
// 처음 보이는 홈만 바로 싣고, 나머지 탭은 그 탭을 열 때 받아온다
const Calendar = lazy(() => import('./Calendar'))
const Album = lazy(() => import('./Album'))
const Settings = lazy(() => import('./Settings'))

const fadeIn = keyframes`from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none }`

const TABS = [
  { label: '홈', Icon: makeIcon(HouseIcon) },
  { label: '캘린더', Icon: makeIcon(CalendarDaysIcon) },
  { label: '앨범', Icon: makeIcon(ImageIcon) },
  { label: '설정', Icon: makeIcon(SettingsIcon) },
] as const

const SKELETON = [<SummarySkeleton />, <CalendarSkeleton />, <GridSkeleton />, <GridSkeleton rows={1} />]

export type Profile = {
  id: string; display_name: string | null; color: string | null
  avatar_path: string | null; avatar_zoom: number; avatar_x: number; avatar_y: number
  avatarUrl?: string | null
}
const PROFILE_COLUMNS = 'id,display_name,color,avatar_path,avatar_zoom,avatar_x,avatar_y'
export const avatarFit = (p: Profile): Fit =>
  p.avatar_path ? { zoom: p.avatar_zoom, x: p.avatar_x, y: p.avatar_y } : DEFAULT_FIT
export type TabProps = {
  coupleId: string; userId: string; active: boolean; eventVersion: number; photoVersion: number; coupleVersion: number; notify: (m: string) => void
  profiles: Profile[]; colorOf: (userId: string) => string; reloadProfiles: () => void; onLeft: () => void
  openCalendar: (date: string) => void
}

// 색을 아직 안 골랐으면 나 = 분홍, 상대 = 파랑
export const DEFAULT_COLORS = { me: '#ff6b8b', partner: '#5b8def' }

export default function Home({ coupleId, userId, onLeft }: { coupleId: string; userId: string; onLeft: () => void }) {
  const [tab, setTab] = useState(0)
  const [eventVersion, setEventVersion] = useState(0)
  const [photoVersion, setPhotoVersion] = useState(0)
  const [coupleVersion, setCoupleVersion] = useState(0)
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]))
  const [calendarTarget, setCalendarTarget] = useState<{ date: string; id: number } | null>(null)
  const [toast, setToast] = useState('')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const profileLoadId = useRef(0)

  const reloadProfiles = useCallback(async () => {
    const id = ++profileLoadId.current
    const { data } = await supabase.from('profiles').select(PROFILE_COLUMNS)
    if (!data || id !== profileLoadId.current) return
    const paths = data.flatMap(p => p.avatar_path ? [p.avatar_path] : [])
    const urls = await signedUrls(paths)
    if (id !== profileLoadId.current) return
    const byPath = new Map(paths.map((path, index) => [path, urls[index]]))
    setProfiles(data.map(p => ({ ...p, avatarUrl: p.avatar_path ? byPath.get(p.avatar_path) : null })))
  }, [])
  useEffect(() => { reloadProfiles() }, [reloadProfiles])

  // 상대가 바꾼 일정/사진은 version을 올려 각 탭이 다시 불러오게 하고, 찌르기를 받으면 알려 준다
  useEffect(() => {
    const timers: Partial<Record<'event' | 'photo' | 'profile' | 'couple', ReturnType<typeof setTimeout>>> = {}
    const schedule = (key: keyof typeof timers, action: () => void) => {
      clearTimeout(timers[key])
      timers[key] = setTimeout(action, 180)
    }
    let connected = false
    const ch = supabase.channel('couple')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `couple_id=eq.${coupleId}` }, () => schedule('event', () => setEventVersion(v => v + 1)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos', filter: `couple_id=eq.${coupleId}` }, () => schedule('photo', () => setPhotoVersion(v => v + 1)))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => schedule('profile', () => { reloadProfiles() }))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'couples', filter: `id=eq.${coupleId}` }, () => schedule('couple', () => setCoupleVersion(v => v + 1)))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pokes', filter: `receiver_id=eq.${userId}` }, () => setToast(tr('콕! 상대가 찔렀어요 👉')))
      .subscribe(status => {
        if (status !== 'SUBSCRIBED') return
        if (connected) {
          setEventVersion(v => v + 1); setPhotoVersion(v => v + 1); setCoupleVersion(v => v + 1); reloadProfiles()
        }
        connected = true
      })
    return () => { Object.values(timers).forEach(clearTimeout); supabase.removeChannel(ch) }
  }, [coupleId, userId, reloadProfiles])

  const colorOf = useCallback((id: string) => profiles.find((p) => p.id === id)?.color ?? (id === userId ? DEFAULT_COLORS.me : DEFAULT_COLORS.partner), [profiles, userId])
  const openCalendar = useCallback((date: string) => {
    setCalendarTarget(prev => ({ date, id: (prev?.id ?? 0) + 1 }))
    setVisited(prev => new Set(prev).add(1))
    setTab(1)
  }, [])
  const props = { coupleId, userId, eventVersion, photoVersion, coupleVersion, notify: setToast, profiles, colorOf, reloadProfiles, onLeft, openCalendar }

  return (
    <Box sx={{ minHeight: '100dvh', pb: 'calc(72px + env(safe-area-inset-bottom))', bgcolor: 'background.default' }}>
      {[0, 1, 2, 3].map(i => visited.has(i) && (
        <Box key={i} hidden={tab !== i} sx={{ maxWidth: 640, mx: 'auto', animation: tab === i ? `${fadeIn} .32s cubic-bezier(.2,.8,.2,1)` : 'none',
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }}>
          <Suspense fallback={SKELETON[i]}>
            {i === 0 && <Summary {...props} active={tab === i} />}
            {i === 1 && <Calendar coupleId={coupleId} userId={userId} eventVersion={eventVersion} photoVersion={photoVersion}
              notify={setToast} colorOf={colorOf} active={tab === i} target={calendarTarget} />}
            {i === 2 && <Album {...props} active={tab === i} />}
            {i === 3 && <Settings {...props} active={tab === i} />}
          </Suspense>
        </Box>
      ))}

      <Paper elevation={0} sx={{ position: 'fixed', left: 0, right: 0, bottom: 0, borderRadius: 0, borderTop: 1, borderColor: 'divider',
        zIndex: 1100, pb: 'env(safe-area-inset-bottom)', bgcolor: 'background.paper',
        '@supports (backdrop-filter: blur(16px))': {
          bgcolor: 'color-mix(in srgb, var(--mui-palette-background-paper) 82%, transparent)',
          backdropFilter: 'blur(18px) saturate(140%)',
        },
        '@media (prefers-reduced-transparency: reduce)': { bgcolor: 'background.paper', backdropFilter: 'none' },
        '@media (forced-colors: active)': { bgcolor: 'Canvas', backdropFilter: 'none' } }}>
        <BottomNavigation showLabels value={tab} onChange={(_, v) => { setVisited(prev => new Set(prev).add(v)); setTab(v) }} sx={{ bgcolor: 'transparent', maxWidth: 640, mx: 'auto', height: 68,
          '& .MuiBottomNavigationAction-root': { minWidth: 0, gap: 0.5, color: 'text.secondary' },
          '& .MuiBottomNavigationAction-label': { fontSize: 11, fontWeight: 600 },
          '& .Mui-selected .MuiBottomNavigationAction-label': { fontSize: 11 } }}>
          {TABS.map(({ label, Icon }, i) => (
            <BottomNavigationAction key={label} label={tr(label)} icon={<TabIcon Icon={Icon} active={tab === i} />} />
          ))}
        </BottomNavigation>
      </Paper>

      <Snackbar open={!!toast} message={toast} autoHideDuration={3000} onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }} />
    </Box>
  )
}

// 탭이 선택되는 순간 그 아이콘만 한 번 움직인다
function TabIcon({ Icon, active }: { Icon: (typeof TABS)[number]['Icon']; active: boolean }) {
  const ref = useRef<Playable>(null)
  useEffect(() => { if (active && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) ref.current?.play() }, [active])
  return <Box sx={{ width: 46, height: 28, borderRadius: 3, display: 'grid', placeItems: 'center',
    bgcolor: active ? 'color-mix(in srgb, var(--mui-palette-primary-main) 12%, transparent)' : 'transparent',
    transition: 'background-color 200ms ease, transform 260ms cubic-bezier(.2,.8,.2,1)', transform: active ? 'scale(1)' : 'scale(.94)',
    '@media (prefers-reduced-motion: reduce)': { transition: 'none', transform: 'none' } }}><Icon ref={ref} size={22} /></Box>
}
