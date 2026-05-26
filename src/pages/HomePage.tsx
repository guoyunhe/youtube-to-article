import { Button, Card } from '@heroui/react'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { defaultOptions } from '../lib/defaults'
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
    <label className="app-text-muted flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <select
        className="app-select rounded-xl px-3 py-2 outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [error, setError] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [recentSessions, setRecentSessions] = useState<SessionRecord[]>([])
  const [options, setOptions] = useState<GenerationOptions>({
    ...defaultOptions,
    outputLanguage: i18n.language === 'zh' ? 'zh' : 'en',
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <Card className="app-card p-6 app-shadow-soft">
        <div className="mb-8 max-w-3xl">
          <p className="app-accent-surface mb-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
            Gemini + Cloudflare Workers
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">{t('home.headline')}</h1>
          <p className="app-text-muted mt-3 text-base">{t('home.subheadline')}</p>
        </div>

        <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
          <label className="flex flex-col gap-2">
            <span className="app-text-muted text-sm font-medium">{t('home.urlLabel')}</span>
            <input
              className="app-input rounded-2xl px-4 py-4 text-base outline-none"
              placeholder={t('home.urlPlaceholder')}
              value={youtubeUrl}
              onChange={(event) => {
                setYoutubeUrl(event.target.value)
                setError('')
              }}
            />
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button size="lg" type="submit" variant="primary">
              {t('actions.aiGenerate')}
            </Button>
            <Button
              size="lg"
              type="button"
              variant="outline"
              onPress={() => setAdvancedOpen((current) => !current)}
            >
              {t('actions.advancedOptions')}
            </Button>
          </div>

          {error ? (
            <p className="app-danger-surface rounded-xl px-4 py-3 text-sm">
              {error}
            </p>
          ) : null}

          {advancedOpen ? (
            <div className="app-card-soft grid gap-4 rounded-2xl p-4 sm:grid-cols-2">
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
                  setOptions((current) => ({
                    ...current,
                    outputLanguage: outputLanguage as GenerationOptions['outputLanguage'],
                  }))
                }
              />
            </div>
          ) : null}
        </form>
      </Card>

      <Card className="app-card p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">{t('home.recentSessions')}</h2>
        </div>

        <div className="space-y-3">
          {recentSessions.length === 0 ? (
            <p className="app-text-subtle text-sm">{t('home.noSessions')}</p>
          ) : (
            recentSessions.map((session) => (
              <div
                key={session.id}
                className="app-card-hover flex items-start gap-3 rounded-2xl p-4"
              >
                <Link className="block min-w-0 flex-1" to={`/session/${session.id}`}>
                  <p className="line-clamp-1 text-sm font-medium">{session.youtubeUrl}</p>
                  <div className="app-text-subtle mt-2 flex items-center justify-between gap-3 text-xs">
                    <span>{t(`statuses.${session.status}`)}</span>
                    <span>{new Date(session.updatedAt).toLocaleString()}</span>
                  </div>
                </Link>
                <Button
                  className="h-8 min-h-8 w-8 min-w-8 px-0"
                  size="sm"
                  variant="danger-soft"
                  onPress={() => void handleDeleteSession(session.id)}
                >
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M6 6l1 14h10l1-14" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                  <span className="sr-only">{t('actions.deleteSession')}</span>
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
