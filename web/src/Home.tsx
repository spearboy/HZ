import { useCallback, useEffect, useState } from 'react'
import { BottomNavigation, BottomNavigationAction, Box, Paper, Snackbar } from '@mui/material'
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded'
import PhotoLibraryRounded from '@mui/icons-material/PhotoLibraryRounded'
import SettingsRounded from '@mui/icons-material/SettingsRounded'
import { supabase } from './supabase'
import Calendar from './Calendar'
import Album from './Album'
import Settings from './Settings'

export type Profile = { id: string; display_name: string | null; color: string | null }
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

  const reloadProfiles = useCallback(() => {
    supabase.from('profiles').select('id,display_name,color').then(({ data }) => setProfiles(data ?? []))
  }, [])
  useEffect(reloadProfiles, [reloadProfiles, version])

  // 상대가 바꾼 일정/사진은 version을 올려 각 탭이 다시 불러오게 하고, 찌르기를 받으면 알려 준다
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1)
    const ch = supabase.channel('couple')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `couple_id=eq.${coupleId}` }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos', filter: `couple_id=eq.${coupleId}` }, bump)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, bump)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pokes', filter: `receiver_id=eq.${userId}` }, () => setToast('콕! 상대가 찔렀어요 👉'))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [coupleId, userId])

  const colorOf = (id: string) => profiles.find((p) => p.id === id)?.color ?? (id === userId ? DEFAULT_COLORS.me : DEFAULT_COLORS.partner)
  const props: TabProps = { coupleId, userId, version, notify: setToast, profiles, colorOf, reloadProfiles, onLeft }

  return (
    <Box sx={{ minHeight: '100dvh', pb: 'calc(72px + env(safe-area-inset-bottom))', bgcolor: 'background.default' }}>
      <Box sx={{ maxWidth: 640, mx: 'auto' }}>
        {tab === 0 && <Calendar {...props} />}
        {tab === 1 && <Album {...props} />}
        {tab === 2 && <Settings {...props} />}
      </Box>

      <Paper elevation={0} sx={{ position: 'fixed', left: 0, right: 0, bottom: 0, borderRadius: 0, borderTop: 1, borderColor: 'divider',
        pb: 'env(safe-area-inset-bottom)', backdropFilter: 'blur(12px)', bgcolor: 'color-mix(in srgb, var(--mui-palette-background-paper) 85%, transparent)' }}>
        <BottomNavigation showLabels value={tab} onChange={(_, v) => setTab(v)} sx={{ bgcolor: 'transparent', maxWidth: 640, mx: 'auto' }}>
          <BottomNavigationAction label="캘린더" icon={<CalendarMonthRounded />} />
          <BottomNavigationAction label="앨범" icon={<PhotoLibraryRounded />} />
          <BottomNavigationAction label="설정" icon={<SettingsRounded />} />
        </BottomNavigation>
      </Paper>

      <Snackbar open={!!toast} message={toast} autoHideDuration={3000} onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }} />
    </Box>
  )
}
