import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Step from '@mui/material/Step'
import StepContent from '@mui/material/StepContent'
import StepLabel from '@mui/material/StepLabel'
import Stepper from '@mui/material/Stepper'
import Typography from '@mui/material/Typography'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { deleteSession, getSession, patchSession } from '../lib/sessionStore'
import type {
  FetchSubsResponse,
  GenerateArticleResponse,
  SessionRecord,
} from '../types'

type GenerateErrorPayload = {
  error?: string
  requestId?: string
  stage?: string
}

type GenerateArticleStreamEvent =
  | { type: 'delta'; chunk: string }
  | { type: 'done'; title: string }
  | { type: 'error'; error?: string }

type GenerationStage = 'fetchingSubs' | 'generatingArticle'
type StageErrorMap = Partial<Record<GenerationStage, string>>
type ContentTab = 'captions' | 'article'
type SessionPatch = Partial<Omit<SessionRecord, 'id' | 'createdAt' | 'updatedAt'>>

function normalizePatchForUi(patch: SessionPatch): SessionPatch {
  if (!patch.status || patch.status === 'failed') {
    return patch
  }

  return {
    ...patch,
    error: undefined,
  }
}

class GenerationRequestError extends Error {
  stage: GenerationStage

  constructor(stage: GenerationStage, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'GenerationRequestError'
    this.stage = stage
  }
}

function toPreview(text: string, max = 240): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  return compact.length <= max ? compact : `${compact.slice(0, max)}...`
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function buildYouTubeTimestampUrl(videoId: string, startMs: number): string {
  const seconds = Math.max(0, Math.floor(startMs / 1000))
  return `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`
}

async function parseApiResponse<T>(response: Response, endpoint: string): Promise<T> {
  const contentType = response.headers.get('content-type') ?? 'unknown'
  const requestId = response.headers.get('x-request-id') ?? 'n/a'
  const rawBody = await response.text()

  console.info(`[api] ${endpoint} response meta`, {
    status: response.status,
    contentType,
    requestId,
    bodyPreview: toPreview(rawBody),
  })

  if (!rawBody.trim()) {
    throw new Error(
      `${endpoint} returned an empty response body. status=${response.status}, content-type=${contentType}, request-id=${requestId}`,
    )
  }

  let payload: T & GenerateErrorPayload

  try {
    payload = JSON.parse(rawBody) as T & GenerateErrorPayload
  } catch (error) {
    const parseError = error instanceof Error ? error.message : 'Unknown JSON parse error.'
    throw new Error(`${endpoint} returned non-JSON or malformed JSON. status=${response.status}, content-type=${contentType}, request-id=${requestId}, parse-error=${parseError}, body-preview=${toPreview(rawBody)}`, {
      cause: error,
    })
  }

  if (!response.ok) {
    const stage = payload.stage ? `, stage=${payload.stage}` : ''
    const errorRequestId = payload.requestId ?? requestId
    throw new Error(
      `${payload.error ?? `Unable to process ${endpoint}.`} (status=${response.status}, request-id=${errorRequestId}${stage})`,
    )
  }

  return payload
}

async function postJson<T>(
  endpoint: '/api/fetchSubs',
  body: unknown,
): Promise<T> {
  console.info(`[api] request ${endpoint}`, body)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return parseApiResponse<T>(response, endpoint)
}

function parseStreamLine(line: string): GenerateArticleStreamEvent | null {
  if (!line.trim()) {
    return null
  }

  const payload = JSON.parse(line) as Partial<GenerateArticleStreamEvent>

  if (payload.type === 'delta' && typeof payload.chunk === 'string') {
    return {
      type: 'delta',
      chunk: payload.chunk,
    }
  }

  if (payload.type === 'done' && typeof payload.title === 'string') {
    return {
      type: 'done',
      title: payload.title,
    }
  }

  if (payload.type === 'error') {
    return {
      type: 'error',
      error: payload.error,
    }
  }

  return null
}

function deriveTitle(article: string): string {
  return article.split('\n')[0]?.replace(/^#+\s*/, '').trim() || 'Generated article'
}

async function requestGeneration(
  session: SessionRecord,
  onStageChange: (stage: GenerationStage) => void,
  onSubsFetched: (subs: FetchSubsResponse) => Promise<void>,
  onDelta: (article: string) => void,
  startFromStage: GenerationStage,
  cachedSubs: FetchSubsResponse | null,
): Promise<GenerateArticleResponse> {
  let subs: FetchSubsResponse

  if (startFromStage === 'generatingArticle' && cachedSubs) {
    subs = cachedSubs
  } else {
    onStageChange('fetchingSubs')

    try {
      subs = await postJson<FetchSubsResponse>('/api/fetchSubs', {
        youtubeUrl: session.youtubeUrl,
      })
      await onSubsFetched(subs)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to fetch captions.'
      throw new GenerationRequestError('fetchingSubs', message, { cause: error })
    }
  }

  onStageChange('generatingArticle')

  try {
    const response = await fetch('/api/generateArticle', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        transcript: subs.transcript,
        options: session.options,
      }),
    })

    if (!response.ok) {
      await parseApiResponse<GenerateErrorPayload>(response, '/api/generateArticle')
    }

    if (!response.body) {
      throw new Error('/api/generateArticle returned an empty response stream.')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let pending = ''
    let article = ''
    let title = ''

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        pending += decoder.decode(value, { stream: true })
        const lines = pending.split('\n')
        pending = lines.pop() ?? ''

        for (const line of lines) {
          const event = parseStreamLine(line)

          if (!event) {
            continue
          }

          if (event.type === 'delta') {
            article += event.chunk
            onDelta(article)
            continue
          }

          if (event.type === 'done') {
            title = event.title
            continue
          }

          if (event.type === 'error') {
            throw new Error(event.error ?? 'Unable to generate article.')
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    const finalArticle = article.trim()

    if (!finalArticle) {
      throw new Error('The AI returned an empty article.')
    }

    const finalTitle = title || deriveTitle(finalArticle)

    return {
      article: finalArticle,
      title: finalTitle,
      transcriptPreview: subs.transcriptPreview,
      videoId: subs.videoId,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate article.'
    throw new GenerationRequestError('generatingArticle', message, { cause: error })
  }
}

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
  const [nowMs, setNowMs] = useState<number>(() => Date.now())
  const lastFetchedSubs = useRef<FetchSubsResponse | null>(null)
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

  const receivedChars = session?.status === 'generating' ? (session.article?.length ?? 0) : 0
  const elapsedSeconds =
    session?.status === 'generating' && generationStartedAt
      ? Math.max(1, (nowMs - generationStartedAt) / 1000)
      : 0
  const charsPerSecond = elapsedSeconds > 0 ? receivedChars / elapsedSeconds : 0
  const captionSegments = session?.captions ?? []
  const lastCaption = captionSegments.at(-1)
  const captionDurationMs = lastCaption ? lastCaption.startMs + lastCaption.durationMs : 0
  const videoId = session?.videoId
  const numberFormatter = new Intl.NumberFormat(i18n.resolvedLanguage ?? i18n.language)
  const activeStep =
    session?.status === 'completed' ? 2 : generationStage === 'fetchingSubs' ? 0 : 1
  const isStageFlowVisible =
    session?.status === 'generating' || session?.status === 'failed' || session?.status === 'completed'

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

  async function persistSessionPatch(sessionId: string, patch: SessionPatch) {
    const optimisticPatch = normalizePatchForUi(patch)

    setSession((previous) => {
      if (!previous || previous.id !== sessionId) {
        return previous
      }

      return {
        ...previous,
        ...optimisticPatch,
        updatedAt: new Date().toISOString(),
      }
    })

    const persisted = await patchSession(sessionId, patch)
    setSession(persisted)
    return persisted
  }

  const generate = useCallback(async (
    currentSession: SessionRecord,
    startFromStage: GenerationStage = 'fetchingSubs',
  ) => {
    let activeStage: GenerationStage = startFromStage
    const canResumeGenerate =
      startFromStage === 'generatingArticle' && Boolean(lastFetchedSubs.current)
    const effectiveStartStage: GenerationStage = canResumeGenerate ? 'generatingArticle' : 'fetchingSubs'

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
  }, [])

  async function handleDeleteSession() {
    if (!sessionId) {
      return
    }

    const shouldDelete = window.confirm(t('messages.confirmDeleteSession'))
    if (!shouldDelete) {
      return
    }

    await deleteSession(sessionId)
    navigate('/')
  }

  function handleContentTabChange(_event: React.SyntheticEvent, value: ContentTab) {
    setActiveContentTab(value)
  }

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

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 3,
        gridTemplateColumns: { lg: 'minmax(18rem, 24rem) minmax(0, 1fr)', xs: '1fr' },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 3,
        }}
      >
        <Box sx={{ display: 'grid', gap: 2.5 }}>
          <Box>
            <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
              {t('session.status')}
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 600, mt: 0.5 }}>
              {t(`statuses.${session.status}`)}
            </Typography>
          </Box>

          <Box>
            <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
              {t('session.details')}
            </Typography>
            <Box
              sx={{
                backgroundColor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                color: 'text.secondary',
                display: 'grid',
                fontSize: 14,
                gap: 1.2,
                mt: 1.5,
                p: 2,
              }}
            >
              <Typography sx={{ overflowWrap: 'anywhere' }}>{session.youtubeUrl}</Typography>
              <Typography>
                {t('options.taskType')}: {t(`optionValues.${session.options.taskType}`)}
              </Typography>
              <Typography>
                {t('options.outputStyle')}: {t(`optionValues.${session.options.outputStyle}`)}
              </Typography>
              <Typography>
                {t('options.targetReaders')}: {t(`optionValues.${session.options.targetReaders}`)}
              </Typography>
              <Typography>
                {t('options.outputLanguage')}:{' '}
                {t(
                  session.options.outputLanguage === 'zh'
                    ? 'optionValues.chinese'
                    : 'optionValues.english',
                )}
              </Typography>
            </Box>
          </Box>

          {isStageFlowVisible ? (
            <Stepper activeStep={activeStep} orientation="vertical">
              <Step completed={session.status === 'completed' || generationStage === 'generatingArticle'}>
                <StepLabel error={Boolean(stageErrors.fetchingSubs)}>{t('session.stepFetchSubs')}</StepLabel>
                <StepContent>
                  <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
                    {session.status === 'generating' && generationStage === 'fetchingSubs' ? (
                      <CircularProgress size={16} />
                    ) : null}
                    <Typography sx={{ color: stageErrors.fetchingSubs ? 'error.main' : 'text.secondary', fontSize: 13 }}>
                      {stageErrors.fetchingSubs
                        ? stageErrors.fetchingSubs
                        : generationStage === 'fetchingSubs' && session.status === 'generating'
                          ? t('session.stageInProgress')
                          : t('session.stageCompleted')}
                    </Typography>
                  </Box>
                </StepContent>
              </Step>

              <Step completed={session.status === 'completed'}>
                <StepLabel error={Boolean(stageErrors.generatingArticle)}>{t('session.stepGenerateArticle')}</StepLabel>
                <StepContent>
                  <Box sx={{ display: 'grid', gap: 0.8 }}>
                    <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
                      {session.status === 'generating' && generationStage === 'generatingArticle' ? (
                        <CircularProgress size={16} />
                      ) : null}
                      <Typography sx={{ color: stageErrors.generatingArticle ? 'error.main' : 'text.secondary', fontSize: 13 }}>
                        {stageErrors.generatingArticle
                          ? stageErrors.generatingArticle
                          : generationStage === 'generatingArticle' && session.status === 'generating'
                            ? t('session.stageInProgress')
                            : t('session.stagePending')}
                      </Typography>
                    </Box>
                    {session.status === 'generating' && generationStage === 'generatingArticle' ? (
                      <>
                        <Typography sx={{ fontSize: 13 }}>
                          {t('session.streamingProgress')}:{' '}
                          {t('session.receivedChars', {
                            count: numberFormatter.format(receivedChars),
                          })}
                        </Typography>
                        <Typography sx={{ fontSize: 13 }}>
                          {t('session.generationSpeed', {
                            speed: numberFormatter.format(Number(charsPerSecond.toFixed(1))),
                          })}
                        </Typography>
                      </>
                    ) : null}
                  </Box>
                </StepContent>
              </Step>
            </Stepper>
          ) : null}

          {session.error && !stageErrors.fetchingSubs && !stageErrors.generatingArticle ? (
            <Box
              sx={{
                backgroundColor: 'error.light',
                border: '1px solid',
                borderColor: 'error.main',
                color: 'error.contrastText',
                fontSize: 14,
                px: 2,
                py: 1.5,
              }}
            >
              {t('session.errorPrefix')} {session.error}
            </Box>
          ) : null}

          {(session.status === 'failed' || session.status === 'completed') && (
            <Button
              variant="contained"
              onClick={() =>
                void generate(
                  session,
                  stageErrors.generatingArticle ? 'generatingArticle' : 'fetchingSubs',
                )
              }
            >
              {t('actions.retry')}
            </Button>
          )}

          <Button
            disabled={session.status === 'generating'}
            color="error"
            variant="outlined"
            onClick={() => void handleDeleteSession()}
          >
            {t('actions.deleteSession')}
          </Button>
        </Box>
      </Paper>

      <Box>
        <Paper
          elevation={0}
          sx={{
            p: 3,
          }}
        >
          <Tabs
            value={activeContentTab}
            onChange={handleContentTabChange}
            sx={{ mb: 2 }}
          >
            <Tab value="captions" label={t('session.tabCaptions')} />
            <Tab value="article" label={t('session.tabArticle')} />
          </Tabs>

          {activeContentTab === 'article' ? (
            <>
              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: 32, fontWeight: 600 }}>
                  {session.title ?? t('session.article')}
                </Typography>
              </Box>

              {session.article ? (
                <Typography component="article" sx={{ fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {session.article}
                </Typography>
              ) : (
                <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
                  {t('session.articleEmpty')}
                </Typography>
              )}
            </>
          ) : (
            <>
              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: 22, fontWeight: 600 }}>
                  {t('session.tabCaptions')}
                </Typography>
              </Box>

              {captionSegments.length > 0 ? (
                <Box sx={{ display: 'grid', gap: 1.5 }}>
                  <Box
                    sx={{
                      alignItems: 'center',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 1.2,
                      justifyContent: 'space-between',
                    }}
                  >
                    <Typography sx={{ color: 'text.secondary', fontSize: 13, fontWeight: 600 }}>
                      {t('session.captionSegmentCount', {
                        count: numberFormatter.format(captionSegments.length),
                      })}
                    </Typography>
                    <Typography sx={{ color: 'text.secondary', fontSize: 13, fontWeight: 600 }}>
                      {t('session.captionDuration', {
                        duration: formatTimestamp(captionDurationMs),
                      })}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      background:
                        'linear-gradient(180deg, color-mix(in srgb, var(--mui-palette-primary-main) 7%, transparent), transparent)',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      display: 'grid',
                      gap: 1,
                      maxHeight: { md: 560, xs: 420 },
                      overflowY: 'auto',
                      p: 1.2,
                    }}
                  >
                    {captionSegments.map((segment, index) => (
                      <Box
                        key={`${segment.startMs}-${index}`}
                        sx={{
                          backgroundColor: 'background.paper',
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1.5,
                          display: 'grid',
                          gap: 1.2,
                          gridTemplateColumns: { sm: '7.5rem minmax(0, 1fr)', xs: '1fr' },
                          p: 1.2,
                        }}
                      >
                        <Box sx={{ alignItems: 'flex-start', display: 'grid', gap: 0.8 }}>
                          <Typography
                            sx={{
                              color: 'text.secondary',
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                              fontSize: 12,
                              fontWeight: 600,
                              letterSpacing: 0.2,
                            }}
                          >
                            {formatTimestamp(segment.startMs)}
                          </Typography>

                          {videoId ? (
                            <Typography
                              component="a"
                              href={buildYouTubeTimestampUrl(videoId, segment.startMs)}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{
                                alignItems: 'center',
                                backgroundColor: 'action.hover',
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 99,
                                color: 'primary.main',
                                display: 'inline-flex',
                                fontSize: 11,
                                fontWeight: 700,
                                lineHeight: 1,
                                px: 1,
                                py: 0.5,
                                textDecoration: 'none',
                                width: 'fit-content',
                                '&:hover': {
                                  backgroundColor: 'primary.main',
                                  borderColor: 'primary.main',
                                  color: 'primary.contrastText',
                                },
                              }}
                            >
                              {t('session.jumpToVideo')}
                            </Typography>
                          ) : null}
                        </Box>

                        <Typography sx={{ fontSize: 14, lineHeight: 1.75, overflowWrap: 'anywhere', whiteSpace: 'normal' }}>
                          {segment.text}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              ) : session.transcriptPreview ? (
                <Box sx={{ display: 'grid', gap: 1.2 }}>
                  <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
                    {t('session.captionFallback')}
                  </Typography>
                  <Typography sx={{ color: 'text.secondary', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                    {session.transcriptPreview}
                  </Typography>
                </Box>
              ) : (
                <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
                  {t('session.captionEmpty')}
                </Typography>
              )}
            </>
          )}
        </Paper>
      </Box>
    </Box>
  )
}
