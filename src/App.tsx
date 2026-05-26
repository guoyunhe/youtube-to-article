import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CssBaseline from '@mui/material/CssBaseline'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import SettingsBrightnessOutlinedIcon from '@mui/icons-material/SettingsBrightnessOutlined'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { SessionPage } from './pages/SessionPage'
import { normalizeLanguage } from './lib/language'

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

function getNextThemePreference(current: ThemePreference): ThemePreference {
  if (current === 'system') {
    return 'light'
  }

  if (current === 'light') {
    return 'dark'
  }

  return 'system'
}

function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const currentLanguage = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language)

  return (
    <Tabs
      aria-label="Language options"
      sx={{
        minHeight: 36,
        '& .MuiTabs-indicator': { backgroundColor: 'var(--color-border-strong)' },
      }}
      textColor="inherit"
      value={currentLanguage}
      onChange={(_event, value: string) => void i18n.changeLanguage(value)}
    >
      <Tab
        label="EN"
        sx={{ minHeight: 36, minWidth: 52, px: 1.5, color: 'var(--color-text-subtle)' }}
        value="en"
      />
      <Tab
        label="中文"
        sx={{ minHeight: 36, minWidth: 52, px: 1.5, color: 'var(--color-text-subtle)' }}
        value="zh"
      />
    </Tabs>
  )
}

function ThemeSwitcher({
  themePreference,
  resolvedTheme,
  onChange,
}: {
  themePreference: ThemePreference
  resolvedTheme: ResolvedTheme
  onChange: (theme: ThemePreference) => void
}) {
  const { t } = useTranslation()
  const nextTheme = getNextThemePreference(themePreference)

  const icon =
    themePreference === 'system' ? (
      <SettingsBrightnessOutlinedIcon fontSize="small" />
    ) : resolvedTheme === 'dark' ? (
      <DarkModeOutlinedIcon fontSize="small" />
    ) : (
      <LightModeOutlinedIcon fontSize="small" />
    )

  return (
    <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
      <IconButton
        aria-label={t('theme.toggleHint', { theme: t(`theme.${nextTheme}`) })}
        size="small"
        sx={{
          border: '1px solid var(--color-border)',
          borderRadius: 1.5,
          color: 'var(--color-text)',
          p: 0.75,
        }}
        onClick={() => onChange(nextTheme)}
      >
        {icon}
      </IconButton>
      <Typography sx={{ color: 'var(--color-text-subtle)', fontSize: 12 }}>
        {t(`theme.${themePreference}`)}
      </Typography>
    </Box>
  )
}

function AppShell() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
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
      <Box sx={{ minHeight: '100vh', px: { lg: 8, sm: 6, xs: 4 }, py: 8 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, margin: '0 auto', maxWidth: 1152 }}>
          <Paper
            elevation={0}
            sx={{
              backdropFilter: 'blur(8px)',
              background: 'var(--color-card-soft)',
              border: '1px solid var(--color-border)',
              borderRadius: 3,
              p: 2,
            }}
          >
            <Box
              sx={{
                alignItems: { sm: 'center' },
                display: 'flex',
                flexDirection: { sm: 'row', xs: 'column' },
                gap: 2,
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography
                  component={Link}
                  sx={{
                    color: 'inherit',
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    textDecoration: 'none',
                  }}
                  to="/"
                >
                  {t('appName')}
                </Typography>
                <Typography sx={{ color: 'var(--color-text-muted)', fontSize: 14, mt: 0.5 }}>
                  {t('tagline')}
                </Typography>
              </Box>

              <Box sx={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                {location.pathname !== '/' ? (
                  <Button
                    sx={{
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                    variant="outlined"
                    onClick={() => navigate('/')}
                  >
                    {t('actions.backHome')}
                  </Button>
                ) : null}
                <ThemeSwitcher
                  resolvedTheme={resolvedTheme}
                  themePreference={themePreference}
                  onChange={setThemePreference}
                />
                <LanguageSwitcher />
              </Box>
            </Box>
          </Paper>

          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/session/:sessionId" element={<SessionPage />} />
          </Routes>
        </Box>
      </Box>
    </ThemeProvider>
  )
}

export default AppShell
