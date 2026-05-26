const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
}

export function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...(init?.headers ?? {}),
    },
  })
}

export function classifyGenerationError(error: unknown): { status: number; message: string } {
  const message = error instanceof Error ? error.message : 'Unexpected generation error.'

  if (
    message === 'Request body must be valid JSON.' ||
    message === 'A valid YouTube URL is required.' ||
    message === 'A valid transcript is required.' ||
    message === 'Generation options are required.' ||
    message === 'Please provide a valid YouTube URL.'
  ) {
    return { status: 400, message }
  }

  if (
    message === 'No captions were found for this video.' ||
    message === 'Unable to parse the caption track.' ||
    message === 'The caption track did not contain readable transcript text.'
  ) {
    return { status: 422, message }
  }

  if (message.startsWith('Gemini request failed:')) {
    return { status: 502, message }
  }

  return { status: 500, message }
}

export function buildTraceHeaders(requestId: string): HeadersInit {
  return {
    'x-request-id': requestId,
  }
}
