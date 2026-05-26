interface Env {
  AI_MODEL?: string
  ASSETS: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  }
  GEMINI_API_KEY?: string
}

interface GenerationOptions {
  taskType: string
  outputStyle: string
  targetReaders: string
  outputLanguage: 'en' | 'zh'
}

interface FetchSubsRequestBody {
  youtubeUrl: string
}

interface GenerateArticleRequestBody {
  transcript: string
  options: GenerationOptions
}

interface CaptionTrack {
  baseUrl: string
  languageCode?: string
  kind?: string
}

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
}

const youtubeHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com'])
const shortHosts = new Set(['youtu.be', 'www.youtu.be'])

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...(init?.headers ?? {}),
    },
  })
}

function extractVideoId(input: string): string | null {
  try {
    const url = new URL(input.trim())
    const hostname = url.hostname.toLowerCase()

    if (youtubeHosts.has(hostname)) {
      if (url.pathname === '/watch') {
        return url.searchParams.get('v')
      }

      if (url.pathname.startsWith('/shorts/')) {
        return url.pathname.split('/')[2] ?? null
      }
    }

    if (shortHosts.has(hostname)) {
      return url.pathname.replaceAll('/', '') || null
    }
  } catch {
    return null
  }

  return null
}

async function parseJsonBody<T>(request: Request): Promise<T> {
  let body: T

  try {
    body = (await request.json()) as T
  } catch {
    throw new Error('Request body must be valid JSON.')
  }

  return body
}

function parseOptions(options: unknown): GenerationOptions {
  if (!options || typeof options !== 'object') {
    throw new Error('Generation options are required.')
  }

  const raw = options as Partial<GenerationOptions>

  return {
    taskType: String(raw.taskType ?? 'summary'),
    outputStyle: String(raw.outputStyle ?? 'professional'),
    targetReaders: String(raw.targetReaders ?? 'beginners'),
    outputLanguage: raw.outputLanguage === 'zh' ? 'zh' : 'en',
  }
}

async function parseFetchSubsRequest(request: Request): Promise<FetchSubsRequestBody> {
  const body = await parseJsonBody<Partial<FetchSubsRequestBody>>(request)

  if (!body.youtubeUrl || typeof body.youtubeUrl !== 'string') {
    throw new Error('A valid YouTube URL is required.')
  }

  return {
    youtubeUrl: body.youtubeUrl.trim(),
  }
}

async function parseGenerateArticleRequest(request: Request): Promise<GenerateArticleRequestBody> {
  const body = await parseJsonBody<Partial<GenerateArticleRequestBody>>(request)

  if (!body.transcript || typeof body.transcript !== 'string' || !body.transcript.trim()) {
    throw new Error('A valid transcript is required.')
  }

  const options = parseOptions(body.options)

  return {
    transcript: body.transcript.trim(),
    options,
  }
}

function extractCaptionTracks(html: string): CaptionTrack[] {
  const directMatch = html.match(/"captionTracks":(\[[\s\S]*?\])/)
  const escapedMatch = html.match(/\\"captionTracks\\":(\[[\s\S]*?\])/)
  const rawTracks = directMatch?.[1] ?? escapedMatch?.[1]?.replace(/\\"/g, '"')

  if (!rawTracks) {
    return []
  }

  try {
    return JSON.parse(rawTracks) as CaptionTrack[]
  } catch {
    return []
  }
}

function extractTranscript(payload: unknown): string {
  const transcriptChunks = (
    payload as {
      events?: Array<{
        segs?: Array<{ utf8?: string }>
      }>
    }
  ).events
    ?.flatMap((event) => event.segs ?? [])
    .map((segment) => segment.utf8?.trim() ?? '')
    .filter(Boolean)

  return transcriptChunks?.join(' ').replace(/\s+/g, ' ').trim() ?? ''
}

async function fetchTranscript(videoId: string): Promise<string> {
  const watchResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    headers: {
      'accept-language': 'en-US,en;q=0.9',
      'user-agent':
        'Mozilla/5.0 (compatible; YouTubeToArticleBot/1.0; +https://workers.dev)',
    },
  })

  if (!watchResponse.ok) {
    throw new Error('Unable to fetch the YouTube watch page.')
  }

  const watchHtml = await watchResponse.text()
  const captionTracks = extractCaptionTracks(watchHtml)

  if (captionTracks.length === 0) {
    throw new Error('No captions were found for this video.')
  }

  const selectedTrack =
    captionTracks.find((track) => track.languageCode?.startsWith('en') && track.kind !== 'asr') ??
    captionTracks.find((track) => track.languageCode?.startsWith('en')) ??
    captionTracks[0]

  const transcriptUrl = new URL(selectedTrack.baseUrl)
  transcriptUrl.searchParams.set('fmt', 'json3')

  const transcriptResponse = await fetch(transcriptUrl)

  if (!transcriptResponse.ok) {
    throw new Error('Unable to fetch the caption track.')
  }

  const transcript = extractTranscript(await transcriptResponse.json())

  if (!transcript) {
    throw new Error('The caption track did not contain readable transcript text.')
  }

  // Keep the transcript comfortably under large-model prompt limits while preserving enough context.
  return transcript.slice(0, 24000)
}

function buildPrompt(options: GenerationOptions, transcript: string): string {
  const languageInstruction =
    options.outputLanguage === 'zh'
      ? 'Write the response in Simplified Chinese.'
      : 'Write the response in English.'

  return `
You are generating an article from a YouTube video transcript.

Requirements:
- Task type: ${options.taskType}
- Output style: ${options.outputStyle}
- Target readers: ${options.targetReaders}
- ${languageInstruction}
- Produce a clear title on the first line.
- Then write a polished article with sections, short paragraphs, and actionable takeaways.
- Base the article only on the transcript content. If something is unclear, acknowledge uncertainty instead of inventing details.

Transcript:
${transcript}
  `.trim()
}

function extractArticleText(payload: unknown): string {
  const candidates = (payload as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>
      }
    }>
  }).candidates

  const article = candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('\n')
    .trim()

  if (!article) {
    throw new Error('Gemini returned an empty response.')
  }

  return article
}

function deriveTitle(article: string): string {
  return article.split('\n')[0]?.replace(/^#+\s*/, '').trim() || 'Generated article'
}

async function generateArticleFromTranscript(
  env: Env,
  options: GenerationOptions,
  transcript: string,
) {
  if (!env.GEMINI_API_KEY) {
    throw new Error('The GEMINI_API_KEY Worker secret is not configured.')
  }
  const model = env.AI_MODEL || 'gemini-2.0-flash'

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: buildPrompt(options, transcript),
              },
            ],
          },
        ],
      }),
    },
  )

  if (!response.ok) {
    throw new Error(`Gemini request failed: ${await response.text()}`)
  }

  const article = extractArticleText(await response.json())

  return {
    article,
    title: deriveTitle(article),
  }
}

async function fetchSubs(youtubeUrl: string) {
  const videoId = extractVideoId(youtubeUrl)

  if (!videoId) {
    throw new Error('Please provide a valid YouTube URL.')
  }

  const transcript = await fetchTranscript(videoId)

  return {
    transcript,
    transcriptPreview: transcript.slice(0, 800),
    videoId,
  }
}

function classifyGenerationError(error: unknown): { status: number; message: string } {
  const message = error instanceof Error ? error.message : 'Unexpected generation error.'

  if (
    message === 'Request body must be valid JSON.' ||
    message === 'Unexpected end of JSON input' ||
    message === 'A valid YouTube URL is required.' ||
    message === 'A valid transcript is required.' ||
    message === 'Generation options are required.' ||
    message === 'Please provide a valid YouTube URL.'
  ) {
    return { status: 400, message }
  }

  if (
    message === 'No captions were found for this video.' ||
    message === 'The caption track did not contain readable transcript text.'
  ) {
    return { status: 422, message }
  }

  if (message.startsWith('Gemini request failed:')) {
    return { status: 502, message }
  }

  return { status: 500, message }
}

function buildTraceHeaders(requestId: string): HeadersInit {
  return {
    'x-request-id': requestId,
  }
}

async function handleFetchSubs(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID()
  let stage = 'parseFetchSubsRequest'

  console.log(`[fetchSubs:${requestId}] start`)

  try {
    const body = await parseFetchSubsRequest(request)
    stage = 'extractVideoId'
    stage = 'fetchTranscript'
    const result = await fetchSubs(body.youtubeUrl)

    console.log(`[fetchSubs:${requestId}] success`)

    return json(result, {
      headers: buildTraceHeaders(requestId),
    })
  } catch (error) {
    const classified = classifyGenerationError(error)

    console.error(`[fetchSubs:${requestId}] failed at ${stage}`, {
      status: classified.status,
      message: classified.message,
    })

    return json(
      {
        error: classified.message,
        requestId,
        stage,
      },
      {
        status: classified.status,
        headers: buildTraceHeaders(requestId),
      },
    )
  }
}

async function handleGenerateArticle(request: Request, env: Env): Promise<Response> {
  const requestId = crypto.randomUUID()
  let stage = 'parseGenerateArticleRequest'

  console.log(`[generateArticle:${requestId}] start`)

  try {
    const body = await parseGenerateArticleRequest(request)

    stage = 'generateArticle'
    const result = await generateArticleFromTranscript(env, body.options, body.transcript)
    console.log(`[generateArticle:${requestId}] success`)

    return json(result, {
      headers: buildTraceHeaders(requestId),
    })
  } catch (error) {
    const classified = classifyGenerationError(error)

    console.error(`[generateArticle:${requestId}] failed at ${stage}`, {
      status: classified.status,
      message: classified.message,
    })

    return json(
      {
        error: classified.message,
        requestId,
        stage,
      },
      {
        status: classified.status,
        headers: buildTraceHeaders(requestId),
      },
    )
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/fetchSubs' && request.method === 'POST') {
      return handleFetchSubs(request)
    }

    if (url.pathname === '/api/generateArticle' && request.method === 'POST') {
      return handleGenerateArticle(request, env)
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'Not found.' }, { status: 404 })
    }

    const assetResponse = await env.ASSETS.fetch(request)

    if (assetResponse.status !== 404) {
      return assetResponse
    }

    return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request))
  },
}
