interface CaptionTrack {
  baseUrl: string
  languageCode?: string
  kind?: string | null
}

interface CaptionSegment {
  startMs: number
  durationMs: number
  text: string
}

const youtubeHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com'])
const shortHosts = new Set(['youtu.be', 'www.youtu.be'])
const youtubeVideoIdPattern = /^[A-Za-z0-9_-]{11}$/

function normalizeVideoId(raw: string | null): string | null {
  const candidate = raw?.trim() ?? ''
  return youtubeVideoIdPattern.test(candidate) ? candidate : null
}

export function extractVideoId(input: string): string | null {
  try {
    const url = new URL(input.trim())
    const hostname = url.hostname.toLowerCase()

    if (youtubeHosts.has(hostname)) {
      if (url.pathname === '/watch') {
        return normalizeVideoId(url.searchParams.get('v'))
      }

      if (url.pathname.startsWith('/shorts/')) {
        return normalizeVideoId(url.pathname.split('/')[2] ?? null)
      }
    }

    if (shortHosts.has(hostname)) {
      return normalizeVideoId(url.pathname.replaceAll('/', '') || null)
    }
  } catch {
    return null
  }

  return null
}

function normalizeCaptionText(input: string): string {
  return input.replace(/\s+/g, ' ').trim()
}

function extractCaptionSegments(payload: unknown): CaptionSegment[] {
  const events = (
    payload as {
      events?: Array<{
        tStartMs?: number
        dDurationMs?: number
        segs?: Array<{ utf8?: string }>
      }>
    }
  ).events

  if (!events?.length) {
    return []
  }

  return events
    .map((event) => {
      const text = normalizeCaptionText(
        (event.segs ?? []).map((segment) => segment.utf8 ?? '').join(' '),
      )

      if (!text) {
        return null
      }

      return {
        startMs: Math.max(0, event.tStartMs ?? 0),
        durationMs: Math.max(0, event.dDurationMs ?? 0),
        text,
      }
    })
    .filter((segment): segment is CaptionSegment => Boolean(segment))
}

function buildTranscript(segments: CaptionSegment[]): string {
  return segments.map((segment) => segment.text).join(' ').replace(/\s+/g, ' ').trim()
}

async function fetchTranscript(videoId: string): Promise<{
  transcript: string
  transcriptPreview: string
  captions: CaptionSegment[]
}> {
  // Use the iOS InnerTube client — it returns caption track URLs that don't
  // include the `exp=xpe` experiment flag, which YouTube requires auth to serve.
  const playerResponse = await fetch('https://www.youtube.com/youtubei/v1/player', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept-language': 'en-US,en;q=0.9',
      'user-agent':
        'com.google.ios.youtube/21.02.3 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
      'x-youtube-client-name': '5',
      'x-youtube-client-version': '21.02.3',
    },
    body: JSON.stringify({
      videoId,
      context: {
        client: {
          clientName: 'IOS',
          clientVersion: '21.02.3',
          deviceMake: 'Apple',
          deviceModel: 'iPhone16,2',
          userAgent:
            'com.google.ios.youtube/21.02.3 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
          osName: 'iPhone',
          osVersion: '18.3.2.22D82',
          hl: 'en',
          gl: 'US',
        },
      },
    }),
  })

  if (!playerResponse.ok) {
    throw new Error('Unable to fetch the YouTube player data.')
  }

  const playerJson = (await playerResponse.json()) as {
    captions?: {
      playerCaptionsTracklistRenderer?: {
        captionTracks?: CaptionTrack[]
      }
    }
  }

  const captionTracks =
    playerJson.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []

  if (captionTracks.length === 0) {
    throw new Error('No captions were found for this video.')
  }

  const selectedTrack =
    captionTracks.find((t) => t.languageCode?.startsWith('en') && t.kind == null) ??
    captionTracks.find((t) => t.languageCode?.startsWith('en')) ??
    captionTracks[0]

  const transcriptResponse = await fetch(`${selectedTrack.baseUrl}&fmt=json3`)

  if (!transcriptResponse.ok) {
    throw new Error('Unable to fetch the caption track.')
  }

  let transcriptPayload: unknown
  try {
    transcriptPayload = await transcriptResponse.json()
  } catch {
    throw new Error('Unable to parse the caption track.')
  }

  const captions = extractCaptionSegments(transcriptPayload)
  const fullTranscript = buildTranscript(captions)

  if (!fullTranscript || captions.length === 0) {
    throw new Error('The caption track did not contain readable transcript text.')
  }

  // Keep the generation transcript comfortably under large-model prompt limits.
  const transcript = fullTranscript.slice(0, 24000)

  return {
    transcript,
    transcriptPreview: fullTranscript.slice(0, 800),
    captions,
  }
}

export async function fetchSubs(youtubeUrl: string) {
  const videoId = extractVideoId(youtubeUrl)

  if (!videoId) {
    throw new Error('Please provide a valid YouTube URL.')
  }

  const transcriptData = await fetchTranscript(videoId)

  return {
    transcript: transcriptData.transcript,
    transcriptPreview: transcriptData.transcriptPreview,
    captions: transcriptData.captions,
    videoId,
  }
}
