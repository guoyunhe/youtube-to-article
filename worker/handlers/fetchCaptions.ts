import { parseFetchCaptionsRequest } from '../lib/body'
import { buildTraceHeaders, classifyGenerationError, json } from '../lib/http'
import { fetchCaptions } from '../lib/youtube'

export async function handleFetchCaptions(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID()
  let stage = 'parseFetchCaptionsRequest'

  console.log(`[fetchCaptions:${requestId}] start`)

  try {
    const body = await parseFetchCaptionsRequest(request)
    stage = 'extractVideoId'
    stage = 'fetchTranscript'
    const result = await fetchCaptions(body.youtubeUrl)

    console.log(`[fetchCaptions:${requestId}] success`)

    return json(result, {
      headers: buildTraceHeaders(requestId),
    })
  } catch (error) {
    const classified = classifyGenerationError(error)

    console.error(`[fetchCaptions:${requestId}] failed at ${stage}`, {
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
