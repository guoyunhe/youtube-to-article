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

export interface GenerateArticleResponse {
  article: string
  title: string
  transcriptPreview: string
  videoId: string
}

export interface FetchSubsResponse {
  transcript: string
  transcriptPreview: string
  captions: CaptionSegment[]
  videoId: string
}

export interface GenerateArticleFromSubsResponse {
  article: string
  title: string
}
