import type { SessionRecord, SessionSection } from '../../types'
import type { GenerationStage } from './sessionGeneration'

type SessionPatch = Partial<Omit<SessionRecord, 'id' | 'createdAt' | 'updatedAt'>>

export type StageErrorMap = Partial<Record<GenerationStage, string>>
export type ContentTab = 'captions' | 'article'

export function normalizePatchForUi(patch: SessionPatch): SessionPatch {
  if (!patch.status || patch.status === 'failed') {
    return patch
  }

  return {
    ...patch,
    error: undefined,
  }
}

export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function buildYouTubeTimestampUrl(videoId: string, startMs: number): string {
  const seconds = Math.max(0, Math.floor(startMs / 1000))
  return `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`
}

export function flattenSections(sections: SessionSection[]): SessionSection[] {
  const flat: SessionSection[] = []

  const visit = (nodes: SessionSection[]) => {
    for (const node of nodes) {
      flat.push(node)

      if (node.children.length > 0) {
        visit(node.children)
      }
    }
  }

  visit(sections)
  return flat.sort((left, right) => left.position - right.position)
}
