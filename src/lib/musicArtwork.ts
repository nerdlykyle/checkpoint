/** Only public Cover Art Archive identifiers go through the shared image cache. */
export function musicArtworkSources(value: string, base: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname !== 'coverartarchive.org' || url.search || url.hash || url.username || url.password) return undefined
    const match = url.pathname.match(/^\/(release-group|release)\/([a-f0-9-]{36})\/front(?:-(250|500|1200))?$/i)
    if (!match || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(match[2])) return undefined
    return [250, 500, 1200].map(size => ({ size, url: `${base.replace(/\/$/, '')}/music/artwork/${match[1]}/${match[2].toLowerCase()}/${size}` }))
  } catch { return undefined }
}
