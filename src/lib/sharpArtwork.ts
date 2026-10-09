/** Upgrade only known thumbnail formats. Never rewrite arbitrary/signed artwork. */
export function sharpArtworkUrl(value: string) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined
    const host = url.hostname
    if (host === 'coverartarchive.org' && !url.search) {
      url.pathname = url.pathname.replace(/\/front-(250|500)$/, '/front-1200')
    } else if (host.endsWith('.steamstatic.com') && [...url.searchParams.keys()].every(key => ['t', 'checkpoint'].includes(key))) {
      url.pathname = url.pathname.replace(/\/library_600x900\.jpg$/, '/library_600x900_2x.jpg')
    }
    return url.href
  } catch { return undefined }
}

export function artworkSources(value: string) {
  const sharp = sharpArtworkUrl(value)
  return sharp ? { original: new URL(value).href, sharp } : undefined
}
