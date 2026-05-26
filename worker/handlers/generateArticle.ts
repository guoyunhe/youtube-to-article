import { parseGenerateArticleRequest } from '../lib/body'
import { generateArticleFromTranscript } from '../lib/gemini'
import { buildTraceHeaders, classifyGenerationError, json } from '../lib/http'
import type { Env } from '../types'

export async function handleGenerateArticle(request: Request, env: Env): Promise<Response> {
  const requestId = crypto.randomUUID()
  let stage = 'parseGenerateArticleRequest'

  console.log(`[generateArticle:${requestId}] start`)

  try {
    const body = await parseGenerateArticleRequest(request)

    stage = 'generateArticle'
    const result = await generateArticleFromTranscript(env, body.options, body.transcript)
    console.log(`[generateArticle:${requestId}] success`)

    return json(result, {
      headers: buildTraceHeaders(requestId),
    })
  } catch (error) {
    const classified = classifyGenerationError(error)

    console.error(`[generateArticle:${requestId}] failed at ${stage}`, {
      status: classified.status,
      message: classified.message,
    })

    return json(
      {
        error: classified.message,
        requestId,
        stage,
      },
      {
        status: classified.status,
        headers: buildTraceHeaders(requestId),
      },
    )
  }
}
