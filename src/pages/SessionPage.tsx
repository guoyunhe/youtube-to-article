import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { deleteSession, getSession, saveSession } from '../lib/sessionStore'
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

function toPreview(text: string, max = 240): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  return compact.length <= max ? compact : `${compact.slice(0, max)}...`
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
  onDelta: (article: string) => void,
): Promise<GenerateArticleResponse> {
  onStageChange('fetchingSubs')

  const subs = await postJson<FetchSubsResponse>('/api/fetchSubs', {
    youtubeUrl: session.youtubeUrl,
  })

  onStageChange('generatingArticle')

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
}

export function SessionPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [session, setSession] = useState<SessionRecord | null>(null)
  const [loadError, setLoadError] = useState('')
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null)
  const [generationStage, setGenerationStage] = useState<GenerationStage>('fetchingSubs')
  const [nowMs, setNowMs] = useState<number>(Date.now())
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
  const numberFormatter = new Intl.NumberFormat(i18n.resolvedLanguage ?? i18n.language)

  useEffect(() => {
    if (!sessionId) {
      return
    }

    void getSession(sessionId).then((storedSession) => {
      if (!storedSession) {
        setLoadError(t('session.notFound'))
        return
      }

      setSession(storedSession)
    })
  }, [sessionId, t])

  async function persistSession(nextSession: SessionRecord) {
    setSession(nextSession)
    await saveSession(nextSession)
  }

  const generate = useCallback(async (currentSession: SessionRecord) => {
    setGenerationStartedAt(Date.now())
    setGenerationStage('fetchingSubs')

    const generatingSession: SessionRecord = {
      ...currentSession,
      status: 'generating',
      article: '',
      title: undefined,
      error: undefined,
      updatedAt: new Date().toISOString(),
    }

    await persistSession(generatingSession)

    try {
      const result = await requestGeneration(generatingSession, setGenerationStage, (article) => {
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
      })

      await persistSession({
        ...generatingSession,
        status: 'completed',
        article: result.article,
        title: result.title,
        transcriptPreview: result.transcriptPreview,
        videoId: result.videoId,
        updatedAt: new Date().toISOString(),
      })
    } catch (error) {
      await persistSession({
        ...generatingSession,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unable to generate article.',
        updatedAt: new Date().toISOString(),
      })
    } finally {
      setGenerationStartedAt(null)
      setGenerationStage('fetchingSubs')
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

          {session.status === 'generating' ? (
            <Box sx={{ display: 'grid', gap: 1.2 }}>
              <Alert
                severity={generationStage === 'fetchingSubs' ? 'info' : 'success'}
                variant="outlined"
              >
                <Box sx={{ display: 'grid', gap: 0.8 }}>
                  <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
                    <CircularProgress
                      size={16}
                      value={generationStage === 'fetchingSubs' ? undefined : 100}
                      variant={generationStage === 'fetchingSubs' ? 'indeterminate' : 'determinate'}
                    />
                    <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
                      {t('session.stepFetchSubs')}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 13 }}>
                    {generationStage === 'fetchingSubs'
                      ? t('session.stageInProgress')
                      : t('session.stageCompleted')}
                  </Typography>
                </Box>
              </Alert>

              <Alert
                severity={generationStage === 'generatingArticle' ? 'info' : 'warning'}
                variant="outlined"
              >
                <Box sx={{ display: 'grid', gap: 0.8 }}>
                  <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
                    <CircularProgress
                      size={16}
                      value={generationStage === 'generatingArticle' ? undefined : 0}
                      variant={generationStage === 'generatingArticle' ? 'indeterminate' : 'determinate'}
                    />
                    <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
                      {t('session.stepGenerateArticle')}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 13 }}>
                    {generationStage === 'generatingArticle'
                      ? t('session.stageInProgress')
                      : t('session.stagePending')}
                  </Typography>
                  {generationStage === 'generatingArticle' ? (
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
              </Alert>
            </Box>
          ) : null}

          {session.error ? (
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
            <Button variant="contained" onClick={() => void generate(session)}>
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

      <Box sx={{ display: 'grid', gap: 3 }}>
        <Paper
          elevation={0}
          sx={{
            p: 3,
          }}
        >
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
        </Paper>

        <Paper
          elevation={0}
          sx={{
            p: 3,
          }}
        >
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 22, fontWeight: 600 }}>
              {t('session.transcriptPreview')}
            </Typography>
          </Box>
          <Typography sx={{ color: 'text.secondary', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
            {session.transcriptPreview ?? '—'}
          </Typography>
        </Paper>
      </Box>
    </Box>
  )
}
