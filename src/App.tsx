import { Button, Card } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { SessionPage } from './pages/SessionPage'

function LanguageSwitcher() {
  const { i18n } = useTranslation()

  return (
    <div className="flex items-center gap-2 text-sm">
      {(['en', 'zh'] as const).map((language) => (
        <Button
          key={language}
          className="min-w-14"
          size="sm"
          variant={i18n.language === language ? 'primary' : 'outline'}
          onPress={() => void i18n.changeLanguage(language)}
        >
          {language === 'en' ? 'EN' : '中文'}
        </Button>
      ))}
    </div>
  )
}

function AppShell() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Card className="border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link className="text-2xl font-semibold tracking-tight" to="/">
                {t('appName')}
              </Link>
              <p className="mt-1 text-sm text-slate-300">{t('tagline')}</p>
            </div>

            <div className="flex items-center gap-3">
              {location.pathname !== '/' ? (
                <Button variant="outline" onPress={() => navigate('/')}>
                  {t('actions.backHome')}
                </Button>
              ) : null}
              <LanguageSwitcher />
            </div>
          </div>
        </Card>

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/session/:sessionId" element={<SessionPage />} />
        </Routes>
      </div>
    </div>
  )
}

export default AppShell
