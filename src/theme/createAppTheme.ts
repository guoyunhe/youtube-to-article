import { createTheme } from '@mui/material/styles'
import type { ResolvedTheme } from '../hooks/useThemePreference'

export function createAppTheme(resolvedTheme: ResolvedTheme) {
  return createTheme({
    palette: {
      background: {
        default: resolvedTheme === 'dark' ? '#020617' : '#f4f7fb',
        paper: resolvedTheme === 'dark' ? '#0f172a' : '#ffffff',
      },
      mode: resolvedTheme,
      text: {
        primary: resolvedTheme === 'dark' ? '#f8fafc' : '#0f172a',
        secondary: resolvedTheme === 'dark' ? '#cbd5e1' : '#334155',
      },
    },
    typography: {
      fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    },
  })
}
