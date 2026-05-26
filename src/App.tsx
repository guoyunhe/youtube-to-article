import Box from '@mui/material/Box'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { useEffect, useMemo, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppTopBar } from './components/AppTopBar'
import { HomePage } from './pages/HomePage'
import { SessionPage } from './pages/SessionPage'

type ThemePreference = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'yta-theme-preference'

const theme = createTheme({
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  },
})

function getStoredThemePreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'system'
  }

  const value = window.localStorage.getItem(THEME_STORAGE_KEY)
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function AppShell() {
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    getStoredThemePreference(),
  )
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme())

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  const resolvedTheme = useMemo<ResolvedTheme>(
    () => (themePreference === 'system' ? systemTheme : themePreference),
    [systemTheme, themePreference],
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference)

    const root = document.documentElement
    root.dataset.theme = resolvedTheme
    root.style.colorScheme = resolvedTheme
  }, [resolvedTheme, themePreference])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh' }}>
        <AppTopBar
          resolvedTheme={resolvedTheme}
          themePreference={themePreference}
          onThemePreferenceChange={setThemePreference}
        />

        <Box sx={{ px: { lg: 8, sm: 6, xs: 4 }, py: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, margin: '0 auto', maxWidth: 1152 }}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/session/:sessionId" element={<SessionPage />} />
            </Routes>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  )
}

export default AppShell
