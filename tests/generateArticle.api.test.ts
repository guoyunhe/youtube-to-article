import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupWorkerTestGlobals, postJson } from './helpers/workerTestUtils'

afterEach(() => {
  cleanupWorkerTestGlobals()
})

describe('generateArticle API', () => {
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
