import { handleFetchSubs } from './handlers/fetchSubs'
import { handleGenerateArticle } from './handlers/generateArticle'
import { json } from './lib/http'
import type { Env } from './types'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/fetchSubs' && request.method === 'POST') {
      return handleFetchSubs(request)
    }

    if (url.pathname === '/api/generateArticle' && request.method === 'POST') {
      return handleGenerateArticle(request, env)
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
