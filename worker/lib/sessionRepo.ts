import type { Env, SessionRecord } from '../types'

type SessionRow = {
  id: string
  youtube_url: string
  video_id: string | null
  status: SessionRecord['status']
  options_json: string
  transcript: string | null
  transcript_preview: string | null
  captions_json: string | null
  article: string | null
  title: string | null
  error: string | null
  created_at: string
  updated_at: string
}

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function toSessionRecord(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    youtubeUrl: row.youtube_url,
    videoId: row.video_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    options: safeParseJson(row.options_json, {
      taskType: 'summary',
      outputStyle: 'professional',
      targetReaders: 'beginners',
      outputLanguage: 'en',
      customPrompt: '',
    }),
    transcript: row.transcript ?? undefined,
    transcriptPreview: row.transcript_preview ?? undefined,
    captions: safeParseJson(row.captions_json, undefined),
    article: row.article ?? undefined,
    title: row.title ?? undefined,
    error: row.error ?? undefined,
  }
}

export async function upsertSession(env: Env, session: SessionRecord): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO sessions (
      id,
      youtube_url,
      video_id,
      status,
      options_json,
      transcript,
      transcript_preview,
      captions_json,
      article,
      title,
      error,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      youtube_url = excluded.youtube_url,
      video_id = excluded.video_id,
      status = excluded.status,
      options_json = excluded.options_json,
      transcript = excluded.transcript,
      transcript_preview = excluded.transcript_preview,
      captions_json = excluded.captions_json,
      article = excluded.article,
      title = excluded.title,
      error = excluded.error,
      updated_at = excluded.updated_at`,
  )
    .bind(
      session.id,
      session.youtubeUrl,
      session.videoId,
      session.status,
      JSON.stringify(session.options),
      session.transcript ?? null,
      session.transcriptPreview ?? null,
      session.captions ? JSON.stringify(session.captions) : null,
      session.article ?? null,
      session.title ?? null,
      session.error ?? null,
      session.createdAt,
      session.updatedAt,
    )
    .run()
}

export async function getSessionById(env: Env, sessionId: string): Promise<SessionRecord | null> {
  const row = await env.DB.prepare(
    `SELECT
      id,
      youtube_url,
      video_id,
      status,
      options_json,
      transcript,
      transcript_preview,
      captions_json,
      article,
      title,
      error,
      created_at,
      updated_at
    FROM sessions
    WHERE id = ?`,
  )
    .bind(sessionId)
    .first<SessionRow>()

  if (!row) {
    return null
  }

  return toSessionRecord(row)
}

export async function listRecentSessions(env: Env, limit: number): Promise<SessionRecord[]> {
  const result = await env.DB.prepare(
    `SELECT
      id,
      youtube_url,
      video_id,
      status,
      options_json,
      transcript,
      transcript_preview,
      captions_json,
      article,
      title,
      error,
      created_at,
      updated_at
    FROM sessions
    ORDER BY updated_at DESC
    LIMIT ?`,
  )
    .bind(limit)
    .all<SessionRow>()

  return (result.results ?? []).map(toSessionRecord)
}

export async function deleteSessionById(env: Env, sessionId: string): Promise<boolean> {
  const result = await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run()
  return (result.meta.changes ?? 0) > 0
}
