import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { theme } from './theme'
import App from './App.tsx'
import { LANGUAGE_KEY, LanguageChoice, setCurrentLanguage, type Language } from './language'

function Root() {
  const [language, setLanguageState] = useState<Language>(() => {
    try { return localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'ko' } catch { return 'ko' }
  })
  const setLanguage = (next: Language) => {
    setCurrentLanguage(next)
    try { localStorage.setItem(LANGUAGE_KEY, next) } catch { /* use for this session */ }
    setLanguageState(next)
  }
  useEffect(() => { document.documentElement.lang = language }, [language])
  useEffect(() => { document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#62519c') }, [])
  return (
    <LanguageChoice.Provider value={{ language, setLanguage }}>
      <ThemeProvider theme={theme} defaultMode="system">
        <CssBaseline enableColorScheme />
        <App />
      </ThemeProvider>
    </LanguageChoice.Provider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
