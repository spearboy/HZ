import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { makeTheme, THEMES, ThemeChoice, type ThemeId } from './theme'
import App from './App.tsx'

const KEY = 'theme'
const saved = (): ThemeId => {
  try {
    const v = localStorage.getItem(KEY)
    return THEMES.some((t) => t.id === v) ? (v as ThemeId) : 'blue'
  } catch { return 'blue' }
}

function Root() {
  const [id, setId] = useState(saved)
  const theme = useMemo(() => makeTheme(id), [id])
  const set = (next: ThemeId) => {
    setId(next)
    try { localStorage.setItem(KEY, next) } catch { /* 저장 못 해도 이번 세션엔 적용된다 */ }
  }
  // 모바일 브라우저 상단바 색
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEMES.find((t) => t.id === id)!.primary)
  }, [id])
  return (
    <ThemeChoice.Provider value={{ id, set }}>
      <ThemeProvider theme={theme} defaultMode="system">
        <CssBaseline enableColorScheme />
        <App />
      </ThemeProvider>
    </ThemeChoice.Provider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
