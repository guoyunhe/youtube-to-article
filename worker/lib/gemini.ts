import { GoogleGenAI } from '@google/genai'
import type { Env, GenerationOptions } from '../types'

function buildPrompt(options: GenerationOptions, transcript: string): string {
  const languageInstruction =
    options.outputLanguage === 'zh'
      ? 'Write the response in Simplified Chinese.'
      : 'Write the response in English.'
  const customPromptInstruction = options.customPrompt
    ? `- Additional user instructions: ${options.customPrompt}`
    : ''

  return `
You are generating an article from a YouTube video transcript.

Requirements:
- Task type: ${options.taskType}
- Output style: ${options.outputStyle}
- Target readers: ${options.targetReaders}
- ${languageInstruction}
${customPromptInstruction}
- Produce a clear title on the first line.
- Then write a polished article with sections, short paragraphs, and actionable takeaways.
- Base the article only on the transcript content. If something is unclear, acknowledge uncertainty instead of inventing details.

Transcript:
${transcript}
  `.trim()
}

function createGeminiClient(env: Env): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: env.GEMINI_API_KEY,
    httpOptions: {
      apiVersion: 'v1beta',
    },
  })
}

function buildGenerateParams(model: string, options: GenerationOptions, transcript: string) {
  return {
    model,
    contents: [
      {
        parts: [
          {
            text: buildPrompt(options, transcript),
          },
        ],
      },
    ],
  }
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
  const ai = createGeminiClient(env)
  const model = env.AI_MODEL || 'gemini-2.0-flash'

  const response = await ai.models.generateContent(buildGenerateParams(model, options, transcript))
  const article = response.text?.trim()

  if (!article) {
    throw new Error('Gemini returned an empty response.')
  }

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
  const ai = createGeminiClient(env)
  const model = env.AI_MODEL || 'gemini-2.0-flash'

  const stream = await ai.models.generateContentStream(buildGenerateParams(model, options, transcript))

  for await (const chunkResponse of stream) {
    const chunk = chunkResponse.text ?? ''

    if (chunk) {
      yield chunk
    }
  }
}
