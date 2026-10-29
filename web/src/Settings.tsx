import { useEffect, useState } from 'react'
import { Avatar, Box, Card, List, ListItem, ListItemAvatar, ListItemButton, ListItemIcon, ListItemText, Switch, Typography } from '@mui/material'
import NotificationsRounded from '@mui/icons-material/NotificationsRounded'
import EventAvailableRounded from '@mui/icons-material/EventAvailableRounded'
import LogoutRounded from '@mui/icons-material/LogoutRounded'
import { auth, koError, supabase } from './supabase'
import { enablePush, pushEnabled, pushSupported } from './push'
import ImportIcs from './ImportIcs'
import type { TabProps } from './Home'

type Profile = { id: string; display_name: string | null }

export default function Settings({ coupleId, userId, notify }: TabProps) {
  const [people, setPeople] = useState<Profile[]>([])
  const [push, setPush] = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    supabase.from('profiles').select('id,display_name').then(({ data }) => setPeople(data ?? []))
    pushEnabled().then(setPush)
  }, [])

  const turnOnPush = async () => {
    try { await enablePush(userId); setPush(true); notify('알림을 켰어요') }
    catch (e) { notify(e instanceof Error ? koError(e) : String(e)) }
  }

  const me = people.find((p) => p.id === userId)
  const partner = people.find((p) => p.id !== userId)

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>설정</Typography>

      <Card sx={{ mb: 2 }}>
        <List>
          {[me, partner].map((p, i) => p && (
            <ListItem key={p.id}>
              <ListItemAvatar><Avatar sx={{ bgcolor: i ? 'secondary.main' : 'primary.main' }}>{p.display_name?.[0] ?? '?'}</Avatar></ListItemAvatar>
              <ListItemText primary={p.display_name ?? '이름 없음'} secondary={i ? '상대 · 파란색 일정' : '나 · 분홍색 일정'} />
            </ListItem>
          ))}
        </List>
      </Card>

      <Card>
        <List disablePadding>
          <ListItem secondaryAction={pushSupported() && <Switch edge="end" checked={push} disabled={push} onChange={turnOnPush} />}>
            <ListItemIcon><NotificationsRounded /></ListItemIcon>
            <ListItemText primary="푸시 알림"
              secondary={pushSupported() ? '찌르기, 일정 7·3·1일 전과 당일 오전 9시' : "아이폰은 Safari 공유 → '홈 화면에 추가' 후 그 앱에서 켤 수 있어요"} />
          </ListItem>
          <ListItemButton onClick={() => setImporting((v) => !v)}>
            <ListItemIcon><EventAvailableRounded /></ListItemIcon>
            <ListItemText primary="캘린더 가져오기" secondary="폰 캘린더에서 내보낸 .ics 파일의 일정을 복사해요" />
          </ListItemButton>
          {importing && <Box sx={{ px: 2, pb: 2 }}><ImportIcs coupleId={coupleId} userId={userId} onDone={() => { setImporting(false); notify('일정을 가져왔어요') }} /></Box>}
          <ListItemButton onClick={auth.signOut}>
            <ListItemIcon><LogoutRounded /></ListItemIcon>
            <ListItemText primary="로그아웃" />
          </ListItemButton>
        </List>
      </Card>
    </Box>
  )
}
