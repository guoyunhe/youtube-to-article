import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { deleteSession, getSession, saveSession } from '../lib/sessionStore'
import type {
  FetchSubsResponse,
  GenerateArticleFromSubsResponse,
  GenerateArticleResponse,
  SessionRecord,
} from '../types'

type GenerateErrorPayload = {
  error?: string
  requestId?: string
  stage?: string
}

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
  endpoint: '/api/fetchSubs' | '/api/generateArticle',
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

async function requestGeneration(session: SessionRecord): Promise<GenerateArticleResponse> {
  const subs = await postJson<FetchSubsResponse>('/api/fetchSubs', {
    youtubeUrl: session.youtubeUrl,
  })

  const article = await postJson<GenerateArticleFromSubsResponse>('/api/generateArticle', {
    transcript: subs.transcript,
    options: session.options,
  })

  return {
    article: article.article,
    title: article.title,
    transcriptPreview: subs.transcriptPreview,
    videoId: subs.videoId,
  }
}

export function SessionPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [session, setSession] = useState<SessionRecord | null>(null)
  const [loadError, setLoadError] = useState('')
  const autostarted = useRef(false)

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
    const generatingSession: SessionRecord = {
      ...currentSession,
      status: 'generating',
      error: undefined,
      updatedAt: new Date().toISOString(),
    }

    await persistSession(generatingSession)

    try {
      const result = await requestGeneration(generatingSession)

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
          background: 'var(--color-danger-bg)',
          border: '1px solid var(--color-danger-border)',
          borderRadius: 3,
          color: 'var(--color-danger-text)',
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
          background: 'var(--color-danger-bg)',
          border: '1px solid var(--color-danger-border)',
          borderRadius: 3,
          color: 'var(--color-danger-text)',
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
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 3,
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
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 3,
          p: 3,
        }}
      >
        <Box sx={{ display: 'grid', gap: 2.5 }}>
          <Box>
            <Typography sx={{ color: 'var(--color-text-subtle)', fontSize: 14 }}>
              {t('session.status')}
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 600, mt: 0.5 }}>
              {t(`statuses.${session.status}`)}
            </Typography>
          </Box>

          <Box>
            <Typography sx={{ color: 'var(--color-text-subtle)', fontSize: 14 }}>
              {t('session.details')}
            </Typography>
            <Box
              sx={{
                background: 'var(--color-card-soft)',
                border: '1px solid var(--color-border)',
                borderRadius: 2,
                color: 'var(--color-text-muted)',
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
            <Box
              sx={{
                alignItems: 'center',
                background: 'var(--color-accent-bg)',
                border: '1px solid var(--color-accent-border)',
                borderRadius: 2,
                color: 'var(--color-accent-text)',
                display: 'flex',
                fontSize: 14,
                gap: 1,
                px: 2,
                py: 1.5,
              }}
            >
              <CircularProgress size={18} />
              <span>{t('session.generating')}</span>
            </Box>
          ) : null}

          {session.error ? (
            <Box
              sx={{
                background: 'var(--color-danger-bg)',
                border: '1px solid var(--color-danger-border)',
                borderRadius: 2,
                color: 'var(--color-danger-text)',
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
            sx={{
              background: 'var(--color-danger-bg)',
              borderColor: 'var(--color-danger-border)',
              color: 'var(--color-danger-text)',
            }}
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
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 3,
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
            <Typography sx={{ color: 'var(--color-text-subtle)', fontSize: 14 }}>
              {t('session.articleEmpty')}
            </Typography>
          )}
        </Paper>

        <Paper
          elevation={0}
          sx={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 3,
            p: 3,
          }}
        >
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 22, fontWeight: 600 }}>
              {t('session.transcriptPreview')}
            </Typography>
          </Box>
          <Typography sx={{ color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
            {session.transcriptPreview ?? '—'}
          </Typography>
        </Paper>
      </Box>
    </Box>
  )
}
