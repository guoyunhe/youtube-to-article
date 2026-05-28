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
          article: '# Intro\nOverview\n## Detail\nDeep dive',
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
      sections?: Array<{
        title: string
        content: string
        children: Array<{ title: string; content: string }>
      }>
      options: { customPrompt: string }
      captions?: Array<{ text: string }>
    }
    expect(getPayload.id).toBe(created.id)
    expect(getPayload.transcript).toBe('full transcript')
    expect(getPayload.article).toBe('# Intro\nOverview\n## Detail\nDeep dive')
    expect(getPayload.sections?.[0]?.title).toBe('Intro')
    expect(getPayload.sections?.[0]?.content).toBe('Overview')
    expect(getPayload.sections?.[0]?.children?.[0]?.title).toBe('Detail')
    expect(getPayload.sections?.[0]?.children?.[0]?.content).toBe('Deep dive')
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

  it('clears error when a failed session is regenerated to completed', async () => {
    const createResponse = await postJson('/api/sessions', {
      youtubeUrl: 'https://www.youtube.com/watch?v=abc123xyz00',
      videoId: 'abc123xyz00',
      status: 'failed',
      options: {
        taskType: 'summary',
        outputStyle: 'professional',
        targetReaders: 'beginners',
        outputLanguage: 'en',
        customPrompt: '',
      },
    })

    expect(createResponse.status).toBe(201)
    const created = (await createResponse.json()) as { id: string }

    const failPatchResponse = await request(`/api/sessions/${created.id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        patch: {
          status: 'failed',
          error: 'temporary upstream error',
        },
      }),
    })
    expect(failPatchResponse.status).toBe(200)

    const completedPatchResponse = await request(`/api/sessions/${created.id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        patch: {
          status: 'completed',
          article: '# Final\nAll good',
          title: 'final title',
        },
      }),
    })
    expect(completedPatchResponse.status).toBe(200)

    const getResponse = await request(`/api/sessions/${created.id}`, {
      method: 'GET',
    })
    expect(getResponse.status).toBe(200)

    const payload = (await getResponse.json()) as {
      status: string
      error?: string
      article?: string
    }

    expect(payload.status).toBe('completed')
    expect(payload.error).toBeUndefined()
    expect(payload.article).toBe('# Final\nAll good')
  })
})
