import { handleFetchCaptions } from './handlers/fetchCaptions'
import { handleGenerateArticle } from './handlers/generateArticle'
import {
  handleCreateSession,
  handleDeleteSession,
  handleGetSession,
  handleListSessions,
  handlePatchSession,
  handleSaveSession,
  handleSummarizeSection,
} from './handlers/sessions'
import { json } from './lib/http'
import type { Env } from './types'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const sectionSummarizeMatch = url.pathname.match(
      /^\/api\/sessions\/([^/]+)\/sections\/([^/]+)\/summarize$/,
    )
    const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/)

    if (url.pathname === '/api/fetchCaptions' && request.method === 'POST') {
      return handleFetchCaptions(request)
    }

    if (url.pathname === '/api/generateArticle' && request.method === 'POST') {
      return handleGenerateArticle(request, env)
    }

    if (url.pathname === '/api/sessions' && request.method === 'GET') {
      return handleListSessions(request, env)
    }

    if (url.pathname === '/api/sessions' && request.method === 'POST') {
      return handleCreateSession(request, env)
    }

    if (url.pathname === '/api/sessions/upsert' && request.method === 'POST') {
      return handleSaveSession(request, env)
    }

    if (sectionSummarizeMatch && request.method === 'POST') {
      return handleSummarizeSection(
        decodeURIComponent(sectionSummarizeMatch[1]),
        decodeURIComponent(sectionSummarizeMatch[2]),
        env,
      )
    }

    if (sessionMatch && request.method === 'GET') {
      return handleGetSession(sessionMatch[1], env)
    }

    if (sessionMatch && request.method === 'DELETE') {
      return handleDeleteSession(sessionMatch[1], env)
    }

    if (sessionMatch && request.method === 'PATCH') {
      return handlePatchSession(sessionMatch[1], request, env)
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'Not found.' }, { status: 404 })
    }

    const assetResponse = await env.ASSETS.fetch(request)

    if (assetResponse.status !== 404) {
      return assetResponse
    }

    return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request))
  },
}
