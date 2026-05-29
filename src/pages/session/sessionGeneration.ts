import type { FetchCaptionsResponse, GenerateArticleResponse, SessionRecord } from '../../types'

export type GenerateErrorPayload = {
  error?: string
  requestId?: string
  stage?: string
}

type GenerateArticleStreamEvent =
  | { type: 'delta'; chunk: string }
  | { type: 'done'; title: string }
  | { type: 'error'; error?: string }

export type GenerationStage = 'fetchingSubs' | 'generatingArticle'

function toPreview(text: string, max = 240): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  return compact.length <= max ? compact : `${compact.slice(0, max)}...`
}

export class GenerationRequestError extends Error {
  stage: GenerationStage

  constructor(stage: GenerationStage, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'GenerationRequestError'
    this.stage = stage
  }
}

async function parseApiResponse<T>(response: Response, endpoint: string): Promise<T> {
  const contentType = response.headers.get('content-type') ?? 'unknown'
  const requestId = response.headers.get('x-request-id') ?? 'n/a'
  const rawBody = await response.text()

  console.info(`[api] ${endpoint} response meta`, {
    status: response.status,
    contentType,
    requestId,
    bodyPreview: toPreview(rawBody),
  })

  if (!rawBody.trim()) {
    throw new Error(
      `${endpoint} returned an empty response body. status=${response.status}, content-type=${contentType}, request-id=${requestId}`,
    )
  }

  let payload: T & GenerateErrorPayload

  try {
    payload = JSON.parse(rawBody) as T & GenerateErrorPayload
  } catch (error) {
    const parseError = error instanceof Error ? error.message : 'Unknown JSON parse error.'
    throw new Error(`${endpoint} returned non-JSON or malformed JSON. status=${response.status}, content-type=${contentType}, request-id=${requestId}, parse-error=${parseError}, body-preview=${toPreview(rawBody)}`, {
      cause: error,
    })
  }

  if (!response.ok) {
    const stage = payload.stage ? `, stage=${payload.stage}` : ''
    const errorRequestId = payload.requestId ?? requestId
    throw new Error(
      `${payload.error ?? `Unable to process ${endpoint}.`} (status=${response.status}, request-id=${errorRequestId}${stage})`,
    )
  }

  return payload
}

async function postJson<T>(endpoint: '/api/fetchCaptions', body: unknown): Promise<T> {
  console.info(`[api] request ${endpoint}`, body)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return parseApiResponse<T>(response, endpoint)
}

function parseStreamLine(line: string): GenerateArticleStreamEvent | null {
  if (!line.trim()) {
    return null
  }

  const payload = JSON.parse(line) as Partial<GenerateArticleStreamEvent>

  if (payload.type === 'delta' && typeof payload.chunk === 'string') {
    return {
      type: 'delta',
      chunk: payload.chunk,
    }
  }

  if (payload.type === 'done' && typeof payload.title === 'string') {
    return {
      type: 'done',
      title: payload.title,
    }
  }

  if (payload.type === 'error') {
    return {
      type: 'error',
      error: payload.error,
    }
  }

  return null
}

function deriveTitle(article: string): string {
  return article.split('\n')[0]?.replace(/^#+\s*/, '').trim() || 'Generated article'
}

export async function requestGeneration(
  session: SessionRecord,
  onStageChange: (stage: GenerationStage) => void,
  onSubsFetched: (subs: FetchCaptionsResponse) => Promise<void>,
  onDelta: (article: string) => void,
  startFromStage: GenerationStage,
  cachedSubs: FetchCaptionsResponse | null,
): Promise<GenerateArticleResponse> {
  let subs: FetchCaptionsResponse

  if (startFromStage === 'generatingArticle' && cachedSubs) {
    subs = cachedSubs
  } else {
    onStageChange('fetchingSubs')

    try {
      subs = await postJson<FetchCaptionsResponse>('/api/fetchCaptions', {
        youtubeUrl: session.youtubeUrl,
      })
      await onSubsFetched(subs)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to fetch captions.'
      throw new GenerationRequestError('fetchingSubs', message, { cause: error })
    }
  }

  onStageChange('generatingArticle')

  try {
    const response = await fetch('/api/generateArticle', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        transcript: subs.transcript,
        options: session.options,
      }),
    })

    if (!response.ok) {
      await parseApiResponse<GenerateErrorPayload>(response, '/api/generateArticle')
    }

    if (!response.body) {
      throw new Error('/api/generateArticle returned an empty response stream.')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let pending = ''
    let article = ''
    let title = ''

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        pending += decoder.decode(value, { stream: true })
        const lines = pending.split('\n')
        pending = lines.pop() ?? ''

        for (const line of lines) {
          const event = parseStreamLine(line)

          if (!event) {
            continue
          }

          if (event.type === 'delta') {
            article += event.chunk
            onDelta(article)
            continue
          }

          if (event.type === 'done') {
            title = event.title
            continue
          }

          if (event.type === 'error') {
            throw new Error(event.error ?? 'Unable to generate article.')
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    const finalArticle = article.trim()

    if (!finalArticle) {
      throw new Error('The AI returned an empty article.')
    }

    const finalTitle = title || deriveTitle(finalArticle)

    return {
      article: finalArticle,
      title: finalTitle,
      transcriptPreview: subs.transcriptPreview,
      videoId: subs.videoId,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate article.'
    throw new GenerationRequestError('generatingArticle', message, { cause: error })
  }
}
