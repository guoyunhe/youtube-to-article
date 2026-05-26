const watchUrlHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com'])
const shortUrlHosts = new Set(['youtu.be', 'www.youtu.be'])

export function extractVideoId(input: string): string | null {
  try {
    const url = new URL(input.trim())
    const hostname = url.hostname.toLowerCase()

    if (watchUrlHosts.has(hostname)) {
      if (url.pathname === '/watch') {
        return url.searchParams.get('v')
      }

      if (url.pathname.startsWith('/shorts/')) {
        return url.pathname.split('/')[2] ?? null
      }
    }

    if (shortUrlHosts.has(hostname)) {
      return url.pathname.replaceAll('/', '') || null
    }
  } catch {
    return null
  }

  return null
}
