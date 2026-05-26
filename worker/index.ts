interface Env {
  AI_MODEL?: string
  ASSETS: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  }
  GEMINI_API_KEY?: string
}

interface GenerationRequestBody {
  youtubeUrl: string
  options: {
    taskType: string
    outputStyle: string
    targetReaders: string
    outputLanguage: 'en' | 'zh'
  }
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

async function parseRequest(request: Request): Promise<GenerationRequestBody> {
  let body: Partial<GenerationRequestBody>

  try {
    body = (await request.json()) as Partial<GenerationRequestBody>
  } catch {
    throw new Error('Request body must be valid JSON.')
  }

  if (!body.youtubeUrl || typeof body.youtubeUrl !== 'string') {
    throw new Error('A valid YouTube URL is required.')
  }

  if (!body.options) {
    throw new Error('Generation options are required.')
  }

  return {
    youtubeUrl: body.youtubeUrl.trim(),
    options: {
      taskType: String(body.options.taskType ?? 'summary'),
      outputStyle: String(body.options.outputStyle ?? 'professional'),
      targetReaders: String(body.options.targetReaders ?? 'beginners'),
      outputLanguage: body.options.outputLanguage === 'zh' ? 'zh' : 'en',
    },
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

function buildPrompt(body: GenerationRequestBody, transcript: string): string {
  const languageInstruction =
    body.options.outputLanguage === 'zh'
      ? 'Write the response in Simplified Chinese.'
      : 'Write the response in English.'

  return `
You are generating an article from a YouTube video transcript.

Requirements:
- Task type: ${body.options.taskType}
- Output style: ${body.options.outputStyle}
- Target readers: ${body.options.targetReaders}
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

async function generateArticle(env: Env, body: GenerationRequestBody) {
  if (!env.GEMINI_API_KEY) {
    throw new Error('The GEMINI_API_KEY Worker secret is not configured.')
  }

  const videoId = extractVideoId(body.youtubeUrl)

  if (!videoId) {
    throw new Error('Please provide a valid YouTube URL.')
  }

  const transcript = await fetchTranscript(videoId)
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
                text: buildPrompt(body, transcript),
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
    // Short preview for the session page so local history stays readable without storing the full transcript twice.
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

async function handleGenerate(request: Request, env: Env): Promise<Response> {
  const requestId = crypto.randomUUID()
  let stage = 'parseRequest'

  console.log(`[generate:${requestId}] start`)

  try {
    const body = await parseRequest(request)
    stage = 'extractVideoId'
    const videoId = extractVideoId(body.youtubeUrl)

    if (!videoId) {
      return json(
        {
          error: 'Please provide a valid YouTube URL.',
          requestId,
          stage,
        },
        {
          status: 400,
          headers: {
            'x-request-id': requestId,
          },
        },
      )
    }

    stage = 'generateArticle'
    const result = await generateArticle(env, body)
    console.log(`[generate:${requestId}] success`)

    return json(result, {
      headers: {
        'x-request-id': requestId,
      },
    })
  } catch (error) {
    const classified = classifyGenerationError(error)

    console.error(`[generate:${requestId}] failed at ${stage}`, {
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
        headers: {
          'x-request-id': requestId,
        },
      },
    )
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/generate' && request.method === 'POST') {
      return handleGenerate(request, env)
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
