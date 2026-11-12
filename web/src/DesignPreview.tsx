import { useState } from 'react'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { LanguageChoice, setCurrentLanguage } from './language'
import { theme } from './theme'
import Home from './Home'

export default function DesignPreview() {
 const [language, updateLanguage] = useState<'ko' | 'en'>(() => new URLSearchParams(location.search).get('language') === 'en' ? 'en' : 'ko')
 return <LanguageChoice.Provider value={{ language, setLanguage: next => { setCurrentLanguage(next); updateLanguage(next) } }}><ThemeProvider theme={theme} defaultMode="light"><CssBaseline/><Home coupleId="preview" userId="preview-0" onLeft={() => {}}/></ThemeProvider></LanguageChoice.Provider>
}
