const IMAGE_PATH = /^\/music\/artwork\/(release-group|release)\/([a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})\/(250|500|1200)$/
const MAX_BYTES = 5 * 1024 * 1024

export function artworkTarget(path: string) {
  const match = path.match(IMAGE_PATH)
  return match ? `https://coverartarchive.org/${match[1]}/${match[2]}/front-${match[3]}` : undefined
}
export function allowedArtworkRedirect(value: string) {
  const url = new URL(value)
  return url.protocol === 'https:' && !url.username && !url.password && !url.port && (url.hostname === 'coverartarchive.org' || url.hostname === 'archive.org' || url.hostname.endsWith('.archive.org'))
}

/** Public catalog artwork only: fixed hosts, bounded redirects/bytes/time, no credentials. */
export async function cachedMusicArtwork(request: Request, cache: Cache, fetchImage: typeof fetch = fetch) {
  const url = new URL(request.url)
  const target = artworkTarget(url.pathname)
  if (!target || url.search) return new Response('Invalid artwork request', { status: 400 })
  const key = new Request(url.origin + url.pathname)
  const hit = await cache.match(key)
  if (hit) return hit
  const signal = AbortSignal.timeout(8000)
  let next = target
  for (let hops = 0; hops < 6; hops++) {
    const response = await fetchImage(next, { redirect: 'manual', signal, headers: { Accept: 'image/jpeg,image/png,image/webp' } })
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get('Location')
      await response.body?.cancel()
      if (!location) break
      next = new URL(location, next).href
      if (!allowedArtworkRedirect(next)) break
      continue
    }
    const type = response.headers.get('Content-Type')?.split(';')[0]
    if (!response.ok || !['image/jpeg','image/png','image/webp'].includes(type || '') || Number(response.headers.get('Content-Length')) > MAX_BYTES || !response.body) {
      await response.body?.cancel()
      break
    }
    const reader = response.body.getReader(), chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BYTES) { await reader.cancel(); return new Response('Artwork too large', { status: 502 }) }
      chunks.push(value)
    }
    const bytes = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const result = new Response(bytes, { headers: {
      'Content-Type': type!, 'Cache-Control': 'public, max-age=604800',
      'Access-Control-Allow-Origin': '*', 'X-Content-Type-Options': 'nosniff',
    } })
    try { await cache.put(key, result.clone()) } catch { /* Still serve the valid image if cache storage is unavailable. */ }
    return result
  }
  return new Response('Artwork unavailable', { status: 502, headers: { 'Cache-Control': 'no-store' } })
}
