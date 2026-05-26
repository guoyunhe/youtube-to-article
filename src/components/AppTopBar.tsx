import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import SettingsBrightnessOutlinedIcon from '@mui/icons-material/SettingsBrightnessOutlined'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { normalizeLanguage } from '../lib/language'

type ThemePreference = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

const LANGUAGE_OPTIONS = [
  { label: 'EN', value: 'en' },
  { label: '中文', value: 'zh' },
] as const

export function AppTopBar({
  themePreference,
  resolvedTheme,
  onThemePreferenceChange,
}: {
  themePreference: ThemePreference
  resolvedTheme: ResolvedTheme
  onThemePreferenceChange: (theme: ThemePreference) => void
}) {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const currentLanguage = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language)
  const [themeMenuAnchorEl, setThemeMenuAnchorEl] = useState<HTMLElement | null>(null)
  const [languageMenuAnchorEl, setLanguageMenuAnchorEl] = useState<HTMLElement | null>(null)

  const themeIcon =
    themePreference === 'system' ? (
      <SettingsBrightnessOutlinedIcon fontSize="small" />
    ) : resolvedTheme === 'dark' ? (
      <DarkModeOutlinedIcon fontSize="small" />
    ) : (
      <LightModeOutlinedIcon fontSize="small" />
    )

  return (
    <AppBar
      elevation={0}
      position="sticky"
      sx={{
        backdropFilter: 'blur(18px)',
        backgroundColor: 'color-mix(in srgb, var(--color-card-soft) 78%, transparent)',
        borderBottom: '1px solid var(--color-border)',
        color: 'var(--color-text)',
      }}
    >
      <Toolbar
        sx={{
          alignItems: { sm: 'center' },
          display: 'flex',
          flexDirection: { sm: 'row', xs: 'column' },
          gap: 2,
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component={Link}
            sx={{
              color: 'inherit',
              fontSize: '1.5rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              textDecoration: 'none',
            }}
            to="/"
          >
            {t('appName')}
          </Typography>
          <Typography sx={{ color: 'var(--color-text-muted)', fontSize: 14, mt: 0.25 }}>
            {t('tagline')}
          </Typography>
        </Box>

        <Box sx={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          {location.pathname !== '/' ? (
            <Button
              sx={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
                textTransform: 'none',
              }}
              variant="outlined"
              onClick={() => navigate('/')}
            >
              {t('actions.backHome')}
            </Button>
          ) : null}

          <Button
            aria-haspopup="menu"
            aria-expanded={themeMenuAnchorEl ? 'true' : undefined}
            endIcon={<ArrowDropDownIcon />}
            startIcon={themeIcon}
            sx={{ color: 'var(--color-text)', textTransform: 'none' }}
            variant="outlined"
            onClick={(event) => setThemeMenuAnchorEl(event.currentTarget)}
          >
            {t(`theme.${themePreference}`)}
          </Button>
          <Menu
            anchorEl={themeMenuAnchorEl}
            open={Boolean(themeMenuAnchorEl)}
            onClose={() => setThemeMenuAnchorEl(null)}
            slotProps={{
              paper: {
                sx: {
                  backdropFilter: 'blur(20px)',
                  backgroundColor: 'color-mix(in srgb, var(--color-card) 82%, transparent)',
                  border: '1px solid var(--color-border)',
                },
              },
            }}
          >
            {(['light', 'dark', 'system'] as ThemePreference[]).map((theme) => (
              <MenuItem
                key={theme}
                selected={themePreference === theme}
                onClick={() => {
                  onThemePreferenceChange(theme)
                  setThemeMenuAnchorEl(null)
                }}
              >
                {t(`theme.${theme}`)}
              </MenuItem>
            ))}
          </Menu>

          <Button
            aria-haspopup="menu"
            aria-expanded={languageMenuAnchorEl ? 'true' : undefined}
            endIcon={<ArrowDropDownIcon />}
            sx={{ color: 'var(--color-text)', textTransform: 'none' }}
            variant="outlined"
            onClick={(event) => setLanguageMenuAnchorEl(event.currentTarget)}
          >
            {LANGUAGE_OPTIONS.find((option) => option.value === currentLanguage)?.label ?? 'EN'}
          </Button>
          <Menu
            anchorEl={languageMenuAnchorEl}
            open={Boolean(languageMenuAnchorEl)}
            onClose={() => setLanguageMenuAnchorEl(null)}
            slotProps={{
              paper: {
                sx: {
                  backdropFilter: 'blur(20px)',
                  backgroundColor: 'color-mix(in srgb, var(--color-card) 82%, transparent)',
                  border: '1px solid var(--color-border)',
                },
              },
            }}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <MenuItem
                key={option.value}
                selected={currentLanguage === option.value}
                onClick={() => {
                  void i18n.changeLanguage(option.value)
                  setLanguageMenuAnchorEl(null)
                }}
              >
                {option.label}
              </MenuItem>
            ))}
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  )
}