export interface Env {
  AI_MODEL?: string
  ASSETS: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  }
  DB: D1Database
  GEMINI_API_KEY?: string
}

export interface GenerationOptions {
  taskType: string
  outputStyle: string
  targetReaders: string
  outputLanguage: 'en' | 'zh'
  customPrompt: string
}

export interface CaptionSegment {
  startMs: number
  durationMs: number
  text: string
}

export interface SessionSection {
  id: string
  parentId: string | null
  title: string
  content: string
  depth: number
  position: number
  children: SessionSection[]
}

export type SessionStatus = 'queued' | 'generating' | 'completed' | 'failed'

export interface SessionRecord {
  id: string
  youtubeUrl: string
  videoId: string | null
  createdAt: string
  updatedAt: string
  status: SessionStatus
  options: GenerationOptions
  transcript?: string
  title?: string
  article?: string
  sections?: SessionSection[]
  transcriptPreview?: string
  captions?: CaptionSegment[]
  error?: string
}

export interface FetchSubsRequestBody {
  youtubeUrl: string
}

export interface GenerateArticleRequestBody {
  transcript: string
  options: GenerationOptions
}

export interface SaveSessionRequestBody {
  session: SessionRecord
}

export interface CreateSessionRequestBody {
  youtubeUrl: string
  videoId?: string | null
  status?: SessionStatus
  options: GenerationOptions
}

export interface PatchSessionRequestBody {
  patch: Partial<Omit<SessionRecord, 'id' | 'createdAt' | 'updatedAt'>>
}
