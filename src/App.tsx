import { Button, Card, Tabs } from '@heroui/react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { SessionPage } from './pages/SessionPage'
import { normalizeLanguage } from './lib/language'

type ThemePreference = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'yta-theme-preference'

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
      className="w-auto"
      selectedKey={currentLanguage}
      variant="primary"
      onSelectionChange={(key) => void i18n.changeLanguage(String(key))}
    >
      <Tabs.ListContainer>
        <Tabs.List aria-label="Language options">
          <Tabs.Tab id="en">EN</Tabs.Tab>
          <Tabs.Tab id="zh">中文</Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
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
      <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="3.5" y="4" width="17" height="12" rx="2" />
        <path d="M8 20h8" />
      </svg>
    ) : resolvedTheme === 'dark' ? (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.8Z" />
      </svg>
    ) : (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
      </svg>
    )

  return (
    <div className="flex items-center gap-2 text-sm">
      <Button
        className="min-w-0 px-2"
        size="sm"
        variant="outline"
        onPress={() => onChange(nextTheme)}
      >
        {icon}
        <span className="sr-only">{t('theme.toggleHint', { theme: t(`theme.${nextTheme}`) })}</span>
      </Button>
      <span className="app-text-subtle text-xs">{t(`theme.${themePreference}`)}</span>
    </div>
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
    <div className="app-shell min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Card className="app-card-soft p-4 backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link className="text-2xl font-semibold tracking-tight" to="/">
                {t('appName')}
              </Link>
              <p className="app-text-muted mt-1 text-sm">{t('tagline')}</p>
            </div>

            <div className="flex items-center gap-3">
              {location.pathname !== '/' ? (
                <Button variant="outline" onPress={() => navigate('/')}>
                  {t('actions.backHome')}
                </Button>
              ) : null}
              <ThemeSwitcher
                resolvedTheme={resolvedTheme}
                themePreference={themePreference}
                onChange={setThemePreference}
              />
              <LanguageSwitcher />
            </div>
          </div>
        </Card>

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/session/:sessionId" element={<SessionPage />} />
        </Routes>
      </div>
    </div>
  )
}

export default AppShell
