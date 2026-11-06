import { useCallback, useContext, useEffect, useState } from 'react'
import {
  Box, Button, ButtonBase, Card, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  List, ListItem, ListItemAvatar, ListItemButton, ListItemIcon, ListItemText, Switch, TextField, Typography, useTheme,
} from '@mui/material'
import {
  BellIcon, CameraIcon, CheckIcon, CalendarPlusIcon, DropletIcon, ImageIcon, LogOutIcon, UnlinkIcon,
} from '@animateicons/react/lucide'
import { auth, koError, supabase } from './supabase'
import { enablePush, pushEnabled, pushSupported } from './push'
import ImportIcs from './ImportIcs'
import { signedUrl } from './Photos'
import ImageFitDialog, { DEFAULT_FIT, FitAvatar, type Fit } from './ImageFit'
import { fxOn, setFxOn } from './GlassFx'
import { avatarFit, type TabProps } from './Home'
import { THEMES, ThemeChoice } from './theme'

const PALETTE = ['#ff6b8b', '#ff7a59', '#f59f00', '#40c057', '#12b886', '#15aabf', '#5b8def', '#7950f2', '#be4bdb', '#868e96']

export default function Settings({ coupleId, userId, notify, profiles, colorOf, reloadProfiles, onLeft }: TabProps) {
  const { palette } = useTheme()
  const themeChoice = useContext(ThemeChoice)
  const [leaving, setLeaving] = useState(false)
  const [push, setPush] = useState(false)
  const [importing, setImporting] = useState(false)
  const [picking, setPicking] = useState<'avatar' | 'cover' | null>(null)
  const [fx, setFx] = useState(fxOn)
  const [cover, setCover] = useState<{ url: string | null; path: string | null; fit: Fit }>({ url: null, path: null, fit: DEFAULT_FIT })

  useEffect(() => {
    pushEnabled().then(setPush)
  }, [])

  const loadCover = useCallback(async () => {
    const { data } = await supabase.from('couples').select('cover_path,cover_zoom,cover_x,cover_y').eq('id', coupleId).single()
    if (!data) return
    setCover({ url: await signedUrl(data.cover_path), path: data.cover_path, fit: { zoom: data.cover_zoom, x: data.cover_x, y: data.cover_y } })
  }, [coupleId])
  useEffect(() => { loadCover() }, [loadCover])

  const turnOnPush = async () => {
    try { await enablePush(userId); setPush(true); notify('알림을 켰어요') }
    catch (e) { notify(e instanceof Error ? koError(e) : String(e)) }
  }

  const saveAvatar = async (v: Fit & { path: string | null }) => {
    const { error } = await supabase.from('profiles')
      .update({ avatar_path: v.path, avatar_zoom: v.zoom, avatar_x: v.x, avatar_y: v.y }).eq('id', userId)
    if (error) return notify(koError(error))
    setPicking(null)
    reloadProfiles()
  }

  const saveCover = async (v: Fit & { path: string | null }) => {
    const { error } = await supabase.from('couples')
      .update({ cover_path: v.path, cover_zoom: v.zoom, cover_x: v.x, cover_y: v.y }).eq('id', coupleId)
    if (error) return notify(koError(error))
    setPicking(null)
    loadCover()
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

  const saveName = async (v: string) => {
    if (!v || v === me?.display_name) return
    const { error } = await supabase.from('profiles').update({ display_name: v }).eq('id', userId)
    if (error) return notify(koError(error))
    reloadProfiles()
    notify('이름을 바꿨어요')
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
            <ListItem key={p.id}
              secondaryAction={i === 0 && (
                <Button size="small" startIcon={<CameraIcon size={17} />} onClick={() => setPicking('avatar')}>
                  {p.avatar_path ? '사진 바꾸기' : '사진 넣기'}
                </Button>
              )}>
              <ListItemAvatar>
                <FitAvatar url={p.avatarUrl} fit={avatarFit(p)} size={40} bg={colorOf(p.id)}
                  fg={palette.getContrastText(colorOf(p.id))} label={p.display_name ?? '?'} />
              </ListItemAvatar>
              <ListItemText primary={p.display_name ?? '이름 없음'} secondary={i ? '상대' : '나'} />
            </ListItem>
          ))}
        </List>
        <Box sx={{ px: 2, pb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>내 이름</Typography>
          <NameField value={me?.display_name ?? ''} onSave={saveName} />
        </Box>
        <Box sx={{ px: 2, pb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>내 일정 색상</Typography>
          <Box role="radiogroup" aria-label="내 일정 색상" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
            {PALETTE.map((c) => {
              const on = c === myColor
              return (
                <ButtonBase key={c} role="radio" aria-checked={on} aria-label={`색상 ${c}`} onClick={() => pickColor(c)}
                  sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: c, color: palette.getContrastText(c),
                    boxShadow: on ? `0 0 0 3px var(--mui-palette-background-paper), 0 0 0 5px ${c}` : 'none', transition: 'box-shadow .15s' }}>
                  {on && <CheckIcon size={18} />}
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
                  {on && <CheckIcon size={18} />}
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
            <ListItemIcon><BellIcon size={22} /></ListItemIcon>
            <ListItemText primary="푸시 알림"
              secondary={pushSupported() ? '찌르기, 일정 7·3·1일 전과 당일 오전 9시' : "아이폰은 Safari 공유 → '홈 화면에 추가' 후 그 앱에서 켤 수 있어요"} />
          </ListItem>
          <ListItem secondaryAction={
            <Switch edge="end" checked={fx} onChange={(e) => { setFx(e.target.checked); setFxOn(e.target.checked) }} />
          }>
            <ListItemIcon><DropletIcon size={22} /></ListItemIcon>
            <ListItemText primary="날씨 효과" secondary="비·눈 오는 날 메인 카드에 물방울과 김이 서려요 (문지르면 닦여요)" />
          </ListItem>
          <ListItemButton onClick={() => setPicking('cover')}>
            <ListItemIcon><ImageIcon size={22} /></ListItemIcon>
            <ListItemText primary="메인 카드 배경" secondary={cover.path ? '사진이 설정돼 있어요' : '홈 맨 위 카드에 둘만의 사진을 깔아요'} />
          </ListItemButton>
          <ListItemButton onClick={() => setImporting((v) => !v)}>
            <ListItemIcon><CalendarPlusIcon size={22} /></ListItemIcon>
            <ListItemText primary="캘린더 가져오기" secondary="폰 캘린더에서 내보낸 .ics 파일의 일정을 복사해요" />
          </ListItemButton>
          {importing && <Box sx={{ px: 2, pb: 2 }}><ImportIcs coupleId={coupleId} userId={userId} onDone={() => { setImporting(false); notify('일정을 가져왔어요') }} /></Box>}
          <ListItemButton onClick={() => setLeaving(true)}>
            <ListItemIcon><UnlinkIcon size={22} /></ListItemIcon>
            <ListItemText primary="연결 끊기" secondary="같은 사람과 다시 연결하면 일정과 사진이 그대로 돌아와요" />
          </ListItemButton>
          <ListItemButton onClick={auth.signOut}>
            <ListItemIcon><LogOutIcon size={22} /></ListItemIcon>
            <ListItemText primary="로그아웃" />
          </ListItemButton>
        </List>
      </Card>

      {picking === 'avatar' && me && (
        <ImageFitDialog title="내 프로필 사진" round ratio={1} max={400} prefix={`${coupleId}/avatar`}
          url={me.avatarUrl ?? null} path={me.avatar_path} fit={avatarFit(me)}
          onClose={() => setPicking(null)} onSave={saveAvatar} onError={notify} />
      )}
      {picking === 'cover' && (
        <ImageFitDialog title="메인 카드 배경" ratio={16 / 9} max={1600} prefix={`${coupleId}/cover`}
          url={cover.url} path={cover.path} fit={cover.fit}
          onClose={() => setPicking(null)} onSave={saveCover} onError={notify} />
      )}

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

// 입력 중에는 제 상태로 두고, 포커스를 벗어날 때만 저장한다 (글자마다 DB를 때리지 않게)
function NameField({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value)
  useEffect(() => { setV(value) }, [value])
  return (
    <TextField size="small" placeholder="예: 병현" value={v} onChange={(e) => setV(e.target.value)}
      onBlur={() => onSave(v.trim())} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      helperText="홈 메인 카드와 설정에 보이는 이름이에요 (20자까지)"
      slotProps={{ htmlInput: { maxLength: 20 } }} />
  )
}
