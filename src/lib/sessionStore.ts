import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { SessionRecord } from '../types'

interface YouTubeToArticleDb extends DBSchema {
  sessions: {
    key: string
    value: SessionRecord
    indexes: {
      'by-updatedAt': string
    }
  }
}

const dbPromise = openDB<YouTubeToArticleDb>('youtube-to-article', 1, {
  upgrade(db) {
    const store = db.createObjectStore('sessions', {
      keyPath: 'id',
    })

    store.createIndex('by-updatedAt', 'updatedAt')
  },
})

async function getDb(): Promise<IDBPDatabase<YouTubeToArticleDb>> {
  return dbPromise
}

export async function saveSession(session: SessionRecord): Promise<void> {
  const db = await getDb()
  await db.put('sessions', session)
}

export async function getSession(id: string): Promise<SessionRecord | undefined> {
  const db = await getDb()
  return db.get('sessions', id)
}

export async function listSessions(limit = 8): Promise<SessionRecord[]> {
  const db = await getDb()
  const sessions = await db.getAllFromIndex('sessions', 'by-updatedAt')

  return sessions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, limit)
}
