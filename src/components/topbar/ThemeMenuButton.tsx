import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import SettingsBrightnessOutlinedIcon from '@mui/icons-material/SettingsBrightnessOutlined'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ResolvedTheme, ThemePreference } from '../../hooks/useThemePreference'

export function ThemeMenuButton({
  themePreference,
  resolvedTheme,
  onThemePreferenceChange,
}: {
  themePreference: ThemePreference
  resolvedTheme: ResolvedTheme
  onThemePreferenceChange: (theme: ThemePreference) => void
}) {
  const { t } = useTranslation()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const themeIcon =
    themePreference === 'system' ? (
      <SettingsBrightnessOutlinedIcon fontSize="small" />
    ) : resolvedTheme === 'dark' ? (
      <DarkModeOutlinedIcon fontSize="small" />
    ) : (
      <LightModeOutlinedIcon fontSize="small" />
    )

  return (
    <>
      <Button
        aria-haspopup="menu"
        aria-expanded={anchorEl ? 'true' : undefined}
        endIcon={<ArrowDropDownIcon />}
        startIcon={themeIcon}
        variant="text"
        color="inherit"
        onClick={(event) => setAnchorEl(event.currentTarget)}
      >
        {t(`theme.${themePreference}`)}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {(['light', 'dark', 'system'] as ThemePreference[]).map((theme) => (
          <MenuItem
            key={theme}
            selected={themePreference === theme}
            onClick={() => {
              onThemePreferenceChange(theme)
              setAnchorEl(null)
            }}
          >
            {t(`theme.${theme}`)}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
