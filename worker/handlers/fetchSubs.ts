import { parseFetchSubsRequest } from '../lib/body'
import { buildTraceHeaders, classifyGenerationError, json } from '../lib/http'
import { fetchSubs } from '../lib/youtube'

export async function handleFetchSubs(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID()
  let stage = 'parseFetchSubsRequest'

  console.log(`[fetchSubs:${requestId}] start`)

  try {
    const body = await parseFetchSubsRequest(request)
    stage = 'extractVideoId'
    stage = 'fetchTranscript'
    const result = await fetchSubs(body.youtubeUrl)

    console.log(`[fetchSubs:${requestId}] success`)

    return json(result, {
      headers: buildTraceHeaders(requestId),
    })
  } catch (error) {
    const classified = classifyGenerationError(error)

    console.error(`[fetchSubs:${requestId}] failed at ${stage}`, {
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
