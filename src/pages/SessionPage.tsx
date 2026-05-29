import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { SessionArticleContent } from '../components/session/SessionArticleContent'
import { SessionCaptionsContent } from '../components/session/SessionCaptionsContent'
import { SessionSidebar } from '../components/session/SessionSidebar'
import { deleteSession, getSession, patchSession, summarizeSection } from '../lib/sessionStore'
import type { FetchCaptionsResponse, SessionRecord } from '../types'
import {
  GenerationRequestError,
  requestGeneration,
  type GenerationStage,
} from './session/sessionGeneration'
import {
  flattenSections,
  formatTimestamp,
  normalizePatchForUi,
  type ContentTab,
  type StageErrorMap,
} from './session/sessionUtils'

type SessionPatch = Partial<Omit<SessionRecord, 'id' | 'createdAt' | 'updatedAt'>>

export function SessionPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()

  const [session, setSession] = useState<SessionRecord | null>(null)
  const [activeContentTab, setActiveContentTab] = useState<ContentTab>('article')
  const [loadError, setLoadError] = useState('')
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null)
  const [generationStage, setGenerationStage] = useState<GenerationStage>('fetchingSubs')
  const [stageErrors, setStageErrors] = useState<StageErrorMap>({})
  const [summarizingSectionId, setSummarizingSectionId] = useState<string | null>(null)
  const [summarizeError, setSummarizeError] = useState('')
  const [nowMs, setNowMs] = useState<number>(() => Date.now())

  const lastFetchedSubs = useRef<FetchCaptionsResponse | null>(null)
  const autostarted = useRef(false)

  useEffect(() => {
    if (session?.status !== 'generating') {
      return
    }

    const interval = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [session?.status])

  useEffect(() => {
    if (!sessionId) {
      return
    }

    void getSession(sessionId).then((storedSession) => {
      if (!storedSession) {
        setLoadError(t('session.notFound'))
        return
      }

      if (storedSession.transcript) {
        lastFetchedSubs.current = {
          transcript: storedSession.transcript,
          transcriptPreview: storedSession.transcriptPreview ?? storedSession.transcript,
          captions: storedSession.captions ?? [],
          videoId: storedSession.videoId ?? '',
        }
      }

      setSession(storedSession)
    })
  }, [sessionId, t])

  const persistSessionPatch = useCallback(async (id: string, patch: SessionPatch) => {
    const optimisticPatch = normalizePatchForUi(patch)

    setSession((previous) => {
      if (!previous || previous.id !== id) {
        return previous
      }

      return {
        ...previous,
        ...optimisticPatch,
        updatedAt: new Date().toISOString(),
      }
    })

    const persisted = await patchSession(id, patch)
    setSession(persisted)
    return persisted
  }, [])

  const generate = useCallback(
    async (currentSession: SessionRecord, startFromStage: GenerationStage = 'fetchingSubs') => {
      let activeStage: GenerationStage = startFromStage
      const canResumeGenerate =
        startFromStage === 'generatingArticle' && Boolean(lastFetchedSubs.current)
      const effectiveStartStage: GenerationStage = canResumeGenerate
        ? 'generatingArticle'
        : 'fetchingSubs'

      setGenerationStartedAt(Date.now())
      setGenerationStage(effectiveStartStage)
      setStageErrors({})

      if (effectiveStartStage === 'fetchingSubs') {
        lastFetchedSubs.current = null
      }

      let generatingSession: SessionRecord = {
        ...currentSession,
        status: 'generating',
        article: '',
        title: undefined,
        error: undefined,
        updatedAt: new Date().toISOString(),
      }

      generatingSession = await persistSessionPatch(generatingSession.id, {
        status: 'generating',
        article: '',
        title: undefined,
        error: undefined,
      })

      try {
        const result = await requestGeneration(
          generatingSession,
          (stage) => {
            activeStage = stage
            setGenerationStage(stage)
          },
          async (subs) => {
            lastFetchedSubs.current = subs
            await persistSessionPatch(generatingSession.id, {
              transcript: subs.transcript,
              transcriptPreview: subs.transcriptPreview,
              captions: subs.captions,
              videoId: subs.videoId,
            })
          },
          (article) => {
            setSession((previous) => {
              if (!previous || previous.id !== generatingSession.id) {
                return previous
              }

              return {
                ...previous,
                article,
                updatedAt: new Date().toISOString(),
              }
            })
          },
          effectiveStartStage,
          lastFetchedSubs.current,
        )

        await persistSessionPatch(generatingSession.id, {
          status: 'completed',
          article: result.article,
          title: result.title,
          transcript: lastFetchedSubs.current?.transcript,
          transcriptPreview: result.transcriptPreview,
          captions: lastFetchedSubs.current?.captions,
          videoId: result.videoId,
        })
        setStageErrors({})
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to generate article.'
        const failedStage = error instanceof GenerationRequestError ? error.stage : activeStage

        setGenerationStage(failedStage)
        setStageErrors({ [failedStage]: message })

        await persistSessionPatch(generatingSession.id, {
          status: 'failed',
          error: message,
        })
      } finally {
        setGenerationStartedAt(null)
      }
    },
    [persistSessionPatch],
  )

  useEffect(() => {
    if (!session || autostarted.current) {
      return
    }

    if (session.status === 'queued') {
      autostarted.current = true
      const timeout = window.setTimeout(() => {
        void generate(session)
      }, 0)

      return () => window.clearTimeout(timeout)
    }
  }, [generate, session])

  const handleDeleteSession = useCallback(async () => {
    if (!sessionId) {
      return
    }

    const shouldDelete = window.confirm(t('messages.confirmDeleteSession'))
    if (!shouldDelete) {
      return
    }

    await deleteSession(sessionId)
    navigate('/')
  }, [navigate, sessionId, t])

  const handleSummarizeSection = useCallback(
    async (sectionId: string) => {
      if (!session) {
        return
      }

      setSummarizeError('')
      setSummarizingSectionId(sectionId)

      try {
        const updated = await summarizeSection(session.id, sectionId)
        setSession(updated)
      } catch (error) {
        setSummarizeError(error instanceof Error ? error.message : t('session.summarizeFailed'))
      } finally {
        setSummarizingSectionId(null)
      }
    },
    [session, t],
  )

  const handleContentTabChange = useCallback(
    (_event: React.SyntheticEvent, value: ContentTab) => {
      setActiveContentTab(value)
    },
    [],
  )

  const flattenedSections = useMemo(() => flattenSections(session?.sections ?? []), [session?.sections])

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.resolvedLanguage ?? i18n.language),
    [i18n.language, i18n.resolvedLanguage],
  )

  const receivedChars = session?.status === 'generating' ? (session.article?.length ?? 0) : 0
  const elapsedSeconds =
    session?.status === 'generating' && generationStartedAt
      ? Math.max(1, (nowMs - generationStartedAt) / 1000)
      : 0
  const charsPerSecond = elapsedSeconds > 0 ? receivedChars / elapsedSeconds : 0

  const captionSegments = session?.captions ?? []
  const lastCaption = captionSegments.at(-1)
  const captionDurationMs = lastCaption ? lastCaption.startMs + lastCaption.durationMs : 0

  if (!sessionId) {
    return (
      <Paper
        elevation={0}
        sx={{
          backgroundColor: 'error.light',
          borderColor: 'error.main',
          color: 'error.contrastText',
          p: 3,
        }}
      >
        <Typography>{t('session.notFound')}</Typography>
      </Paper>
    )
  }

  if (loadError) {
    return (
      <Paper
        elevation={0}
        sx={{
          backgroundColor: 'error.light',
          borderColor: 'error.main',
          color: 'error.contrastText',
          p: 3,
        }}
      >
        <Typography>{loadError}</Typography>
      </Paper>
    )
  }

  if (!session) {
    return (
      <Paper
        elevation={0}
        sx={{
          alignItems: 'center',
          backgroundColor: 'background.paper',
          borderColor: 'divider',
          display: 'flex',
          gap: 1.5,
          p: 3,
        }}
      >
        <CircularProgress size={24} />
        <Typography>{t('session.generating')}</Typography>
      </Paper>
    )
  }

  const detailsLines = [
    `${t('options.taskType')}: ${t(`optionValues.${session.options.taskType}`)}`,
    `${t('options.outputStyle')}: ${t(`optionValues.${session.options.outputStyle}`)}`,
    `${t('options.targetReaders')}: ${t(`optionValues.${session.options.targetReaders}`)}`,
    `${t('options.outputLanguage')}: ${t(
      session.options.outputLanguage === 'zh' ? 'optionValues.chinese' : 'optionValues.english',
    )}`,
  ]

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 3,
        gridTemplateColumns: { lg: 'minmax(18rem, 24rem) minmax(0, 1fr)', xs: '1fr' },
      }}
    >
      <SessionSidebar
        session={session}
        generationStage={generationStage}
        stageErrors={stageErrors}
        statusText={t(`statuses.${session.status}`)}
        detailsLines={detailsLines}
        statusLabel={t('session.status')}
        detailsLabel={t('session.details')}
        errorPrefix={t('session.errorPrefix')}
        fetchSubsLabel={t('session.stepFetchSubs')}
        generateArticleLabel={t('session.stepGenerateArticle')}
        stageInProgressLabel={t('session.stageInProgress')}
        stageCompletedLabel={t('session.stageCompleted')}
        stagePendingLabel={t('session.stagePending')}
        streamingProgressText={t('session.streamingProgress') + ': ' +
          t('session.receivedChars', { count: numberFormatter.format(receivedChars) })}
        generationSpeedText={t('session.generationSpeed', {
          speed: numberFormatter.format(Number(charsPerSecond.toFixed(1))),
        })}
        retryLabel={t('actions.retry')}
        deleteLabel={t('actions.deleteSession')}
        onRetry={() =>
          void generate(session, stageErrors.generatingArticle ? 'generatingArticle' : 'fetchingSubs')
        }
        onDelete={() => void handleDeleteSession()}
      />

      <Box>
        <Paper
          elevation={0}
          sx={{
            p: 3,
          }}
        >
          <Tabs value={activeContentTab} onChange={handleContentTabChange} sx={{ mb: 2 }}>
            <Tab value="captions" label={t('session.tabCaptions')} />
            <Tab value="article" label={t('session.tabArticle')} />
          </Tabs>

          {activeContentTab === 'article' ? (
            <SessionArticleContent
              session={session}
              summarizeError={summarizeError}
              summarizingSectionId={summarizingSectionId}
              flattenedSections={flattenedSections}
              titleFallback={t('session.article')}
              articleFallback={t('session.articleEmpty')}
              summarizeHeadingLabel={t('actions.summarizeHeading')}
              summarizingHeadingLabel={t('actions.summarizingHeading')}
              onSummarizeSection={(sectionId) => void handleSummarizeSection(sectionId)}
            />
          ) : (
            <SessionCaptionsContent
              captionSegments={captionSegments}
              transcriptPreview={session.transcriptPreview}
              videoId={session.videoId}
              sectionTitle={t('session.tabCaptions')}
              segmentCountLabel={t('session.captionSegmentCount', {
                count: numberFormatter.format(captionSegments.length),
              })}
              durationLabel={t('session.captionDuration', {
                duration: formatTimestamp(captionDurationMs),
              })}
              jumpToVideoLabel={t('session.jumpToVideo')}
              fallbackLabel={t('session.captionFallback')}
              emptyLabel={t('session.captionEmpty')}
            />
          )}
        </Paper>
      </Box>
    </Box>
  )
}
