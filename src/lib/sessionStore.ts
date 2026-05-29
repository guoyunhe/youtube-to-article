import type { SessionRecord } from '../types'

type ErrorPayload = {
  error?: string
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text()

  if (!text.trim()) {
    throw new Error('Empty response from session API.')
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('Malformed JSON response from session API.')
  }
}

async function assertOk(response: Response): Promise<void> {
  if (response.ok) {
    return
  }

  const payload = await parseJson<ErrorPayload>(response)
  throw new Error(payload.error ?? 'Session API request failed.')
}

export async function saveSession(session: SessionRecord): Promise<void> {
  const response = await fetch('/api/sessions/upsert', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ session }),
  })

  await assertOk(response)
}

export async function createSession(input: {
  youtubeUrl: string
  videoId: string | null
  status: SessionRecord['status']
  options: SessionRecord['options']
}): Promise<SessionRecord> {
  const response = await fetch('/api/sessions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  await assertOk(response)
  return parseJson<SessionRecord>(response)
}

export async function patchSession(
  id: string,
  patch: Partial<Omit<SessionRecord, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<SessionRecord> {
  const response = await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ patch }),
  })

  await assertOk(response)
  return parseJson<SessionRecord>(response)
}

export async function getSession(id: string): Promise<SessionRecord | undefined> {
  const response = await fetch(`/api/sessions/${encodeURIComponent(id)}`)

  if (response.status === 404) {
    return undefined
  }

  await assertOk(response)
  return parseJson<SessionRecord>(response)
}

export async function deleteSession(id: string): Promise<void> {
  const response = await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })

  if (response.status === 404) {
    return
  }

  await assertOk(response)
}

export async function listSessions(limit = 8): Promise<SessionRecord[]> {
  const response = await fetch(`/api/sessions?limit=${encodeURIComponent(String(limit))}`)

  await assertOk(response)

  const payload = await parseJson<{ sessions: SessionRecord[] }>(response)
  return payload.sessions
}

export async function summarizeSection(sessionId: string, sectionId: string): Promise<SessionRecord> {
  const response = await fetch(
    `/api/sessions/${encodeURIComponent(sessionId)}/sections/${encodeURIComponent(sectionId)}/summarize`,
    {
      method: 'POST',
    },
  )

  await assertOk(response)
  return parseJson<SessionRecord>(response)
}
