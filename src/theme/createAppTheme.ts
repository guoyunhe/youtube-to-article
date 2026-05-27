import { createTheme } from '@mui/material/styles'
import type { ResolvedTheme } from '../hooks/useThemePreference'

export function createAppTheme(resolvedTheme: ResolvedTheme) {
  return createTheme({
    palette: {
      
      mode: resolvedTheme,
    },
  })
}
