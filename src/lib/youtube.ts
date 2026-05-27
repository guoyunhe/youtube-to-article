const watchUrlHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com'])
const shortUrlHosts = new Set(['youtu.be', 'www.youtu.be'])
const youtubeVideoIdPattern = /^[A-Za-z0-9_-]{11}$/

function normalizeVideoId(raw: string | null): string | null {
  const candidate = raw?.trim() ?? ''
  return youtubeVideoIdPattern.test(candidate) ? candidate : null
}

export function extractVideoId(input: string): string | null {
  try {
    const url = new URL(input.trim())
    const hostname = url.hostname.toLowerCase()

    if (watchUrlHosts.has(hostname)) {
      if (url.pathname === '/watch') {
        return normalizeVideoId(url.searchParams.get('v'))
      }

      if (url.pathname.startsWith('/shorts/')) {
        return normalizeVideoId(url.pathname.split('/')[2] ?? null)
      }
    }

    if (shortUrlHosts.has(hostname)) {
      return normalizeVideoId(url.pathname.replaceAll('/', '') || null)
    }
  } catch {
    return null
  }

  return null
}

export function isValidYouTubeUrl(input: string): boolean {
  return extractVideoId(input) !== null
}
