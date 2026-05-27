import { parseGenerateArticleRequest } from '../lib/body'
import {
  assertGeminiConfigured,
  deriveTitle,
  generateArticleStreamFromTranscript,
} from '../lib/gemini'
import { buildTraceHeaders, classifyGenerationError, json } from '../lib/http'
import type { Env } from '../types'

type GenerateArticleStreamEvent =
  | { type: 'delta'; chunk: string }
  | { type: 'done'; title: string }
  | { type: 'error'; error: string }

export async function handleGenerateArticle(request: Request, env: Env): Promise<Response> {
  const requestId = crypto.randomUUID()
  let stage = 'parseGenerateArticleRequest'
  const encoder = new TextEncoder()

  console.log(`[generateArticle:${requestId}] start`)

  try {
    const body = await parseGenerateArticleRequest(request)
    stage = 'generateArticle'
    assertGeminiConfigured(env)

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let article = ''

        try {
          for await (const chunk of generateArticleStreamFromTranscript(env, body.options, body.transcript)) {
            article += chunk

            const event: GenerateArticleStreamEvent = { type: 'delta', chunk }
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
          }

          const normalizedArticle = article.trim()

          if (!normalizedArticle) {
            throw new Error('Gemini returned an empty response.')
          }

          const doneEvent: GenerateArticleStreamEvent = {
            type: 'done',
            title: deriveTitle(normalizedArticle),
          }
          controller.enqueue(encoder.encode(`${JSON.stringify(doneEvent)}\n`))
          controller.close()

          console.log(`[generateArticle:${requestId}] success`)
        } catch (error) {
          const classified = classifyGenerationError(error)

          console.error(`[generateArticle:${requestId}] stream failed at ${stage}`, {
            status: classified.status,
            message: classified.message,
          })

          const errorEvent: GenerateArticleStreamEvent = {
            type: 'error',
            error: classified.message,
          }
          controller.enqueue(encoder.encode(`${JSON.stringify(errorEvent)}\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'cache-control': 'no-store',
        'content-type': 'application/x-ndjson; charset=utf-8',
        ...buildTraceHeaders(requestId),
      },
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
