import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LanguageMenuButton } from './LanguageMenuButton'
import { ThemeMenuButton } from './ThemeMenuButton'
import type { ResolvedTheme, ThemePreference } from '../hooks/useThemePreference'

export function AppTopBar({
  themePreference,
  resolvedTheme,
  onThemePreferenceChange,
}: {
  themePreference: ThemePreference
  resolvedTheme: ResolvedTheme
  onThemePreferenceChange: (theme: ThemePreference) => void
}) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <AppBar
      position="sticky"
      color="inherit"
      sx={{
        backdropFilter: 'blur(18px)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <Toolbar sx={{ }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component={Link}
            sx={{
              fontSize: '1.2rem',
              fontWeight: 700,
            }}
            to="/"
          >
            {t('appName')}
          </Typography>
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        <Box sx={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          {location.pathname !== '/' ? (
            <Button
              variant="text"
              color="inherit"
              onClick={() => navigate('/')}
            >
              {t('actions.backHome')}
            </Button>
          ) : null}
          <ThemeMenuButton
            resolvedTheme={resolvedTheme}
            themePreference={themePreference}
            onThemePreferenceChange={onThemePreferenceChange}
          />
          <LanguageMenuButton />
        </Box>
      </Toolbar>
    </AppBar>
  )
}