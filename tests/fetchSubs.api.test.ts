import { afterEach, describe, expect, it } from 'vitest'
import { cleanupWorkerTestGlobals, postJson, postRawJson } from './helpers/workerTestUtils'

afterEach(() => {
  cleanupWorkerTestGlobals()
})

describe('fetchSubs API', () => {
  it(
    'POST /api/fetchSubs returns transcript from YouTube',
    { timeout: 15000 },
    async () => {
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
