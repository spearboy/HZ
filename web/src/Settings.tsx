import { useContext, useEffect, useState } from 'react'
import {
  Avatar, Box, Button, ButtonBase, Card, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  List, ListItem, ListItemAvatar, ListItemButton, ListItemIcon, ListItemText, Switch, Typography, useTheme,
} from '@mui/material'
import LinkOffRounded from '@mui/icons-material/LinkOffRounded'
import CheckRounded from '@mui/icons-material/CheckRounded'
import NotificationsRounded from '@mui/icons-material/NotificationsRounded'
import EventAvailableRounded from '@mui/icons-material/EventAvailableRounded'
import LogoutRounded from '@mui/icons-material/LogoutRounded'
import { auth, koError, supabase } from './supabase'
import { enablePush, pushEnabled, pushSupported } from './push'
import ImportIcs from './ImportIcs'
import type { TabProps } from './Home'
import { THEMES, ThemeChoice } from './theme'

const PALETTE = ['#ff6b8b', '#ff7a59', '#f59f00', '#40c057', '#12b886', '#15aabf', '#5b8def', '#7950f2', '#be4bdb', '#868e96']

export default function Settings({ coupleId, userId, notify, profiles, colorOf, reloadProfiles, onLeft }: TabProps) {
  const { palette } = useTheme()
  const themeChoice = useContext(ThemeChoice)
  const [leaving, setLeaving] = useState(false)
  const [push, setPush] = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    pushEnabled().then(setPush)
  }, [])

  const turnOnPush = async () => {
    try { await enablePush(userId); setPush(true); notify('알림을 켰어요') }
    catch (e) { notify(e instanceof Error ? koError(e) : String(e)) }
  }

  const me = profiles.find((p) => p.id === userId)
  const partner = profiles.find((p) => p.id !== userId)
  const myColor = colorOf(userId)

  const leave = async () => {
    const { error } = await supabase.rpc('leave_couple')
    if (error) return notify(koError(error))
    setLeaving(false)
    onLeft()
  }

  const pickColor = async (color: string) => {
    const { error } = await supabase.from('profiles').update({ color }).eq('id', userId)
    if (error) return notify(koError(error))
    reloadProfiles()
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>설정</Typography>

      <Card sx={{ mb: 2 }}>
        <List>
          {[me, partner].map((p, i) => p && (
            <ListItem key={p.id}>
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: colorOf(p.id), color: palette.getContrastText(colorOf(p.id)) }}>{p.display_name?.[0] ?? '?'}</Avatar>
              </ListItemAvatar>
              <ListItemText primary={p.display_name ?? '이름 없음'} secondary={i ? '상대' : '나'} />
            </ListItem>
          ))}
        </List>
        <Box sx={{ px: 2, pb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>내 일정 색상</Typography>
          <Box role="radiogroup" aria-label="내 일정 색상" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
            {PALETTE.map((c) => {
              const on = c === myColor
              return (
                <ButtonBase key={c} role="radio" aria-checked={on} aria-label={`색상 ${c}`} onClick={() => pickColor(c)}
                  sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: c, color: palette.getContrastText(c),
                    boxShadow: on ? `0 0 0 3px var(--mui-palette-background-paper), 0 0 0 5px ${c}` : 'none', transition: 'box-shadow .15s' }}>
                  {on && <CheckRounded fontSize="small" />}
                </ButtonBase>
              )
            })}
          </Box>
        </Box>
      </Card>

      <Card sx={{ mb: 2, p: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>테마</Typography>
        <Box role="radiogroup" aria-label="테마" sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', rowGap: 1.5 }}>
          {THEMES.map((t) => {
            const on = t.id === themeChoice.id
            return (
              <ButtonBase key={t.id} role="radio" aria-checked={on} onClick={() => themeChoice.set(t.id)}
                sx={{ flexDirection: 'column', gap: 0.5, borderRadius: 3, py: 0.5 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', color: palette.getContrastText(t.primary),
                  background: `linear-gradient(135deg, ${t.primary} 50%, ${t.secondary} 50%)`,
                  boxShadow: on ? `0 0 0 3px var(--mui-palette-background-paper), 0 0 0 5px ${t.primary}` : 'inset 0 0 0 1px #0001' }}>
                  {on && <CheckRounded fontSize="small" />}
                </Box>
                <Typography variant="caption" sx={{ fontWeight: on ? 700 : 400 }}>{t.name}</Typography>
              </ButtonBase>
            )
          })}
        </Box>
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
          <ListItemButton onClick={() => setLeaving(true)}>
            <ListItemIcon><LinkOffRounded /></ListItemIcon>
            <ListItemText primary="연결 끊기" secondary="같은 사람과 다시 연결하면 일정과 사진이 그대로 돌아와요" />
          </ListItemButton>
          <ListItemButton onClick={auth.signOut}>
            <ListItemIcon><LogoutRounded /></ListItemIcon>
            <ListItemText primary="로그아웃" />
          </ListItemButton>
        </List>
      </Card>

      <Dialog open={leaving} onClose={() => setLeaving(false)}>
        <DialogTitle>연결을 끊을까요?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {partner?.display_name ?? '상대'}님과 둘 다 연결이 끊기고 공유 캘린더가 보이지 않게 돼요.
            데이터는 지워지지 않아서, 같은 사람과 다시 연결하면 그대로 이어서 쓸 수 있어요.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeaving(false)}>취소</Button>
          <Button color="error" variant="contained" onClick={leave}>연결 끊기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
