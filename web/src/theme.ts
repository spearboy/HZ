import { createTheme } from '@mui/material/styles'

// 내 일정 = primary(코랄 핑크), 상대 일정 = secondary(스카이 블루)
export const theme = createTheme({
  cssVariables: true,
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#ff6b8b', contrastText: '#fff' },
        secondary: { main: '#5b8def' },
        background: { default: '#fff7f9', paper: '#ffffff' },
      },
    },
    dark: {
      palette: {
        primary: { main: '#ff8aa3', contrastText: '#2a0d14' },
        secondary: { main: '#8fb2ff' },
        background: { default: '#161214', paper: '#211b1e' },
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
