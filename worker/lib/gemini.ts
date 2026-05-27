import type { Env, GenerationOptions } from '../types'

function buildPrompt(options: GenerationOptions, transcript: string): string {
  const languageInstruction =
    options.outputLanguage === 'zh'
      ? 'Write the response in Simplified Chinese.'
      : 'Write the response in English.'

  return `
You are generating an article from a YouTube video transcript.

Requirements:
- Task type: ${options.taskType}
- Output style: ${options.outputStyle}
- Target readers: ${options.targetReaders}
- ${languageInstruction}
- Produce a clear title on the first line.
- Then write a polished article with sections, short paragraphs, and actionable takeaways.
- Base the article only on the transcript content. If something is unclear, acknowledge uncertainty instead of inventing details.

Transcript:
${transcript}
  `.trim()
}

function extractArticleText(payload: unknown): string {
  const candidates = (payload as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>
      }
    }>
  }).candidates

  const article = candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('\n')
    .trim()

  if (!article) {
    throw new Error('Gemini returned an empty response.')
  }

  return article
}

function extractTextParts(payload: unknown): string {
  const candidates = (payload as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>
      }
    }>
  }).candidates

  return (
    candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('') ?? ''
  )
}

export function deriveTitle(article: string): string {
  return article.split('\n')[0]?.replace(/^#+\s*/, '').trim() || 'Generated article'
}

export function assertGeminiConfigured(env: Env): void {
  if (!env.GEMINI_API_KEY) {
    throw new Error('The GEMINI_API_KEY Worker secret is not configured.')
  }
}

export async function generateArticleFromTranscript(
  env: Env,
  options: GenerationOptions,
  transcript: string,
) {
  assertGeminiConfigured(env)
  const model = env.AI_MODEL || 'gemini-2.0-flash'

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: buildPrompt(options, transcript),
              },
            ],
          },
        ],
      }),
    },
  )

  if (!response.ok) {
    throw new Error(`Gemini request failed: ${await response.text()}`)
  }

  const article = extractArticleText(await response.json())

  return {
    article,
    title: deriveTitle(article),
  }
}

export async function* generateArticleStreamFromTranscript(
  env: Env,
  options: GenerationOptions,
  transcript: string,
): AsyncGenerator<string, void, unknown> {
  assertGeminiConfigured(env)
  const model = env.AI_MODEL || 'gemini-2.0-flash'

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: buildPrompt(options, transcript),
              },
            ],
          },
        ],
      }),
    },
  )

  if (!response.ok) {
    throw new Error(`Gemini request failed: ${await response.text()}`)
  }

  if (!response.body) {
    throw new Error('Gemini returned an empty response stream.')
  }

  const decoder = new TextDecoder()
  const reader = response.body.getReader()
  let pending = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      pending += decoder.decode(value, { stream: true })
      const lines = pending.split('\n')
      pending = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()

        if (!trimmed.startsWith('data:')) {
          continue
        }

        const jsonText = trimmed.slice(5).trim()

        if (!jsonText || jsonText === '[DONE]') {
          continue
        }

        let payload: unknown

        try {
          payload = JSON.parse(jsonText)
        } catch {
          continue
        }

        const chunk = extractTextParts(payload)

        if (chunk) {
          yield chunk
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
