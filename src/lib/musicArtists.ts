export type MusicArtist = {
  id: string; name: string; description: string; imageUrl: string; imageSource: string; imageCredit: string;
  imageLicense: string; imageLicenseUrl: string; spotify: string; youtube: string; active: boolean; createdAt: string; updatedAt: string
}
export type ArtistResult = Pick<MusicArtist, 'id' | 'name'> & Partial<MusicArtist>
export function artistUrl(value: string | undefined) {
  try { const url = new URL(value || ''); return url.protocol === 'https:' && !url.username && !url.password ? url.href : '' } catch { return '' }
}
export function artistServiceLink(artist: Pick<MusicArtist, 'name' | 'spotify' | 'youtube'>, service: 'spotify' | 'youtube') {
  const url = artistUrl(artist[service])
  if (url) {
    const parsed = new URL(url)
    if (service === 'spotify' && parsed.hostname === 'open.spotify.com' && /^\/artist\/[a-zA-Z0-9]{22}\/?$/.test(parsed.pathname)) return { url, direct: true }
    if (service === 'youtube' && parsed.hostname === 'music.youtube.com' && /^\/channel\/UC[\w-]{22}\/?$/.test(parsed.pathname)) return { url, direct: true }
  }
  return { url: service === 'spotify' ? `https://open.spotify.com/search/${encodeURIComponent(artist.name)}` : `https://music.youtube.com/search?q=${encodeURIComponent(artist.name)}`, direct: false }
}
export function makeFavoriteArtist(data: ArtistResult, active = true): MusicArtist {
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(data.id) || !data.name.trim()) throw new Error('Choose a valid artist.')
  const now = new Date().toISOString()
  return { id: data.id, name: data.name.trim().slice(0,250), description: (data.description || '').slice(0,500),
    imageUrl: artistUrl(data.imageUrl), imageSource: artistUrl(data.imageSource), imageCredit: (data.imageCredit || '').slice(0,600),
    imageLicense: (data.imageLicense || '').slice(0,200), imageLicenseUrl: artistUrl(data.imageLicenseUrl),
    spotify: artistUrl(data.spotify), youtube: artistUrl(data.youtube), active, createdAt: data.createdAt || now, updatedAt: now }
}
