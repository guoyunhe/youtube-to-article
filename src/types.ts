export interface GenerationOptions {
  taskType: string
  outputStyle: string
  targetReaders: string
  outputLanguage: 'en' | 'zh'
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
  title?: string
  article?: string
  transcriptPreview?: string
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
  videoId: string
}

export interface GenerateArticleFromSubsResponse {
  article: string
  title: string
}
