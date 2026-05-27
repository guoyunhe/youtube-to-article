import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import { normalizeLanguage } from './lib/language'

const resources = {
  en: {
    translation: {
      appName: 'YouTube to Article',
      tagline: 'Turn YouTube captions into a tailored article in one click.',
      actions: {
        aiGenerate: 'AI Generate',
        advancedOptions: 'Advanced output options',
        backHome: 'Back to home',
        retry: 'Retry generation',
        deleteSession: 'Delete session',
      },
      home: {
        headline: 'Paste a YouTube URL',
        subheadline:
          'Drop in a video link, choose how the article should be written, and let AI draft it from the video captions.',
        urlLabel: 'YouTube URL',
        urlPlaceholder: 'https://www.youtube.com/watch?v=...',
        recentSessions: 'Recent local sessions',
        noSessions: 'No local sessions yet. Generated sessions will be stored in IndexedDB.',
      },
      session: {
        status: 'Status',
        generating: 'Generating article…',
        streamingProgress: 'Streaming progress',
        receivedChars: 'Received {{count}} chars',
        generationSpeed: '{{speed}} chars/s',
        transcriptPreview: 'Transcript preview',
        article: 'Generated article',
        articleEmpty: 'The generated article will appear here after generation finishes.',
        details: 'Session details',
        errorPrefix: 'Generation failed:',
        notFound: 'Session not found in local history.',
      },
      options: {
        taskType: 'Task type',
        outputStyle: 'Output style',
        targetReaders: 'Target readers',
        outputLanguage: 'Output language',
      },
      statuses: {
        queued: 'Queued',
        generating: 'Generating',
        completed: 'Completed',
        failed: 'Failed',
      },
      theme: {
        system: 'Auto',
        light: 'Light',
        dark: 'Dark',
        toggleHint: 'Switch theme to {{theme}}',
      },
      optionValues: {
        summary: 'Summary article',
        tutorial: 'Tutorial article',
        newsletter: 'Newsletter brief',
        professional: 'Professional',
        engaging: 'Engaging',
        concise: 'Concise',
        beginners: 'Beginners',
        practitioners: 'Practitioners',
        executives: 'Executives',
        english: 'English',
        chinese: 'Chinese',
      },
      validation: {
        invalidYoutubeUrl: 'Please enter a valid YouTube URL.',
      },
      messages: {
        confirmDeleteSession: 'Delete this session permanently? This action cannot be undone.',
      },
    },
  },
  zh: {
    translation: {
      appName: 'YouTube 转文章',
      tagline: '一键把 YouTube 字幕整理成适合目标读者的文章。',
      actions: {
        aiGenerate: 'AI 生成',
        advancedOptions: '高级输出选项',
        backHome: '返回首页',
        retry: '重新生成',
        deleteSession: '删除会话',
      },
      home: {
        headline: '粘贴 YouTube 链接',
        subheadline: '输入视频地址，选择输出方式，然后让 AI 基于视频字幕生成文章。',
        urlLabel: 'YouTube 链接',
        urlPlaceholder: 'https://www.youtube.com/watch?v=...',
        recentSessions: '本地历史会话',
        noSessions: '暂时没有本地历史。生成后的会话会保存到 IndexedDB。',
      },
      session: {
        status: '状态',
        generating: '正在生成文章…',
        streamingProgress: '流式进度',
        receivedChars: '已接收 {{count}} 个字符',
        generationSpeed: '{{speed}} 字符/秒',
        transcriptPreview: '字幕预览',
        article: '生成结果',
        articleEmpty: '生成完成后，文章会显示在这里。',
        details: '会话详情',
        errorPrefix: '生成失败：',
        notFound: '未在本地历史中找到该会话。',
      },
      options: {
        taskType: '任务类型',
        outputStyle: '输出风格',
        targetReaders: '目标读者',
        outputLanguage: '输出语言',
      },
      statuses: {
        queued: '排队中',
        generating: '生成中',
        completed: '已完成',
        failed: '失败',
      },
      theme: {
        system: '自动',
        light: '浅色',
        dark: '深色',
        toggleHint: '切换主题为{{theme}}',
      },
      optionValues: {
        summary: '总结文章',
        tutorial: '教程文章',
        newsletter: '资讯简报',
        professional: '专业正式',
        engaging: '生动易读',
        concise: '简明扼要',
        beginners: '初学者',
        practitioners: '从业者',
        executives: '管理者',
        english: '英文',
        chinese: '中文',
      },
      validation: {
        invalidYoutubeUrl: '请输入有效的 YouTube 链接。',
      },
      messages: {
        confirmDeleteSession: '确认永久删除该会话？此操作不可撤销。',
      },
    },
  },
} as const

void i18n.use(LanguageDetector).use(initReactI18next).init({
  resources,
  fallbackLng: 'en',
  supportedLngs: ['en', 'zh'],
  nonExplicitSupportedLngs: true,
  cleanCode: true,
  detection: {
    order: ['localStorage', 'navigator'],
    caches: ['localStorage'],
    lookupLocalStorage: 'yta-language-preference',
    convertDetectedLanguage: (language) => normalizeLanguage(language),
  },
  interpolation: {
    escapeValue: false,
  },
})

export { i18n }
