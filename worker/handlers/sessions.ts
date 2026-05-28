import { buildTraceHeaders, json } from '../lib/http'
import {
  deleteSessionById,
  getSessionById,
  listRecentSessions,
  upsertSession,
} from '../lib/sessionRepo'
import type {
  CreateSessionRequestBody,
  Env,
  PatchSessionRequestBody,
  SaveSessionRequestBody,
  SessionRecord,
} from '../types'

function defaultOptions() {
  return {
    taskType: 'summary',
    outputStyle: 'professional',
    targetReaders: 'beginners',
    outputLanguage: 'en' as const,
    customPrompt: '',
  }
}

function validateSession(session: Partial<SessionRecord>): string | null {
  if (!session.id || typeof session.id !== 'string') {
    return 'A valid session id is required.'
  }

  if (!session.youtubeUrl || typeof session.youtubeUrl !== 'string') {
    return 'A valid YouTube URL is required.'
  }

  if (!session.createdAt || typeof session.createdAt !== 'string') {
    return 'A valid createdAt timestamp is required.'
  }

  if (!session.updatedAt || typeof session.updatedAt !== 'string') {
    return 'A valid updatedAt timestamp is required.'
  }

  if (!session.status || !['queued', 'generating', 'completed', 'failed'].includes(session.status)) {
    return 'A valid session status is required.'
  }

  if (!session.options || typeof session.options !== 'object') {
    return 'Generation options are required.'
  }

  return null
}

async function parseSaveSessionRequest(request: Request): Promise<SessionRecord> {
  let body: SaveSessionRequestBody

  try {
    body = (await request.json()) as SaveSessionRequestBody
  } catch {
    throw new Error('Request body must be valid JSON.')
  }

  const session = body.session
  const error = validateSession(session as Partial<SessionRecord>)

  if (error) {
    throw new Error(error)
  }

  return {
    ...(session as SessionRecord),
    youtubeUrl: session.youtubeUrl.trim(),
  }
}

async function parseCreateSessionRequest(request: Request): Promise<CreateSessionRequestBody> {
  let body: CreateSessionRequestBody

  try {
    body = (await request.json()) as CreateSessionRequestBody
  } catch {
    throw new Error('Request body must be valid JSON.')
  }

  if (!body.youtubeUrl || typeof body.youtubeUrl !== 'string') {
    throw new Error('A valid YouTube URL is required.')
  }

  if (!body.options || typeof body.options !== 'object') {
    throw new Error('Generation options are required.')
  }

  return {
    youtubeUrl: body.youtubeUrl.trim(),
    videoId: typeof body.videoId === 'string' ? body.videoId : null,
    status: body.status,
    options: {
      ...defaultOptions(),
      ...body.options,
      outputLanguage: body.options.outputLanguage === 'zh' ? 'zh' : 'en',
      customPrompt: typeof body.options.customPrompt === 'string' ? body.options.customPrompt : '',
    },
  }
}

async function parsePatchSessionRequest(request: Request): Promise<PatchSessionRequestBody['patch']> {
  let body: PatchSessionRequestBody

  try {
    body = (await request.json()) as PatchSessionRequestBody
  } catch {
    throw new Error('Request body must be valid JSON.')
  }

  const patch = body.patch

  if (!patch || typeof patch !== 'object') {
    throw new Error('A valid patch payload is required.')
  }

  if ('status' in patch && patch.status && !['queued', 'generating', 'completed', 'failed'].includes(patch.status)) {
    throw new Error('A valid session status is required.')
  }

  if ('youtubeUrl' in patch && typeof patch.youtubeUrl !== 'string') {
    throw new Error('A valid YouTube URL is required.')
  }

  return patch
}

export async function handleListSessions(request: Request, env: Env): Promise<Response> {
  const requestId = crypto.randomUUID()

  try {
    const url = new URL(request.url)
    const rawLimit = Number(url.searchParams.get('limit') ?? '8')
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 50) : 8
    const sessions = await listRecentSessions(env, limit)

    return json(
      { sessions },
      {
        headers: buildTraceHeaders(requestId),
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to list sessions.'

    return json(
      {
        error: message,
        requestId,
      },
      {
        status: 500,
        headers: buildTraceHeaders(requestId),
      },
    )
  }
}

export async function handleGetSession(sessionId: string, env: Env): Promise<Response> {
  const requestId = crypto.randomUUID()

  try {
    const session = await getSessionById(env, sessionId)

    if (!session) {
      return json(
        {
          error: 'Session not found.',
          requestId,
        },
        {
          status: 404,
          headers: buildTraceHeaders(requestId),
        },
      )
    }

    return json(session, {
      headers: buildTraceHeaders(requestId),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch session.'

    return json(
      {
        error: message,
        requestId,
      },
      {
        status: 500,
        headers: buildTraceHeaders(requestId),
      },
    )
  }
}

export async function handleSaveSession(request: Request, env: Env): Promise<Response> {
  const requestId = crypto.randomUUID()

  try {
    const session = await parseSaveSessionRequest(request)
    await upsertSession(env, session)

    return json(
      { ok: true },
      {
        headers: buildTraceHeaders(requestId),
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save session.'
    const status =
      message === 'Request body must be valid JSON.' ||
      message === 'A valid session id is required.' ||
      message === 'A valid YouTube URL is required.' ||
      message === 'A valid createdAt timestamp is required.' ||
      message === 'A valid updatedAt timestamp is required.' ||
      message === 'A valid session status is required.' ||
      message === 'Generation options are required.'
        ? 400
        : 500

    return json(
      {
        error: message,
        requestId,
      },
      {
        status,
        headers: buildTraceHeaders(requestId),
      },
    )
  }
}

export async function handleCreateSession(request: Request, env: Env): Promise<Response> {
  const requestId = crypto.randomUUID()

  try {
    const body = await parseCreateSessionRequest(request)
    const now = new Date().toISOString()
    const session: SessionRecord = {
      id: crypto.randomUUID(),
      youtubeUrl: body.youtubeUrl,
      videoId: body.videoId ?? null,
      createdAt: now,
      updatedAt: now,
      status: body.status ?? 'queued',
      options: body.options,
    }

    await upsertSession(env, session)

    return json(session, {
      status: 201,
      headers: buildTraceHeaders(requestId),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create session.'
    const status =
      message === 'Request body must be valid JSON.' ||
      message === 'A valid YouTube URL is required.' ||
      message === 'Generation options are required.'
        ? 400
        : 500

    return json(
      {
        error: message,
        requestId,
      },
      {
        status,
        headers: buildTraceHeaders(requestId),
      },
    )
  }
}

export async function handlePatchSession(
  sessionId: string,
  request: Request,
  env: Env,
): Promise<Response> {
  const requestId = crypto.randomUUID()

  try {
    const existing = await getSessionById(env, sessionId)

    if (!existing) {
      return json(
        {
          error: 'Session not found.',
          requestId,
        },
        {
          status: 404,
          headers: buildTraceHeaders(requestId),
        },
      )
    }

    const patch = await parsePatchSessionRequest(request)
    const mergedOptions = patch.options
      ? {
          ...existing.options,
          ...patch.options,
          outputLanguage: patch.options.outputLanguage === 'zh' ? 'zh' : existing.options.outputLanguage,
          customPrompt:
            typeof patch.options.customPrompt === 'string'
              ? patch.options.customPrompt
              : existing.options.customPrompt,
        }
      : existing.options

    const updated: SessionRecord = {
      ...existing,
      ...patch,
      options: mergedOptions,
      youtubeUrl:
        typeof patch.youtubeUrl === 'string' ? patch.youtubeUrl.trim() : existing.youtubeUrl,
      updatedAt: new Date().toISOString(),
    }

    await upsertSession(env, updated)

    return json(updated, {
      headers: buildTraceHeaders(requestId),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to patch session.'
    const status =
      message === 'Request body must be valid JSON.' ||
      message === 'A valid patch payload is required.' ||
      message === 'A valid session status is required.' ||
      message === 'A valid YouTube URL is required.'
        ? 400
        : 500

    return json(
      {
        error: message,
        requestId,
      },
      {
        status,
        headers: buildTraceHeaders(requestId),
      },
    )
  }
}

export async function handleDeleteSession(sessionId: string, env: Env): Promise<Response> {
  const requestId = crypto.randomUUID()

  try {
    const deleted = await deleteSessionById(env, sessionId)

    if (!deleted) {
      return json(
        {
          error: 'Session not found.',
          requestId,
        },
        {
          status: 404,
          headers: buildTraceHeaders(requestId),
        },
      )
    }

    return json(
      { ok: true },
      {
        headers: buildTraceHeaders(requestId),
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete session.'

    return json(
      {
        error: message,
        requestId,
      },
      {
        status: 500,
        headers: buildTraceHeaders(requestId),
      },
    )
  }
}
