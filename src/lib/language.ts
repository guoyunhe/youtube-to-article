export type SupportedLanguage = 'en' | 'zh'

export const OUTPUT_LANGUAGE_STORAGE_KEY = 'yta-output-language-preference'

export function normalizeLanguage(language?: string | null): SupportedLanguage {
  return language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

function getStoredValue(storageKey: string): SupportedLanguage | null {
  if (typeof window === 'undefined') {
    return null
  }

  const value = window.localStorage.getItem(storageKey)
  return value === 'en' || value === 'zh' ? value : null
}

export function getStoredOutputLanguage(): SupportedLanguage | null {
  return getStoredValue(OUTPUT_LANGUAGE_STORAGE_KEY)
}

export function getInitialOutputLanguage(fallback: SupportedLanguage): SupportedLanguage {
  return getStoredOutputLanguage() ?? fallback
}

export function persistOutputLanguage(language: SupportedLanguage): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(OUTPUT_LANGUAGE_STORAGE_KEY, language)
}