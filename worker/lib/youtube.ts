interface CaptionTrack {
  baseUrl: string
  languageCode?: string
  kind?: string
}

const youtubeHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com'])
const shortHosts = new Set(['youtu.be', 'www.youtu.be'])

export function extractVideoId(input: string): string | null {
  try {
    const url = new URL(input.trim())
    const hostname = url.hostname.toLowerCase()

    if (youtubeHosts.has(hostname)) {
      if (url.pathname === '/watch') {
        return url.searchParams.get('v')
      }

      if (url.pathname.startsWith('/shorts/')) {
        return url.pathname.split('/')[2] ?? null
      }
    }

    if (shortHosts.has(hostname)) {
      return url.pathname.replaceAll('/', '') || null
    }
  } catch {
    return null
  }

  return null
}

function extractCaptionTracks(html: string): CaptionTrack[] {
  const directMatch = html.match(/"captionTracks":(\[[\s\S]*?\])/)
  const escapedMatch = html.match(/\\"captionTracks\\":(\[[\s\S]*?\])/)
  const rawTracks = directMatch?.[1] ?? escapedMatch?.[1]?.replace(/\\"/g, '"')

  if (!rawTracks) {
    return []
  }

  try {
    return JSON.parse(rawTracks) as CaptionTrack[]
  } catch {
    return []
  }
}

function extractTranscript(payload: unknown): string {
  const transcriptChunks = (
    payload as {
      events?: Array<{
        segs?: Array<{ utf8?: string }>
      }>
    }
  ).events
    ?.flatMap((event) => event.segs ?? [])
    .map((segment) => segment.utf8?.trim() ?? '')
    .filter(Boolean)

  return transcriptChunks?.join(' ').replace(/\s+/g, ' ').trim() ?? ''
}

async function fetchTranscript(videoId: string): Promise<string> {
  const watchResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    headers: {
      'accept-language': 'en-US,en;q=0.9',
      'user-agent':
        'Mozilla/5.0 (compatible; YouTubeToArticleBot/1.0; +https://workers.dev)',
    },
  })

  if (!watchResponse.ok) {
    throw new Error('Unable to fetch the YouTube watch page.')
  }

  const watchHtml = await watchResponse.text()
  const captionTracks = extractCaptionTracks(watchHtml)

  if (captionTracks.length === 0) {
    throw new Error('No captions were found for this video.')
  }

  const selectedTrack =
    captionTracks.find((track) => track.languageCode?.startsWith('en') && track.kind !== 'asr') ??
    captionTracks.find((track) => track.languageCode?.startsWith('en')) ??
    captionTracks[0]

  const transcriptUrl = new URL(selectedTrack.baseUrl)
  transcriptUrl.searchParams.set('fmt', 'json3')

  const transcriptResponse = await fetch(transcriptUrl)

  if (!transcriptResponse.ok) {
    throw new Error('Unable to fetch the caption track.')
  }

  const transcript = extractTranscript(await transcriptResponse.json())

  if (!transcript) {
    throw new Error('The caption track did not contain readable transcript text.')
  }

  // Keep the transcript comfortably under large-model prompt limits while preserving enough context.
  return transcript.slice(0, 24000)
}

export async function fetchSubs(youtubeUrl: string) {
  const videoId = extractVideoId(youtubeUrl)

  if (!videoId) {
    throw new Error('Please provide a valid YouTube URL.')
  }

  const transcript = await fetchTranscript(videoId)

  return {
    transcript,
    transcriptPreview: transcript.slice(0, 800),
    videoId,
  }
}
