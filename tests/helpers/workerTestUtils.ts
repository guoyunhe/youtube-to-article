import { vi } from 'vitest'
import worker from '../../worker/index'

type StoredSessionRow = {
  id: string
  youtube_url: string
  video_id: string | null
  status: string
  options_json: string
  transcript: string | null
  transcript_preview: string | null
  captions_json: string | null
  title: string | null
  error: string | null
  created_at: string
  updated_at: string
}

type StoredSectionRow = {
  id: string
  session_id: string
  parent_id: string | null
  depth: number
  position: number
  title: string
  content: string
  summary: string | null
  created_at: string
  updated_at: string
}

type TestEnv = {
  AI_MODEL?: string
  ASSETS: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  }
  DB: D1Database
  GEMINI_API_KEY?: string
}

class InMemoryD1 {
  private sessions = new Map<string, StoredSessionRow>()
  private sections = new Map<string, StoredSectionRow>()

  reset() {
    this.sessions.clear()
    this.sections.clear()
  }

  prepare(query: string) {
    const normalized = query.trim().replace(/\s+/g, ' ').toLowerCase()

    return {
      bind: (...params: unknown[]) => ({
        run: async () => {
          if (normalized.includes('insert into sessions')) {
            const row: StoredSessionRow = {
              id: String(params[0]),
              youtube_url: String(params[1]),
              video_id: (params[2] as string | null) ?? null,
              status: String(params[3]),
              options_json: String(params[4]),
              transcript: (params[5] as string | null) ?? null,
              transcript_preview: (params[6] as string | null) ?? null,
              captions_json: (params[7] as string | null) ?? null,
              title: (params[8] as string | null) ?? null,
              error: (params[9] as string | null) ?? null,
              created_at: String(params[10]),
              updated_at: String(params[11]),
            }
            this.sessions.set(row.id, row)
            return { meta: { changes: 1 } }
          }

          if (normalized.includes('insert into sections')) {
            const row: StoredSectionRow = {
              id: String(params[0]),
              session_id: String(params[1]),
              parent_id: (params[2] as string | null) ?? null,
              depth: Number(params[3]),
              position: Number(params[4]),
              title: String(params[5]),
              content: String(params[6]),
              summary: (params[7] as string | null) ?? null,
              created_at: String(params[8]),
              updated_at: String(params[9]),
            }
            this.sections.set(row.id, row)
            return { meta: { changes: 1 } }
          }

          if (normalized.startsWith('update sections set summary = ?, updated_at = ? where session_id = ? and id = ?')) {
            const summary = String(params[0])
            const updatedAt = String(params[1])
            const sessionId = String(params[2])
            const sectionId = String(params[3])
            const existing = this.sections.get(sectionId)

            if (!existing || existing.session_id !== sessionId) {
              return { meta: { changes: 0 } }
            }

            this.sections.set(sectionId, {
              ...existing,
              summary,
              updated_at: updatedAt,
            })

            return { meta: { changes: 1 } }
          }

          if (normalized.startsWith('delete from sections where session_id = ?')) {
            const sessionId = String(params[0])
            let deleted = 0

            for (const [id, row] of this.sections.entries()) {
              if (row.session_id === sessionId) {
                this.sections.delete(id)
                deleted += 1
              }
            }

            return { meta: { changes: deleted } }
          }

          if (normalized.startsWith('delete from sessions where id = ?')) {
            const id = String(params[0])
            const existed = this.sessions.delete(id)
            return { meta: { changes: existed ? 1 : 0 } }
          }

          return { meta: { changes: 0 } }
        },
        first: async <T>() => {
          if (normalized.includes('from sessions') && normalized.includes('where id = ?')) {
            const id = String(params[0])
            return (this.sessions.get(id) ?? null) as T | null
          }

          return null as T | null
        },
        all: async <T>() => {
          if (normalized.includes('from sessions') && normalized.includes('order by updated_at desc')) {
            const limit = Number(params[0] ?? 8)
            const rows = Array.from(this.sessions.values())
              .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
              .slice(0, Math.max(1, limit))
            return { results: rows as T[] }
          }

          if (normalized.includes('from sections') && normalized.includes('where session_id = ?')) {
            const sessionId = String(params[0])
            const rows = Array.from(this.sections.values())
              .filter((row) => row.session_id === sessionId)
              .sort((left, right) => left.position - right.position)
            return { results: rows as T[] }
          }

          return { results: [] as T[] }
        },
      }),
    }
  }
}

const sharedDb = new InMemoryD1()

function createEnv(overrides?: Partial<TestEnv>): TestEnv {
  return {
    AI_MODEL: 'gemini-2.0-flash',
    GEMINI_API_KEY: 'test-key',
    ASSETS: {
      fetch: vi.fn(async () => new Response('not found', { status: 404 })),
    },
    DB: (overrides?.DB ?? (sharedDb as unknown as D1Database)) as D1Database,
    ...overrides,
  }
}

export async function postJson(
  path: string,
  body: unknown,
  envOverrides?: Partial<TestEnv>,
): Promise<Response> {
  const request = new Request(`https://unit.test${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return worker.fetch(request, createEnv(envOverrides))
}

export async function postRawJson(
  path: string,
  rawBody: string,
  envOverrides?: Partial<TestEnv>,
): Promise<Response> {
  const request = new Request(`https://unit.test${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: rawBody,
  })

  return worker.fetch(request, createEnv(envOverrides))
}

export async function request(
  path: string,
  init: RequestInit,
  envOverrides?: Partial<TestEnv>,
): Promise<Response> {
  const req = new Request(`https://unit.test${path}`, init)
  return worker.fetch(req, createEnv(envOverrides))
}

export function cleanupWorkerTestGlobals(): void {
  sharedDb.reset()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
}
