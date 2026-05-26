import { Button, Card } from '@heroui/react'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { defaultOptions } from '../lib/defaults'
import { listSessions, saveSession } from '../lib/sessionStore'
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
    <label className="flex flex-col gap-2 text-sm text-slate-200">
      <span className="font-medium">{label}</span>
      <select
        className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-slate-50 outline-none transition focus:border-cyan-400"
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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <Card className="border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-cyan-950/20">
        <div className="mb-8 max-w-3xl">
          <p className="mb-3 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
            Gemini + Cloudflare Workers
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">{t('home.headline')}</h1>
          <p className="mt-3 text-base text-slate-300">{t('home.subheadline')}</p>
        </div>

        <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-200">{t('home.urlLabel')}</span>
            <input
              className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 text-base text-slate-50 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
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
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </p>
          ) : null}

          {advancedOpen ? (
            <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:grid-cols-2">
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

      <Card className="border border-white/10 bg-slate-900/70 p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">{t('home.recentSessions')}</h2>
        </div>

        <div className="space-y-3">
          {recentSessions.length === 0 ? (
            <p className="text-sm text-slate-400">{t('home.noSessions')}</p>
          ) : (
            recentSessions.map((session) => (
              <Link
                key={session.id}
                className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-cyan-400/40 hover:bg-white/10"
                to={`/session/${session.id}`}
              >
                <p className="line-clamp-1 text-sm font-medium text-slate-100">{session.youtubeUrl}</p>
                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-400">
                  <span>{t(`statuses.${session.status}`)}</span>
                  <span>{new Date(session.updatedAt).toLocaleString()}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
