import { useEffect, useMemo, useState } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

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

export function useThemePreference() {
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

  return {
    resolvedTheme,
    themePreference,
    setThemePreference,
  }
}
