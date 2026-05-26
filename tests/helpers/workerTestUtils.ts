import { vi } from 'vitest'
import worker from '../../worker/index'

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

export function cleanupWorkerTestGlobals(): void {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
}
