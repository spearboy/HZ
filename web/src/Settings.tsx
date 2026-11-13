import { tr } from './language'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import {
  Box, Button, ButtonBase, Card, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  List, ListItem, ListItemAvatar, ListItemButton, ListItemIcon, ListItemText, Switch, TextField, Typography, useTheme,
} from '@mui/material'
import {
  BellIcon, CameraIcon, CheckIcon, CalendarPlusIcon, ChevronRightIcon, DropletIcon, ImageIcon, LogOutIcon, UnlinkIcon,
} from './icons'
import { auth, koError, supabase } from './supabase'
import { enablePush, pushEnabled, pushSupported } from './push'
import { signedUrl } from './photoStorage'
import { FitAvatar } from './imageFitView'
import { DEFAULT_FIT, type Fit } from './imageFitStyles'
import { useWeatherFx, setFxOn } from './weatherPreferences'
import { avatarFit, type TabProps } from './homeTypes'
import { isEnglish, useLanguage } from './language'

const ImageFitDialog = lazy(() => import('./ImageFit'))
const ImportIcs = lazy(() => import('./ImportIcs'))

const PALETTE = ['#ff6b8b', '#ff7a59', '#f59f00', '#40c057', '#12b886', '#15aabf', '#5b8def', '#7950f2', '#be4bdb', '#868e96']

export default function Settings({ coupleId, userId, active, coupleVersion, notify, profiles, colorOf, reloadProfiles, onLeft }: TabProps) {
  const { palette } = useTheme()
  const { language, setLanguage } = useLanguage()
  const colorSaving = useRef(false)
  const [savingColor, setSavingColor] = useState(false)
  const coverLoadId = useRef(0)
  const [leaving, setLeaving] = useState(false)
  const [push, setPush] = useState(false)
  const [importing, setImporting] = useState(false)
  const [picking, setPicking] = useState<'avatar' | 'cover' | null>(null)
  const fx = useWeatherFx()
  const [cover, setCover] = useState<{ url: string | null; path: string | null; fit: Fit }>({ url: null, path: null, fit: DEFAULT_FIT })
  const lastCoupleVersion = useRef(-1)
  const coverFetchedAt = useRef(0)

  useEffect(() => {
    pushEnabled().then(setPush)
  }, [])

  const loadCover = useCallback(async () => {
    const id = ++coverLoadId.current
    const { data } = await supabase.from('couples').select('cover_path,cover_zoom,cover_x,cover_y').eq('id', coupleId).single()
    if (id !== coverLoadId.current) return
    if (!data) { lastCoupleVersion.current = -1; return }
    const url = await signedUrl(data.cover_path)
    if (id !== coverLoadId.current) return
    setCover({ url, path: data.cover_path, fit: { zoom: data.cover_zoom, x: data.cover_x, y: data.cover_y } })
    coverFetchedAt.current = Date.now()
  }, [coupleId])
  useEffect(() => {
    if (active && (lastCoupleVersion.current !== coupleVersion || (coverFetchedAt.current > 0 && Date.now() - coverFetchedAt.current > 60_000))) {
      lastCoupleVersion.current = coupleVersion
      loadCover()
    }
  }, [active, coupleVersion, loadCover])

  const turnOnPush = async () => {
    try { await enablePush(userId); setPush(true); notify(tr("알림을 켰어요")) }
    catch (e) { notify(e instanceof Error ? koError(e) : String(e)) }
  }

  const saveAvatar = async (v: Fit & { path: string | null }) => {
    const { error } = await supabase.from('profiles')
      .update({ avatar_path: v.path, avatar_zoom: v.zoom, avatar_x: v.x, avatar_y: v.y }).eq('id', userId)
    if (error) throw error
    setPicking(null)
    reloadProfiles()
  }

  const saveCover = async (v: Fit & { path: string | null }) => {
    const { error } = await supabase.from('couples')
      .update({ cover_path: v.path, cover_zoom: v.zoom, cover_x: v.x, cover_y: v.y }).eq('id', coupleId)
    if (error) throw error
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
    notify(tr("이름을 바꿨어요"))
  }

  const pickColor = async (color: string) => {
    if (color === colorOf(userId) || colorSaving.current) return
    colorSaving.current = true
    setSavingColor(true)
    try {
      const { error } = await supabase.from('profiles').update({ color }).eq('id', userId)
      if (error) return notify(koError(error))
      await reloadProfiles()
    } finally {
      colorSaving.current = false
      setSavingColor(false)
    }
  }

  return (
    <Box className="screen settings-screen">
      <Box className="screen-heading">
        <Typography component="h1" sx={{ fontSize: { xs: 32, md: 34 }, fontWeight: 700, letterSpacing: '-.04em', lineHeight: 1.15 }}>{tr('설정')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{isEnglish() ? 'Make MORO feel like yours' : '우리에게 맞게 MORO를 설정해요'}</Typography>
      </Box>

      <SettingsSection title={isEnglish() ? 'Our profiles' : '우리의 프로필'} description={isEnglish() ? 'The names, photos and colors that make this space ours.' : '우리의 이름과 사진, 일정에 쓰일 색상을 정해요.'}>
        <Card>
          <List disablePadding>
            {[me, partner].map((p, i) => p && (
              <ListItem key={p.id} sx={{ px: 2, py: 1.5, gap: 1, borderBottom: i === 0 && partner ? 1 : 0, borderColor: 'divider' }}>
                <ListItemAvatar sx={{ minWidth: 48 }}>
                  <FitAvatar url={p.avatarUrl} fit={avatarFit(p)} size={40} bg={colorOf(p.id)}
                    fg={palette.getContrastText(colorOf(p.id))} label={p.display_name ?? '?'} />
                </ListItemAvatar>
                <ListItemText sx={{ minWidth: 0, my: 0 }} primary={p.display_name ?? tr('이름 없음')}
                  slotProps={{ primary: { noWrap: true, sx: { fontWeight: 700 } } }} secondary={i ? tr('상대') : tr('나')} />
                {i === 0 && <Button size="small" startIcon={<CameraIcon size={16} />} onClick={() => setPicking('avatar')}
                  sx={{ flexShrink: 0, px: 1 }}>{p.avatar_path ? tr('사진 바꾸기') : tr('사진 넣기')}</Button>}
              </ListItem>
            ))}
          </List>
          <Box sx={{ px: 2, pt: 1.5, pb: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography component="label" htmlFor="settings-name" variant="body2" sx={{ display: 'block', fontWeight: 700, mb: 1 }}>{tr('내 이름')}</Typography>
            <NameField value={me?.display_name ?? ''} onSave={saveName} />
          </Box>
          <Box sx={{ px: 2, pb: 2.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 1.5 }}>{tr('내 일정 색상')}</Typography>
            <Box role="radiogroup" aria-label={tr('내 일정 색상')} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {PALETTE.map((c) => {
                const on = c === myColor
                return <ButtonBase key={c} role="radio" disabled={savingColor} aria-checked={on} aria-label={isEnglish() ? 'Color ' + c : '색상 ' + c} onClick={() => pickColor(c)}
                  sx={{ width: 40, height: 40, borderRadius: '50%', color: palette.getContrastText(c),
                    '&:focus-visible': { outline: '2px solid var(--mui-palette-primary-main)', outlineOffset: 1 } }}>
                  <Box sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: c, display: 'grid', placeItems: 'center',
                    boxShadow: on ? '0 0 0 2px var(--mui-palette-background-paper), 0 0 0 4px ' + c : 'none' }}>
                    {on && <CheckIcon size={17} />}
                  </Box>
                </ButtonBase>
              })}
            </Box>
          </Box>
        </Card>
      </SettingsSection>

      <SettingsSection title={isEnglish() ? 'App preferences' : '앱 설정'} description={isEnglish() ? 'Choose your language, reminders and home card.' : '편한 언어와 알림, 홈 카드의 분위기를 설정해요.'}>
        <Card>
          <Box sx={{ px: 2, py: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>{isEnglish() ? 'Language' : '언어'}</Typography>
            <Box role="radiogroup" aria-label="언어 / Language" sx={{ display: 'flex', gap: 1 }}>
              {(['ko', 'en'] as const).map(id => <Button key={id} role="radio" aria-checked={language === id}
                variant={language === id ? 'contained' : 'outlined'} onClick={() => setLanguage(id)}>{id === 'ko' ? '한국어' : 'English'}</Button>)}
            </Box>
          </Box>
          <List disablePadding sx={{ '& .MuiListItemIcon-root': { minWidth: 38, color: 'text.secondary' },
            '& .MuiListItemText-primary': { fontSize: 15, fontWeight: 650 }, '& .MuiListItemText-secondary': { mt: 0.25, fontSize: 12, lineHeight: 1.5 } }}>
            <ListItem sx={{ px: 2, py: 1.5, alignItems: 'flex-start', gap: 1 }}>
              <ListItemIcon sx={{ mt: 0.5 }}><BellIcon size={20} /></ListItemIcon>
              <ListItemText sx={{ minWidth: 0, my: 0 }} primary={tr('푸시 알림')}
                secondary={pushSupported() ? tr('찌르기, 일정 당일 아침 9시와 시작 1시간 전') : tr("아이폰은 Safari 공유 → '홈 화면에 추가' 후 그 앱에서 켤 수 있어요")} />
              {pushSupported() && <Switch checked={push} disabled={push} onChange={turnOnPush} slotProps={{ input: { 'aria-label': tr('푸시 알림') } }} />}
            </ListItem>
            <ListItem sx={{ px: 2, py: 1.5, alignItems: 'flex-start', gap: 1, borderTop: 1, borderColor: 'divider' }}>
              <ListItemIcon sx={{ mt: 0.5 }}><DropletIcon size={20} /></ListItemIcon>
              <ListItemText sx={{ minWidth: 0, my: 0 }} primary={tr('날씨 효과')} secondary={tr('비·눈 오는 날 메인 카드에 물방울과 김이 서려요 (문지르면 닦여요)')} />
              <Switch checked={fx} onChange={(e) => { setFxOn(e.target.checked) }} slotProps={{ input: { 'aria-label': tr('날씨 효과') } }} />
            </ListItem>
            <ListItemButton onClick={() => setPicking('cover')} sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: 'divider' }}>
              <ListItemIcon><ImageIcon size={20} /></ListItemIcon>
              <ListItemText primary={tr('메인 카드 배경')} secondary={cover.path ? tr('사진이 설정돼 있어요') : tr('홈 맨 위 카드에 둘만의 사진을 깔아요')} />
              <Box sx={{ color: 'text.disabled', lineHeight: 0, ml: 1 }}><ChevronRightIcon size={18} /></Box>
            </ListItemButton>
          </List>
        </Card>
      </SettingsSection>

      <SettingsSection title={isEnglish() ? 'Calendar & account' : '캘린더 및 계정'} description={isEnglish() ? 'Bring existing plans into MORO and manage your connection.' : '기존 일정을 가져오고 계정 연결을 관리해요.'}>
        <Card>
          <List disablePadding sx={{ '& .MuiListItemIcon-root': { minWidth: 38, color: 'text.secondary' },
            '& .MuiListItemText-primary': { fontSize: 15, fontWeight: 650 }, '& .MuiListItemText-secondary': { mt: 0.25, fontSize: 12, lineHeight: 1.5 } }}>
            <ListItemButton onClick={() => setImporting(v => !v)} aria-expanded={importing} sx={{ px: 2, py: 1.5 }}>
              <ListItemIcon><CalendarPlusIcon size={20} /></ListItemIcon>
              <ListItemText primary={tr('캘린더 가져오기')} secondary={tr('폰 캘린더에서 내보낸 .ics 파일의 일정을 복사해요')} />
              <Box sx={{ color: 'text.disabled', lineHeight: 0, ml: 1, transform: importing ? 'rotate(90deg)' : 'none', transition: 'transform .2s', '@media (prefers-reduced-motion: reduce)': { transition: 'none' } }}><ChevronRightIcon size={18} /></Box>
            </ListItemButton>
            {importing && <Box sx={{ px: 2, pb: 2 }}><Suspense fallback={<Typography variant="body2">{isEnglish() ? 'Loading…' : '불러오는 중…'}</Typography>}><ImportIcs coupleId={coupleId} userId={userId} onDone={() => { setImporting(false); notify(tr('일정을 가져왔어요')) }} /></Suspense></Box>}
            <ListItemButton onClick={() => setLeaving(true)} sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: 'divider' }}>
              <ListItemIcon><UnlinkIcon size={20} /></ListItemIcon>
              <ListItemText primary={tr('연결 끊기')} secondary={tr('같은 사람과 다시 연결하면 일정과 사진이 그대로 돌아와요')} />
              <Box sx={{ color: 'text.disabled', lineHeight: 0, ml: 1 }}><ChevronRightIcon size={18} /></Box>
            </ListItemButton>
            <ListItemButton onClick={auth.signOut} sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: 'divider' }}>
              <ListItemIcon><LogOutIcon size={20} /></ListItemIcon><ListItemText primary={tr('로그아웃')} />
              <Box sx={{ color: 'text.disabled', lineHeight: 0, ml: 1 }}><ChevronRightIcon size={18} /></Box>
            </ListItemButton>
          </List>
        </Card>
      </SettingsSection>

      {picking === 'avatar' && me && (<Suspense fallback={null}>
        <ImageFitDialog title={tr("내 프로필 사진")} round ratio={1} max={400} prefix={`${coupleId}/avatar`}
          url={me.avatarUrl ?? null} path={me.avatar_path} fit={avatarFit(me)}
          onClose={() => setPicking(null)} onSave={saveAvatar} onError={notify} /></Suspense>
      )}
      {picking === 'cover' && (<Suspense fallback={null}>
        <ImageFitDialog title={tr("메인 카드 배경")} ratio={16 / 9} max={1600} prefix={`${coupleId}/cover`}
          url={cover.url} path={cover.path} fit={cover.fit}
          onClose={() => setPicking(null)} onSave={saveCover} onError={notify} /></Suspense>
      )}

      <Dialog open={leaving} onClose={() => setLeaving(false)}>
        <DialogTitle>{tr("연결을 끊을까요?")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {isEnglish() ? `You and ${partner?.display_name ?? 'your partner'} will be disconnected and the shared calendar will be hidden. Your data is retained if you reconnect with the same person.` : `${partner?.display_name ?? '상대'}님과 둘 다 연결이 끊기고 공유 캘린더가 보이지 않게 돼요. 데이터는 지워지지 않아서, 같은 사람과 다시 연결하면 그대로 이어서 쓸 수 있어요.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeaving(false)}>{tr("취소")}</Button>
          <Button color="error" variant="contained" onClick={leave}>{tr("연결 끊기")}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function SettingsSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <Box component="section" className="settings-section">
    <Box component="header" sx={{ mb: 2 }}><Typography component="h2" sx={{ fontSize: 17, fontWeight: 700, mb: 0.75 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary">{description}</Typography></Box>
    {children}
  </Box>
}

// 입력 중에는 제 상태로 두고, 포커스를 벗어날 때만 저장한다 (글자마다 DB를 때리지 않게)
function NameField({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value)
  const [previousValue, setPreviousValue] = useState(value)
  if (previousValue !== value) { setPreviousValue(value); setV(value) }
  return (
    <TextField id="settings-name" size="small" placeholder={tr("예: 병현")} value={v} onChange={(e) => setV(e.target.value)}
      onBlur={() => onSave(v.trim())} onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && (e.target as HTMLInputElement).blur()}
      helperText={tr("홈 메인 카드와 설정에 보이는 이름이에요 (20자까지)")}
      slotProps={{ htmlInput: { maxLength: 20 } }} />
  )
}
