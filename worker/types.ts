export interface Env {
  AI_MODEL?: string
  ASSETS: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  }
  GEMINI_API_KEY?: string
}

export interface GenerationOptions {
  taskType: string
  outputStyle: string
  targetReaders: string
  outputLanguage: 'en' | 'zh'
  customPrompt: string
}

export interface FetchSubsRequestBody {
  youtubeUrl: string
}

export interface GenerateArticleRequestBody {
  transcript: string
  options: GenerationOptions
}
