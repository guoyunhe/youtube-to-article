import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { normalizeLanguage } from '../lib/language'

const LANGUAGE_OPTIONS = [
  { label: 'English', value: 'en' },
  { label: '中文', value: 'zh' },
] as const

export function LanguageMenuButton() {
  const { i18n } = useTranslation()
  const currentLanguage = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language)
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  return (
    <>
      <Button
        aria-haspopup="menu"
        aria-expanded={anchorEl ? 'true' : undefined}
        endIcon={<ArrowDropDownIcon />}
        variant="text"
        color="inherit"
        onClick={(event) => setAnchorEl(event.currentTarget)}
      >
        {LANGUAGE_OPTIONS.find((option) => option.value === currentLanguage)?.label ?? 'EN'}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <MenuItem
            key={option.value}
            selected={currentLanguage === option.value}
            onClick={() => {
              void i18n.changeLanguage(option.value)
              setAnchorEl(null)
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
