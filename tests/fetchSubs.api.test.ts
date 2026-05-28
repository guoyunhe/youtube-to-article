import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupWorkerTestGlobals, postJson, postRawJson } from './helpers/workerTestUtils'

afterEach(() => {
  cleanupWorkerTestGlobals()
})

describe('fetchSubs API', () => {
  it(
    'POST /api/fetchSubs returns transcript from YouTube',
    { timeout: 15000 },
    async () => {
      const externalFetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : String(input)

        if (url === 'https://www.youtube.com/youtubei/v1/player') {
          return new Response(
            JSON.stringify({
              captions: {
                playerCaptionsTracklistRenderer: {
                  captionTracks: [
                    {
                      baseUrl: 'https://example.test/captions?lang=en',
                      languageCode: 'en',
                    },
                  ],
                },
              },
            }),
            {
              status: 200,
              headers: {
                'content-type': 'application/json',
              },
            },
          )
        }

        if (url.startsWith('https://example.test/captions?lang=en&fmt=json3')) {
          return new Response(
            JSON.stringify({
              events: [
                {
                  tStartMs: 0,
                  dDurationMs: 1200,
                  segs: [{ utf8: 'Hello world' }],
                },
                {
                  tStartMs: 1200,
                  dDurationMs: 1200,
                  segs: [{ utf8: 'from test subtitles' }],
                },
              ],
            }),
            {
              status: 200,
              headers: {
                'content-type': 'application/json',
              },
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
        captions: Array<{
          startMs: number
          durationMs: number
          text: string
        }>
        videoId: string
      }

      expect(payload.videoId).toBe('dQw4w9WgXcQ')
      expect(typeof payload.transcript).toBe('string')
      expect(payload.transcript.length).toBeGreaterThan(0)
      expect(typeof payload.transcriptPreview).toBe('string')
      expect(payload.transcriptPreview.length).toBeGreaterThan(0)
      expect(payload.transcriptPreview.length).toBeLessThanOrEqual(800)
      expect(Array.isArray(payload.captions)).toBe(true)
      expect(payload.captions.length).toBeGreaterThan(0)
      expect(typeof payload.captions[0]?.startMs).toBe('number')
      expect(typeof payload.captions[0]?.durationMs).toBe('number')
      expect(typeof payload.captions[0]?.text).toBe('string')
      expect(payload.captions[0]?.text.length).toBeGreaterThan(0)
      expect(externalFetch).toHaveBeenCalledTimes(2)
    },
  )

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
