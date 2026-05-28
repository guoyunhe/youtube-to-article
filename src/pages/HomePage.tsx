import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { SessionList } from '../components/SessionList'
import { UrlInputSection } from '../components/UrlInputSection'
import { defaultOptions } from '../lib/defaults'
import { normalizeLanguage } from '../lib/language'
import { createSession, deleteSession, listSessions } from '../lib/sessionStore'
import { extractVideoId, isValidYouTubeUrl } from '../lib/youtube'
import type { GenerationOptions, SessionRecord } from '../types'

export function HomePage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const detectedLanguage = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [youtubeUrlTouched, setYoutubeUrlTouched] = useState(false)
  const [recentSessions, setRecentSessions] = useState<SessionRecord[]>([])
  const [options, setOptions] = useState<GenerationOptions>({
    ...defaultOptions,
    outputLanguage: detectedLanguage,
  })
  const youtubeUrlError =
    youtubeUrlTouched && youtubeUrl.trim() && !isValidYouTubeUrl(youtubeUrl)
      ? t('validation.invalidYoutubeUrl')
      : ''

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
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setYoutubeUrlTouched(true)

    if (!isValidYouTubeUrl(youtubeUrl)) {
      return
    }

    const videoId = extractVideoId(youtubeUrl)

    if (!videoId) {
      return
    }

    const session = await createSession({
      youtubeUrl: youtubeUrl.trim(),
      videoId,
      options: {
        ...options,
        outputLanguage: detectedLanguage,
      },
      status: 'queued',
    })

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
          <UrlInputSection
            generateLabel={t('actions.aiGenerate')}
            options={options}
            outputStyleLabel={t('options.outputStyle')}
            outputStyleOptions={outputStyleOptions}
            targetReadersLabel={t('options.targetReaders')}
            targetReadersOptions={targetReadersOptions}
            taskTypeLabel={t('options.taskType')}
            taskTypeOptions={taskTypeOptions}
            customPromptLabel={t('options.customPrompt')}
            customPromptPlaceholder={t('home.customPromptPlaceholder')}
            urlLabel={t('home.urlLabel')}
            urlPlaceholder={t('home.urlPlaceholder')}
            youtubeUrl={youtubeUrl}
            youtubeUrlError={youtubeUrlError}
            onCustomPromptChange={(customPrompt) => setOptions((current) => ({ ...current, customPrompt }))}
            onOutputStyleChange={(outputStyle) => setOptions((current) => ({ ...current, outputStyle }))}
            onTargetReadersChange={(targetReaders) => setOptions((current) => ({ ...current, targetReaders }))}
            onTaskTypeChange={(taskType) => setOptions((current) => ({ ...current, taskType }))}
            onYoutubeUrlBlur={() => setYoutubeUrlTouched(true)}
            onYoutubeUrlChange={(value) => {
              setYoutubeUrl(value)
            }}
          />
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
