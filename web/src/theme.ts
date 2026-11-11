import { createTheme } from '@mui/material/styles'

// MORO 로고의 라벤더와 블루를 중심으로 한 단일 팔레트.
export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data' },
  colorSchemes: {
    light: { palette: { primary: { main: '#62519c', contrastText: '#ffffff' }, secondary: { main: '#6478bb' },
      background: { default: '#f8f7fa', paper: '#ffffff' }, text: { primary: '#292633', secondary: '#696573' }, divider: '#e9e6ee' } },
    dark: { palette: { primary: { main: '#c8b8f0', contrastText: '#241a40' }, secondary: { main: '#b4c4fa' },
      background: { default: '#141416', paper: '#1e1e22' }, text: { primary: '#f1eff8', secondary: '#bdb9c6' }, divider: '#343239' } },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, 'Apple SD Gothic Neo', sans-serif",
    fontSize: 14,
    allVariants: { fontVariantNumeric: 'tabular-nums' },
    body1: { fontSize: 15, lineHeight: 1.6 },
    body2: { fontSize: 14, lineHeight: 1.5 },
    button: { textTransform: 'none', fontWeight: 650 },
    h5: { fontWeight: 700, letterSpacing: '-0.035em' },
    h6: { fontWeight: 700, letterSpacing: '-0.025em' },
    subtitle2: { fontWeight: 700 },
  },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { wordBreak: 'keep-all', overflowWrap: 'anywhere' } } },
    MuiButtonBase: { styleOverrides: { root: { fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' } } },
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: {
      borderRadius: 12, paddingInline: 16, minHeight: 44,
      transition: 'transform 220ms cubic-bezier(.2,.8,.2,1), background-color 180ms, border-color 180ms, box-shadow 180ms',
      '&:active': { transform: 'scale(.96)' },
      '&.Mui-focusVisible': { outline: '2px solid var(--mui-palette-primary-main)', outlineOffset: 3 },
      '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:active': { transform: 'none' } },
    } } },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: 12 }, outlined: { borderColor: 'var(--mui-palette-divider)' } } },
    MuiCard: { defaultProps: { elevation: 0 }, styleOverrides: { root: { borderRadius: 18, border: '1px solid', borderColor: 'var(--mui-palette-divider)', boxShadow: 'none' } } },
    MuiCardActionArea: { styleOverrides: { root: { borderRadius: 'inherit', transition: 'transform 220ms cubic-bezier(.2,.8,.2,1)',
      '&:active': { transform: 'scale(.985)' }, '&.Mui-focusVisible': { outline: '2px solid var(--mui-palette-primary-main)', outlineOffset: -3 },
      '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:active': { transform: 'none' } } } } },
    MuiIconButton: { styleOverrides: { root: { minWidth: 44, minHeight: 44, transition: 'transform 220ms cubic-bezier(.2,.8,.2,1), background-color 180ms',
      '&:active': { transform: 'scale(.9)' }, '&.Mui-focusVisible': { outline: '2px solid var(--mui-palette-primary-main)', outlineOffset: 2 },
      '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:active': { transform: 'none' } } } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 16 } } },
    MuiTextField: { defaultProps: { fullWidth: true } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 10 } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 8, fontWeight: 600 } } },
    MuiAvatar: { styleOverrides: { root: { fontWeight: 700 } } },
    MuiSkeleton: { defaultProps: { animation: false }, styleOverrides: { root: { borderRadius: 8 } } },
  },
})
