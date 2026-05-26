import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from '../worker/index'

type TestEnv = {
  AI_MODEL?: string
  ASSETS: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  }
  GEMINI_API_KEY?: string
}

function createEnv(overrides?: Partial<TestEnv>): TestEnv {
  return {
    AI_MODEL: 'gemini-2.0-flash',
    GEMINI_API_KEY: 'test-key',
    ASSETS: {
      fetch: vi.fn(async () => new Response('not found', { status: 404 })),
    },
    ...overrides,
  }
}

async function postJson(path: string, body: unknown, envOverrides?: Partial<TestEnv>): Promise<Response> {
  const request = new Request(`https://unit.test${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return worker.fetch(request, createEnv(envOverrides))
}

async function postRawJson(path: string, rawBody: string, envOverrides?: Partial<TestEnv>): Promise<Response> {
  const request = new Request(`https://unit.test${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: rawBody,
  })

  return worker.fetch(request, createEnv(envOverrides))
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Worker API', () => {
  it('POST /api/fetchSubs returns transcript payload', async () => {
    const externalFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input)

      if (url.startsWith('https://www.youtube.com/watch')) {
        return new Response(
          '<html>"captionTracks":[{"baseUrl":"https://captions.test/track?lang=en","languageCode":"en"}]</html>',
          { status: 200 },
        )
      }

      if (url.startsWith('https://captions.test/track')) {
        return new Response(
          JSON.stringify({
            events: [
              {
                segs: [{ utf8: 'hello' }, { utf8: 'world' }],
              },
            ],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        )
      }

      throw new Error(`Unexpected external fetch url: ${url}`)
    })

    vi.stubGlobal('fetch', externalFetch)

    const response = await postJson('/api/fetchSubs', {
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    })

    expect(response.status).toBe(200)

    const payload = (await response.json()) as {
      transcript: string
      transcriptPreview: string
      videoId: string
    }

    expect(payload.videoId).toBe('dQw4w9WgXcQ')
    expect(payload.transcript).toContain('hello world')
    expect(payload.transcriptPreview).toContain('hello world')
    expect(externalFetch).toHaveBeenCalledTimes(2)
  })

  it('POST /api/fetchSubs returns 400 for malformed JSON body', async () => {
    const response = await postRawJson('/api/fetchSubs', '{"youtubeUrl":')

    expect(response.status).toBe(400)

    const payload = (await response.json()) as {
      error: string
      stage: string
      requestId: string
    }

    expect(payload.error).toBe('Request body must be valid JSON.')
    expect(payload.stage).toBe('parseFetchSubsRequest')
    expect(payload.requestId.length).toBeGreaterThan(0)
  })

  it('POST /api/generateArticle returns article and title', async () => {
    const externalFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)

      if (url.startsWith('https://generativelanguage.googleapis.com/')) {
        const requestBody = JSON.parse(String(init?.body ?? '{}')) as {
          contents?: Array<{ parts?: Array<{ text?: string }> }>
        }
        const prompt = requestBody.contents?.[0]?.parts?.[0]?.text ?? ''

        expect(prompt).toContain('Transcript:')
        expect(prompt).toContain('test transcript')

        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: '# My Article\nGenerated body paragraph.' }],
                },
              },
            ],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        )
      }

      throw new Error(`Unexpected external fetch url: ${url}`)
    })

    vi.stubGlobal('fetch', externalFetch)

    const response = await postJson('/api/generateArticle', {
      transcript: 'test transcript',
      options: {
        taskType: 'summary',
        outputStyle: 'professional',
        targetReaders: 'beginners',
        outputLanguage: 'en',
      },
    })

    expect(response.status).toBe(200)

    const payload = (await response.json()) as {
      article: string
      title: string
    }

    expect(payload.title).toBe('My Article')
    expect(payload.article).toContain('Generated body paragraph.')
    expect(externalFetch).toHaveBeenCalledTimes(1)
  })

  it('POST /api/generateArticle returns 400 when transcript is missing', async () => {
    const response = await postJson('/api/generateArticle', {
      options: {
        taskType: 'summary',
        outputStyle: 'professional',
        targetReaders: 'beginners',
        outputLanguage: 'en',
      },
    })

    expect(response.status).toBe(400)

    const payload = (await response.json()) as {
      error: string
      stage: string
    }

    expect(payload.error).toBe('A valid transcript is required.')
    expect(payload.stage).toBe('parseGenerateArticleRequest')
  })

  it('POST /api/generateArticle returns 500 when GEMINI_API_KEY is missing', async () => {
    const response = await postJson(
      '/api/generateArticle',
      {
        transcript: 'test transcript',
        options: {
          taskType: 'summary',
          outputStyle: 'professional',
          targetReaders: 'beginners',
          outputLanguage: 'en',
        },
      },
      {
        GEMINI_API_KEY: undefined,
      },
    )

    expect(response.status).toBe(500)

    const payload = (await response.json()) as {
      error: string
      stage: string
    }

    expect(payload.error).toBe('The GEMINI_API_KEY Worker secret is not configured.')
    expect(payload.stage).toBe('generateArticle')
  })
})
