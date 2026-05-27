import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { SessionList } from '../components/SessionList'
import { defaultOptions } from '../lib/defaults'
import {
  getInitialOutputLanguage,
  normalizeLanguage,
  persistOutputLanguage,
} from '../lib/language'
import { deleteSession, listSessions, saveSession } from '../lib/sessionStore'
import { extractVideoId } from '../lib/youtube'
import type { GenerationOptions, SessionRecord } from '../types'

function OptionSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <TextField
      fullWidth
      label={label}
      select
      SelectProps={{ native: true }}
      size="small"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </TextField>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const detectedLanguage = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [error, setError] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [recentSessions, setRecentSessions] = useState<SessionRecord[]>([])
  const [options, setOptions] = useState<GenerationOptions>({
    ...defaultOptions,
    outputLanguage: getInitialOutputLanguage(detectedLanguage),
  })

  useEffect(() => {
    void listSessions().then(setRecentSessions)
  }, [])

  const taskTypeOptions = useMemo(
    () => [
      { value: 'summary', label: t('optionValues.summary') },
      { value: 'tutorial', label: t('optionValues.tutorial') },
      { value: 'newsletter', label: t('optionValues.newsletter') },
    ],
    [t],
  )
  const outputStyleOptions = useMemo(
    () => [
      { value: 'professional', label: t('optionValues.professional') },
      { value: 'engaging', label: t('optionValues.engaging') },
      { value: 'concise', label: t('optionValues.concise') },
    ],
    [t],
  )
  const targetReadersOptions = useMemo(
    () => [
      { value: 'beginners', label: t('optionValues.beginners') },
      { value: 'practitioners', label: t('optionValues.practitioners') },
      { value: 'executives', label: t('optionValues.executives') },
    ],
    [t],
  )
  const outputLanguageOptions = useMemo(
    () => [
      { value: 'en', label: t('optionValues.english') },
      { value: 'zh', label: t('optionValues.chinese') },
    ],
    [t],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const videoId = extractVideoId(youtubeUrl)

    if (!videoId) {
      setError(t('validation.invalidYoutubeUrl'))
      return
    }

    const now = new Date().toISOString()
    const session: SessionRecord = {
      id: crypto.randomUUID(),
      youtubeUrl: youtubeUrl.trim(),
      videoId,
      createdAt: now,
      updatedAt: now,
      options,
      status: 'queued',
    }

    await saveSession(session)
    setRecentSessions(await listSessions())
    navigate(`/session/${session.id}`)
  }

  async function handleDeleteSession(sessionId: string) {
    const shouldDelete = window.confirm(t('messages.confirmDeleteSession'))
    if (!shouldDelete) {
      return
    }

    await deleteSession(sessionId)
    setRecentSessions(await listSessions())
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 3,
        gridTemplateColumns: { lg: 'minmax(0, 2fr) minmax(18rem, 1fr)', xs: '1fr' },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 3,
          boxShadow: 1,
        }}
      >
        <Box sx={{ mb: 4, maxWidth: '48rem' }}>
          <Typography
            sx={(theme) => ({
              backgroundColor: theme.palette.info.light,
              border: `1px solid ${theme.palette.info.main}`,
              borderRadius: 999,
              color: theme.palette.info.contrastText,
              display: 'inline-flex',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.2em',
              mb: 1.5,
              px: 1.5,
              py: 0.5,
              textTransform: 'uppercase',
            })}
          >
            AI Article Generation
          </Typography>
          <Typography sx={{ fontSize: { sm: 38, xs: 30 }, fontWeight: 600, letterSpacing: '-0.02em' }}>
            {t('home.headline')}
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 16, mt: 1.5 }}>
            {t('home.subheadline')}
          </Typography>
        </Box>

        <Box component="form" sx={{ display: 'grid', gap: 2.5 }} onSubmit={(event) => void handleSubmit(event)}>
          <TextField
            fullWidth
            label={t('home.urlLabel')}
            placeholder={t('home.urlPlaceholder')}
            sx={{ '& .MuiInputBase-input': { fontSize: 16, py: 1.9 } }}
            value={youtubeUrl}
            onChange={(event) => {
              setYoutubeUrl(event.target.value)
              setError('')
            }}
          />

          <Stack direction={{ sm: 'row', xs: 'column' }} spacing={1.5}>
            <Button
              sx={{ px: 2.5, py: 1.1 }}
              type="submit"
              variant="contained"
            >
              {t('actions.aiGenerate')}
            </Button>
            <Button
              sx={{ px: 2.5, py: 1.1 }}
              type="button"
              variant="outlined"
              onClick={() => setAdvancedOpen((current) => !current)}
            >
              {t('actions.advancedOptions')}
            </Button>
          </Stack>

          {error ? (
            <Typography
              sx={(theme) => ({
                backgroundColor: theme.palette.error.light,
                border: `1px solid ${theme.palette.error.main}`,
                color: theme.palette.error.contrastText,
                fontSize: 14,
                px: 2,
                py: 1.5,
              })}
            >
              {error}
            </Typography>
          ) : null}

          {advancedOpen ? (
            <Box
              sx={{
                backgroundColor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { sm: 'repeat(2, minmax(0, 1fr))', xs: '1fr' },
                p: 2,
              }}
            >
              <OptionSelect
                label={t('options.taskType')}
                options={taskTypeOptions}
                value={options.taskType}
                onChange={(taskType) => setOptions((current) => ({ ...current, taskType }))}
              />
              <OptionSelect
                label={t('options.outputStyle')}
                options={outputStyleOptions}
                value={options.outputStyle}
                onChange={(outputStyle) => setOptions((current) => ({ ...current, outputStyle }))}
              />
              <OptionSelect
                label={t('options.targetReaders')}
                options={targetReadersOptions}
                value={options.targetReaders}
                onChange={(targetReaders) => setOptions((current) => ({ ...current, targetReaders }))}
              />
              <OptionSelect
                label={t('options.outputLanguage')}
                options={outputLanguageOptions}
                value={options.outputLanguage}
                onChange={(outputLanguage) =>
                  setOptions((current) => {
                    const nextOutputLanguage = outputLanguage as GenerationOptions['outputLanguage']
                    persistOutputLanguage(nextOutputLanguage)

                    return {
                      ...current,
                      outputLanguage: nextOutputLanguage,
                    }
                  })
                }
              />
            </Box>
          ) : null}
        </Box>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: 3,
        }}
      >
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 600 }}>{t('home.recentSessions')}</Typography>
        </Box>

        <SessionList
          deleteLabel={t('actions.deleteSession')}
          emptyText={t('home.noSessions')}
          getStatusLabel={(status) => t(`statuses.${status}`)}
          sessions={recentSessions}
          onDelete={(sessionId) => void handleDeleteSession(sessionId)}
        />
      </Paper>
    </Box>
  )
}
