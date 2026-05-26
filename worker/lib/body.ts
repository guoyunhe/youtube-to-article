import type {
  FetchSubsRequestBody,
  GenerateArticleRequestBody,
  GenerationOptions,
} from '../types'

async function parseJsonBody<T>(request: Request): Promise<T> {
  let body: T

  try {
    body = (await request.json()) as T
  } catch {
    throw new Error('Request body must be valid JSON.')
  }

  return body
}

function parseOptions(options: unknown): GenerationOptions {
  if (!options || typeof options !== 'object') {
    throw new Error('Generation options are required.')
  }

  const raw = options as Partial<GenerationOptions>

  return {
    taskType: String(raw.taskType ?? 'summary'),
    outputStyle: String(raw.outputStyle ?? 'professional'),
    targetReaders: String(raw.targetReaders ?? 'beginners'),
    outputLanguage: raw.outputLanguage === 'zh' ? 'zh' : 'en',
  }
}

export async function parseFetchSubsRequest(request: Request): Promise<FetchSubsRequestBody> {
  const body = await parseJsonBody<Partial<FetchSubsRequestBody>>(request)

  if (!body.youtubeUrl || typeof body.youtubeUrl !== 'string') {
    throw new Error('A valid YouTube URL is required.')
  }

  return {
    youtubeUrl: body.youtubeUrl.trim(),
  }
}

export async function parseGenerateArticleRequest(
  request: Request,
): Promise<GenerateArticleRequestBody> {
  const body = await parseJsonBody<Partial<GenerateArticleRequestBody>>(request)

  if (!body.transcript || typeof body.transcript !== 'string' || !body.transcript.trim()) {
    throw new Error('A valid transcript is required.')
  }

  const options = parseOptions(body.options)

  return {
    transcript: body.transcript.trim(),
    options,
  }
}
