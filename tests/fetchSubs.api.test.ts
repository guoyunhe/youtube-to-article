import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupWorkerTestGlobals, postJson, postRawJson } from './helpers/workerTestUtils'

afterEach(() => {
  cleanupWorkerTestGlobals()
})

describe('fetchSubs API', () => {
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
})
