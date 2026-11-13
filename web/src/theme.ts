import { createTheme } from '@mui/material/styles'

// MORO 로고의 라벤더와 블루를 중심으로 한 단일 팔레트.
export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data' },
  colorSchemes: {
    light: { palette: { primary: { main: '#66549a', contrastText: '#ffffff' }, secondary: { main: '#6478bb' },
      background: { default: '#f2f2f7', paper: '#ffffff' }, text: { primary: '#1c1c1e', secondary: '#6c6c70' }, divider: '#e5e5ea' } },
    dark: { palette: { primary: { main: '#c4b3ed', contrastText: '#211a33' }, secondary: { main: '#b4c4fa' },
      background: { default: '#000000', paper: '#1c1c1e' }, text: { primary: '#f5f5f7', secondary: '#aeaeb2' }, divider: '#38383a' } },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard Variable', Pretendard, system-ui, sans-serif",
    fontSize: 14,
    allVariants: { fontVariantNumeric: 'tabular-nums' },
    body1: { fontSize: 15, lineHeight: 1.6 },
    body2: { fontSize: 14, lineHeight: 1.5 },
    button: { textTransform: 'none', fontWeight: 600 },
    h5: { fontWeight: 700, letterSpacing: '-0.035em' },
    h6: { fontWeight: 700, letterSpacing: '-0.025em' },
    subtitle2: { fontWeight: 700 },
  },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { wordBreak: 'keep-all', overflowWrap: 'anywhere' } } },
    MuiButtonBase: { styleOverrides: { root: { fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' } } },
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: {
      borderRadius: 10, paddingInline: 16, minHeight: 44,
      transition: 'transform 220ms cubic-bezier(.2,.8,.2,1), background-color 180ms, border-color 180ms, box-shadow 180ms',
      '&:active': { transform: 'scale(.96)' },
      '&.Mui-focusVisible': { outline: '2px solid var(--mui-palette-primary-main)', outlineOffset: 3 },
      '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:active': { transform: 'none' } },
    } } },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: 12 }, outlined: { borderColor: 'var(--mui-palette-divider)' } } },
    MuiCard: { defaultProps: { elevation: 0 }, styleOverrides: { root: { borderRadius: 14, border: 0, boxShadow: 'none', backgroundImage: 'none' } } },
    MuiCardActionArea: { styleOverrides: { root: { borderRadius: 'inherit', transition: 'transform 220ms cubic-bezier(.2,.8,.2,1)',
      '&:active': { transform: 'scale(.985)' }, '&.Mui-focusVisible': { outline: '2px solid var(--mui-palette-primary-main)', outlineOffset: -3 },
      '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:active': { transform: 'none' } } } } },
    MuiIconButton: { styleOverrides: { root: { minWidth: 44, minHeight: 44, transition: 'transform 220ms cubic-bezier(.2,.8,.2,1), background-color 180ms',
      '&:active': { transform: 'scale(.9)' }, '&.Mui-focusVisible': { outline: '2px solid var(--mui-palette-primary-main)', outlineOffset: 2 },
      '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:active': { transform: 'none' } } } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 14, backgroundImage: 'none' } } },
    MuiTextField: { defaultProps: { fullWidth: true } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 10 } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 8, fontWeight: 600 } } },
    MuiAvatar: { styleOverrides: { root: { fontWeight: 700 } } },
    MuiSkeleton: { defaultProps: { animation: false }, styleOverrides: { root: { borderRadius: 8 } } },
  },
})
