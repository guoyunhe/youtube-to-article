import { afterEach, describe, expect, it } from 'vitest'
import { cleanupWorkerTestGlobals, postJson, request } from './helpers/workerTestUtils'

afterEach(() => {
  cleanupWorkerTestGlobals()
})

describe('sessions API', () => {
  it('can create, patch, list, get and delete a session', async () => {
    const createResponse = await postJson('/api/sessions', {
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoId: 'dQw4w9WgXcQ',
      status: 'queued',
      options: {
        taskType: 'summary',
        outputStyle: 'professional',
        targetReaders: 'beginners',
        outputLanguage: 'en',
        customPrompt: 'focus on key points',
      },
    })

    expect(createResponse.status).toBe(201)
    const created = (await createResponse.json()) as { id: string }
    expect(created.id.length).toBeGreaterThan(0)

    const patchResponse = await request(`/api/sessions/${created.id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        patch: {
          status: 'completed',
          transcript: 'full transcript',
          transcriptPreview: 'preview',
          captions: [{ startMs: 0, durationMs: 1000, text: 'hello' }],
          article: 'generated article body',
          title: 'generated article title',
        },
      }),
    })
    expect(patchResponse.status).toBe(200)

    const listResponse = await request('/api/sessions?limit=8', {
      method: 'GET',
    })
    expect(listResponse.status).toBe(200)
    const listPayload = (await listResponse.json()) as { sessions: Array<{ id: string }> }
    expect(listPayload.sessions.map((item) => item.id)).toContain(created.id)

    const getResponse = await request(`/api/sessions/${created.id}`, {
      method: 'GET',
    })
    expect(getResponse.status).toBe(200)
    const getPayload = (await getResponse.json()) as {
      id: string
      transcript?: string
      article?: string
      options: { customPrompt: string }
      captions?: Array<{ text: string }>
    }
    expect(getPayload.id).toBe(created.id)
    expect(getPayload.transcript).toBe('full transcript')
    expect(getPayload.article).toBe('generated article body')
    expect(getPayload.options.customPrompt).toBe('focus on key points')
    expect(getPayload.captions?.[0]?.text).toBe('hello')

    const deleteResponse = await request(`/api/sessions/${created.id}`, {
      method: 'DELETE',
    })
    expect(deleteResponse.status).toBe(200)

    const notFoundAfterDeleteResponse = await request(`/api/sessions/${created.id}`, {
      method: 'GET',
    })
    expect(notFoundAfterDeleteResponse.status).toBe(404)
  })
})
