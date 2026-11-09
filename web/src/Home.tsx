import { tr } from './language'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { BottomNavigation, BottomNavigationAction, Box, Paper, Snackbar } from '@mui/material'
import { CalendarDaysIcon, HouseIcon, ImageIcon, SettingsIcon } from '@animateicons/react/lucide'
import { makeIcon, type Playable } from './icons'
import { keyframes } from '@emotion/react'
import Summary from './Summary'
import { CalendarSkeleton, GridSkeleton, SummarySkeleton } from './Skeletons'
import { signedUrl } from './Photos'
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
  coupleId: string; userId: string; version: number; notify: (m: string) => void
  profiles: Profile[]; colorOf: (userId: string) => string; reloadProfiles: () => void; onLeft: () => void
}

// 색을 아직 안 골랐으면 나 = 분홍, 상대 = 파랑
export const DEFAULT_COLORS = { me: '#ff6b8b', partner: '#5b8def' }

export default function Home({ coupleId, userId, onLeft }: { coupleId: string; userId: string; onLeft: () => void }) {
  const [tab, setTab] = useState(0)
  const [version, setVersion] = useState(0)
  const [toast, setToast] = useState('')
  const [profiles, setProfiles] = useState<Profile[]>([])

  const reloadProfiles = useCallback(async () => {
    const { data } = await supabase.from('profiles').select(PROFILE_COLUMNS)
    // 비공개 버킷이라 프로필 사진도 서명 URL이 필요하다
    setProfiles(await Promise.all((data ?? []).map(async (p) => ({ ...p, avatarUrl: await signedUrl(p.avatar_path) }))))
  }, [])
  useEffect(() => { reloadProfiles() }, [reloadProfiles, version])

  // 상대가 바꾼 일정/사진은 version을 올려 각 탭이 다시 불러오게 하고, 찌르기를 받으면 알려 준다
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1)
    const ch = supabase.channel('couple')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `couple_id=eq.${coupleId}` }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos', filter: `couple_id=eq.${coupleId}` }, bump)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, bump)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'couples', filter: `id=eq.${coupleId}` }, bump)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pokes', filter: `receiver_id=eq.${userId}` }, () => setToast(tr('콕! 상대가 찔렀어요 👉')))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [coupleId, userId])

  const colorOf = (id: string) => profiles.find((p) => p.id === id)?.color ?? (id === userId ? DEFAULT_COLORS.me : DEFAULT_COLORS.partner)
  const props: TabProps = { coupleId, userId, version, notify: setToast, profiles, colorOf, reloadProfiles, onLeft }

  return (
    <Box sx={{ minHeight: '100dvh', pb: 'calc(72px + env(safe-area-inset-bottom))', bgcolor: 'background.default' }}>
      <Box key={tab} sx={{ maxWidth: 640, mx: 'auto',
        animation: `${fadeIn} .32s cubic-bezier(.2,.8,.2,1)`,
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }}>
        <Suspense fallback={SKELETON[tab]}>
          {tab === 0 && <Summary {...props} />}
          {tab === 1 && <Calendar {...props} />}
          {tab === 2 && <Album {...props} />}
          {tab === 3 && <Settings {...props} />}
        </Suspense>
      </Box>

      <Paper elevation={0} sx={{ position: 'fixed', left: 0, right: 0, bottom: 0, borderRadius: 0, borderTop: 1, borderColor: 'divider',
        pb: 'env(safe-area-inset-bottom)', bgcolor: 'background.paper' }}>
        <BottomNavigation showLabels value={tab} onChange={(_, v) => setTab(v)} sx={{ bgcolor: 'transparent', maxWidth: 640, mx: 'auto', height: 68,
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
