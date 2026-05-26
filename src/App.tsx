import Box from '@mui/material/Box'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { Route, Routes } from 'react-router-dom'
import { AppTopBar } from './components/AppTopBar'
import { useThemePreference } from './hooks/useThemePreference'
import { HomePage } from './pages/HomePage'
import { SessionPage } from './pages/SessionPage'

const theme = createTheme({
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  },
})

function AppShell() {
  const { resolvedTheme, setThemePreference, themePreference } = useThemePreference()

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
