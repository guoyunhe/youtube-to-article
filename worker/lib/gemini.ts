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

function deriveTitle(article: string): string {
  return article.split('\n')[0]?.replace(/^#+\s*/, '').trim() || 'Generated article'
}

export async function generateArticleFromTranscript(
  env: Env,
  options: GenerationOptions,
  transcript: string,
) {
  if (!env.GEMINI_API_KEY) {
    throw new Error('The GEMINI_API_KEY Worker secret is not configured.')
  }
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
