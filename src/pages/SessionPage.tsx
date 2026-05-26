import { Button, Card, Spinner } from '@heroui/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { deleteSession, getSession, saveSession } from '../lib/sessionStore'
import type { GenerateArticleResponse, SessionRecord } from '../types'

async function requestGeneration(session: SessionRecord): Promise<GenerateArticleResponse> {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      youtubeUrl: session.youtubeUrl,
      options: session.options,
    }),
  })

  const payload = (await response.json()) as GenerateArticleResponse & { error?: string }

  if (!response.ok) {
    throw new Error(payload.error ?? 'Unable to generate article.')
  }

  return payload
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
      <Card className="border border-rose-500/30 bg-rose-500/10 p-6 text-rose-100">
        <p>{t('session.notFound')}</p>
      </Card>
    )
  }

  if (loadError) {
    return (
      <Card className="border border-rose-500/30 bg-rose-500/10 p-6 text-rose-100">
        <p>{loadError}</p>
      </Card>
    )
  }

  if (!session) {
    return (
      <Card className="flex items-center gap-3 border border-white/10 bg-slate-900/70 p-6 text-slate-100">
        <Spinner color="accent" />
        <p>{t('session.generating')}</p>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
      <Card className="border border-white/10 bg-slate-900/70 p-6">
        <div className="space-y-5">
          <div>
            <p className="text-sm text-slate-400">{t('session.status')}</p>
            <p className="mt-1 text-lg font-semibold">{t(`statuses.${session.status}`)}</p>
          </div>

          <div>
            <p className="text-sm text-slate-400">{t('session.details')}</p>
            <div className="mt-3 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              <p className="break-all">{session.youtubeUrl}</p>
              <p>
                {t('options.taskType')}: {t(`optionValues.${session.options.taskType}`)}
              </p>
              <p>
                {t('options.outputStyle')}: {t(`optionValues.${session.options.outputStyle}`)}
              </p>
              <p>
                {t('options.targetReaders')}: {t(`optionValues.${session.options.targetReaders}`)}
              </p>
              <p>
                {t('options.outputLanguage')}:{' '}
                {t(
                  session.options.outputLanguage === 'zh'
                    ? 'optionValues.chinese'
                    : 'optionValues.english',
                )}
              </p>
            </div>
          </div>

          {session.status === 'generating' ? (
            <div className="flex items-center gap-3 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
              <Spinner color="accent" size="sm" />
              <span>{t('session.generating')}</span>
            </div>
          ) : null}

          {session.error ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {t('session.errorPrefix')} {session.error}
            </div>
          ) : null}

          {(session.status === 'failed' || session.status === 'completed') && (
            <Button variant="primary" onPress={() => void generate(session)}>
              {t('actions.retry')}
            </Button>
          )}

          <Button
            isDisabled={session.status === 'generating'}
            variant="danger-soft"
            onPress={() => void handleDeleteSession()}
          >
            {t('actions.deleteSession')}
          </Button>
        </div>
      </Card>

      <div className="space-y-6">
        <Card className="border border-white/10 bg-slate-900/70 p-6">
          <div className="mb-4">
            <h2 className="text-2xl font-semibold">{session.title ?? t('session.article')}</h2>
          </div>

          {session.article ? (
            <article className="whitespace-pre-wrap text-sm leading-7 text-slate-100">
              {session.article}
            </article>
          ) : (
            <p className="text-sm text-slate-400">{t('session.articleEmpty')}</p>
          )}
        </Card>

        <Card className="border border-white/10 bg-slate-900/70 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">{t('session.transcriptPreview')}</h2>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
            {session.transcriptPreview ?? '—'}
          </p>
        </Card>
      </div>
    </div>
  )
}
