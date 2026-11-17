import { useState } from 'react'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { LanguageChoice, setCurrentLanguage } from './language'
import { theme } from './theme'
import Home from './Home'
import SupportAdmin from './SupportAdmin'

export default function DesignPreview() {
 const [language, updateLanguage] = useState<'ko' | 'en'>(() => new URLSearchParams(location.search).get('language') === 'en' ? 'en' : 'ko')
 const previewId = new URLSearchParams(location.search).get('preview-id') || 'preview'
 return <LanguageChoice.Provider value={{ language, setLanguage: next => { setCurrentLanguage(next); updateLanguage(next) } }}><ThemeProvider theme={theme} defaultMode="light"><CssBaseline/>{new URLSearchParams(location.search).has('admin-preview') ? <SupportAdmin userId="preview-0" /> : <Home coupleId={previewId} userId="preview-0" onLeft={() => {}}/>}</ThemeProvider></LanguageChoice.Provider>
}
