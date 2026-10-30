import { createContext } from 'react'
import { createTheme } from '@mui/material/styles'

// 흰 바탕 + 파스텔 포인트. primary = 버튼·선택 강조, secondary = 토요일·찌르기 그라데이션 짝
export const THEMES = [
  { id: 'blue', name: '파스텔 블루', primary: '#6c9ef8', secondary: '#f59fb8', bg: '#f7faff' },
  { id: 'lavender', name: '라벤더', primary: '#9b8cf2', secondary: '#f7a8c8', bg: '#faf8ff' },
  { id: 'cherry', name: '벚꽃', primary: '#f58fab', secondary: '#8fb6f5', bg: '#fff8fa' },
  { id: 'mint', name: '민트', primary: '#4fbfa5', secondary: '#7aa9f7', bg: '#f5fcfa' },
  { id: 'peach', name: '피치', primary: '#f5a072', secondary: '#7fb3e8', bg: '#fff9f5' },
  { id: 'lemon', name: '레몬', primary: '#e3b12b', secondary: '#6c9ef8', bg: '#fffdf3' },
  { id: 'lilac', name: '라일락', primary: '#c48be0', secondary: '#79b8d6', bg: '#fdf8ff' },
  { id: 'sky', name: '스카이', primary: '#4cb3e6', secondary: '#f5a072', bg: '#f4fbff' },
  { id: 'sage', name: '세이지', primary: '#86ad80', secondary: '#d9a07a', bg: '#f8faf5' },
  { id: 'mono', name: '모노', primary: '#5b6270', secondary: '#9aa3b2', bg: '#fafafa' },
] as const
export type ThemeId = (typeof THEMES)[number]['id']

// 테마 선택은 기기별 취향이라 localStorage에만 둔다. 못 읽으면 기본(파스텔 블루)
export const ThemeChoice = createContext<{ id: ThemeId; set: (id: ThemeId) => void }>({ id: 'blue', set: () => {} })

export function makeTheme(id: ThemeId) {
  const t = THEMES.find((x) => x.id === id) ?? THEMES[0]
  return createTheme({
    cssVariables: true,
    colorSchemes: {
      light: {
        palette: {
          primary: { main: t.primary },
          secondary: { main: t.secondary },
          background: { default: t.bg, paper: '#ffffff' },
        },
      },
      dark: {
        palette: {
          primary: { main: t.primary },
          secondary: { main: t.secondary },
          background: { default: '#14161b', paper: '#1d2027' },
        },
      },
    },
    shape: { borderRadius: 16 },
    typography: {
      fontFamily: "'Pretendard Variable', Pretendard,-apple-system, BlinkMacSystemFont, system-ui, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
      button: { textTransform: 'none', fontWeight: 600 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
    },
    components: {
      MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 999, paddingInline: 18 } } },
      MuiPaper: { styleOverrides: { rounded: { borderRadius: 20 } } },
      MuiCard: { defaultProps: { elevation: 0 }, styleOverrides: { root: { border: '1px solid', borderColor: 'var(--mui-palette-divider)' } } },
      MuiTextField: { defaultProps: { fullWidth: true } },
    },
  })
}
