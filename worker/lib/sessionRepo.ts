import type { Env, SessionRecord, SessionSection } from '../types'

type SessionRow = {
  id: string
  youtube_url: string
  video_id: string | null
  status: SessionRecord['status']
  options_json: string
  transcript: string | null
  transcript_preview: string | null
  captions_json: string | null
  title: string | null
  error: string | null
  created_at: string
  updated_at: string
}

type SectionRow = {
  id: string
  parent_id: string | null
  depth: number
  position: number
  title: string
  content: string
  summary: string | null
}

type SectionInsertRow = {
  id: string
  parentId: string | null
  depth: number
  position: number
  title: string
  content: string
  summary: string | null
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

function normalizeSectionTitle(raw: string): string {
  const normalized = raw.trim().replace(/\s+/g, ' ')
  return normalized.length > 0 ? normalized : 'Untitled Section'
}

function buildSectionRowsFromArticle(article: string): SectionInsertRow[] {
  const lines = article.split(/\r?\n/)
  const headingPattern = /^(#{1,6})\s+(.+)$/

  const sections: Array<{
    id: string
    parentId: string | null
    depth: number
    position: number
    title: string
    contentLines: string[]
  }> = []
  const stack: Array<{ id: string; level: number }> = []

  let position = 1
  let currentSectionId: string | null = null

  const createSection = (title: string, level: number): string => {
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop()
    }

    const id = `sec-${position}`
    const parentId = stack.length > 0 ? stack[stack.length - 1].id : null

    sections.push({
      id,
      parentId,
      depth: level,
      position,
      title: normalizeSectionTitle(title),
      contentLines: [],
    })

    stack.push({ id, level })
    currentSectionId = id
    position += 1
    return id
  }

  for (const line of lines) {
    const headingMatch = line.match(headingPattern)

    if (headingMatch) {
      createSection(headingMatch[2], headingMatch[1].length)
      continue
    }

    if (!currentSectionId) {
      createSection('Introduction', 1)
    }

    const current = sections.find((item) => item.id === currentSectionId)

    if (current) {
      current.contentLines.push(line)
    }
  }

  if (sections.length === 0) {
    return []
  }

  return sections.map((section) => ({
    id: section.id,
    parentId: section.parentId,
    depth: section.depth,
    position: section.position,
    title: section.title,
    content: section.contentLines.join('\n').trim(),
    summary: null,
  }))
}

function mapSectionRowsToTree(rows: SectionRow[]): SessionSection[] {
  const byId = new Map<string, SessionSection>()
  const roots: SessionSection[] = []

  for (const row of rows) {
    byId.set(row.id, {
      id: row.id,
      parentId: row.parent_id,
      depth: row.depth,
      position: row.position,
      title: row.title,
      content: row.content,
      summary: row.summary ?? undefined,
      children: [],
    })
  }

  for (const row of rows) {
    const node = byId.get(row.id)

    if (!node) {
      continue
    }

    if (row.parent_id && byId.has(row.parent_id)) {
      byId.get(row.parent_id)?.children.push(node)
      continue
    }

    roots.push(node)
  }

  return roots
}

function composeArticleFromSectionRows(rows: SectionRow[]): string | undefined {
  if (rows.length === 0) {
    return undefined
  }

  const blocks = rows.map((row) => {
    const headingLevel = Math.min(Math.max(row.depth, 1), 6)
    const heading = `${'#'.repeat(headingLevel)} ${row.title}`
    const content = row.content.trim()
    return content ? `${heading}\n${content}` : heading
  })

  return blocks.join('\n')
}

async function replaceSessionSections(env: Env, sessionId: string, article: string | undefined): Promise<void> {
  await env.DB.prepare('DELETE FROM sections WHERE session_id = ?').bind(sessionId).run()

  if (!article || !article.trim()) {
    return
  }

  const rows = buildSectionRowsFromArticle(article.trim())
  const now = new Date().toISOString()

  for (const row of rows) {
    await env.DB.prepare(
      `INSERT INTO sections (
        id,
        session_id,
        parent_id,
        depth,
        position,
        title,
        content,
        summary,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        `${sessionId}:${row.id}`,
        sessionId,
        row.parentId ? `${sessionId}:${row.parentId}` : null,
        row.depth,
        row.position,
        row.title,
        row.content,
        row.summary,
        now,
        now,
      )
      .run()
  }
}

async function getSessionSectionsAndArticle(
  env: Env,
  sessionId: string,
): Promise<{ sections: SessionSection[]; article: string | undefined }> {
  const result = await env.DB.prepare(
    `SELECT
      id,
      parent_id,
      depth,
      position,
      title,
      content,
      summary
    FROM sections
    WHERE session_id = ?
    ORDER BY position ASC`,
  )
    .bind(sessionId)
    .all<SectionRow>()

  const rows = result.results ?? []

  return {
    sections: mapSectionRowsToTree(rows),
    article: composeArticleFromSectionRows(rows),
  }
}

function buildSectionSummarySource(
  rows: SectionRow[],
  sectionId: string,
): { title: string; content: string } | null {
  const byId = new Map(rows.map((row) => [row.id, row]))
  const root = byId.get(sectionId)

  if (!root) {
    return null
  }

  const isDescendant = (candidate: SectionRow): boolean => {
    if (candidate.id === root.id) {
      return true
    }

    let parentId = candidate.parent_id

    while (parentId) {
      if (parentId === root.id) {
        return true
      }

      parentId = byId.get(parentId)?.parent_id ?? null
    }

    return false
  }

  const baseDepth = root.depth
  const selectedRows = rows.filter(isDescendant)
  const content = selectedRows
    .map((row) => {
      const level = Math.min(Math.max(row.depth - baseDepth + 1, 1), 6)
      const heading = `${'#'.repeat(level)} ${row.title}`
      const body = row.content.trim()
      return body ? `${heading}\n${body}` : heading
    })
    .join('\n\n')

  return {
    title: root.title,
    content,
  }
}

export async function getSectionSummarySourceById(
  env: Env,
  sessionId: string,
  sectionId: string,
): Promise<{ title: string; content: string } | null> {
  const result = await env.DB.prepare(
    `SELECT
      id,
      parent_id,
      depth,
      position,
      title,
      content,
      summary
    FROM sections
    WHERE session_id = ?
    ORDER BY position ASC`,
  )
    .bind(sessionId)
    .all<SectionRow>()

  const rows = result.results ?? []
  return buildSectionSummarySource(rows, sectionId)
}

export async function updateSectionSummaryById(
  env: Env,
  sessionId: string,
  sectionId: string,
  summary: string,
): Promise<boolean> {
  const now = new Date().toISOString()
  const result = await env.DB.prepare(
    `UPDATE sections
    SET summary = ?, updated_at = ?
    WHERE session_id = ? AND id = ?`,
  )
    .bind(summary, now, sessionId, sectionId)
    .run()

  return (result.meta.changes ?? 0) > 0
}

function toSessionRecord(row: SessionRow, sections: SessionSection[], article?: string): SessionRecord {
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
    article,
    sections,
    title: row.title ?? undefined,
    error: row.error ?? undefined,
  }
}

export async function upsertSession(env: Env, session: SessionRecord): Promise<void> {
  const normalizedError = session.status === 'completed' ? null : session.error ?? null

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
      title,
      error,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      youtube_url = excluded.youtube_url,
      video_id = excluded.video_id,
      status = excluded.status,
      options_json = excluded.options_json,
      transcript = excluded.transcript,
      transcript_preview = excluded.transcript_preview,
      captions_json = excluded.captions_json,
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
      session.title ?? null,
      normalizedError,
      session.createdAt,
      session.updatedAt,
    )
    .run()

  await replaceSessionSections(env, session.id, session.article)
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

  const payload = await getSessionSectionsAndArticle(env, sessionId)
  return toSessionRecord(row, payload.sections, payload.article)
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

  const rows = result.results ?? []
  const sessions = await Promise.all(
    rows.map(async (row) => {
      const payload = await getSessionSectionsAndArticle(env, row.id)
      return toSessionRecord(row, payload.sections, payload.article)
    }),
  )

  return sessions
}

export async function deleteSessionById(env: Env, sessionId: string): Promise<boolean> {
  await env.DB.prepare('DELETE FROM sections WHERE session_id = ?').bind(sessionId).run()
  const result = await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run()
  return (result.meta.changes ?? 0) > 0
}
