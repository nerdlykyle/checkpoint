export type MusicShelf = 'to-listen' | 'listening' | 'listened' | 'not-for-me'
export type MusicService = 'spotify' | 'youtube'
export type MusicSection = 'home' | 'library' | 'club' | 'poll' | 'songs' | 'listeners' | 'settings'
export type MusicTrack = { id: string; title: string; number: string; duration?: number }
export type MusicItem = {
  id: string; kind: 'album' | 'ep' | 'song'; title: string; artists: string[]; artistIds?: string[]; year?: string
  mbid?: string; releaseId?: string; coverUrl?: string; description: string; genres: string[]; tracks: MusicTrack[]
  links: { spotify?: string; youtube?: string; custom?: { title: string; url: string }[] }
  addedBy: string; createdAt: string; sharedBy?: string
  shelves: Record<string, MusicShelf>; favorites: string[]
  organization: Record<string, { order?: number; tags?: string[] }>
  ratings: Record<string, { stars: number; review: string; updatedAt: string }>
  favoriteTracks: Record<string, string[]>
  comments: { id: string; userId: string; text: string; createdAt: string }[]
  listens: { id: string; userId: string; date: string; note: string }[]
  nominated: boolean; upvotes: string[]; downvotes: string[]; passedOn?: boolean
  club?: { status: 'up-next' | 'listening' | 'listened'; order: number; participants: string[] }
}
export const musicShelves: Record<MusicShelf,string> = { 'to-listen':'To listen', listening:'Listening', listened:'Listened', 'not-for-me':'Not for me' }
export const musicSections: Record<MusicSection,string> = { home:'Music home', library:'My music', club:'Club listens', poll:'Next-listen poll', songs:'Songs to share', listeners:'Listeners’ collections', settings:'Music settings' }
export function safeHttpUrl(value: string) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined } catch { return undefined }
}
export function serviceLink(value: string, service: MusicService) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return undefined
    if (service === 'spotify' && url.hostname === 'open.spotify.com' && /^\/(?:intl-[a-z]+\/)?(?:album|track)\/[A-Za-z0-9]{22}\/?$/.test(url.pathname)) return `https://open.spotify.com${url.pathname.replace(/^\/intl-[a-z]+/, '')}`
    if (service === 'youtube' && ['music.youtube.com', 'www.youtube.com', 'youtube.com', 'youtu.be'].includes(url.hostname)) {
      const video = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.pathname === '/watch' ? url.searchParams.get('v') : null
      if (video && /^[\w-]{11}$/.test(video)) return `https://music.youtube.com/watch?v=${video}`
      const list = url.pathname === '/playlist' ? url.searchParams.get('list') : null
      if (list && /^[\w-]{10,200}$/.test(list)) return `https://music.youtube.com/playlist?list=${list}`
    }
  } catch { /* Invalid links remain unset. */ }
  return undefined
}
export function listeningLink(item: Pick<MusicItem,'title'|'artists'|'links'>, service: MusicService) {
  const direct = item.links[service] && serviceLink(item.links[service]!, service)
  const name = service === 'spotify' ? 'Spotify' : 'YouTube Music'
  const query = encodeURIComponent(`${item.artists.join(' ')} ${item.title}`)
  return { label: `${direct ? 'Open in' : 'Search'} ${name}`, url: direct || (service === 'spotify' ? `https://open.spotify.com/search/${query}` : `https://music.youtube.com/search?q=${query}`) }
}
export function makeMusicItem(data: Partial<MusicItem> & Pick<MusicItem,'id'|'title'|'artists'|'kind'>, user: string): MusicItem {
  return { description:'', genres:[], tracks:[], links:{}, shelves:{}, favorites:[], organization:{}, ratings:{}, favoriteTracks:{}, comments:[], listens:[], nominated:false, upvotes:[], downvotes:[], ...data, addedBy:user, createdAt:new Date().toISOString() }
}
export function musicQueue(items: MusicItem[], user: string, shelf?: MusicShelf) {
  return items.filter((item) => shelf ? item.shelves[user] === shelf : Boolean(item.shelves[user]))
    .sort((a,b) => (a.organization[user]?.order ?? Infinity) - (b.organization[user]?.order ?? Infinity) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}
export function voteMusic(item: MusicItem, user: string, vote: 'up'|'down'): MusicItem {
  if (item.passedOn || item.club) return item
  const upvotes = item.upvotes.filter((id) => id !== user), downvotes = item.downvotes.filter((id) => id !== user)
  if (vote === 'up' && !item.upvotes.includes(user)) upvotes.push(user)
  if (vote === 'down' && !item.downvotes.includes(user)) downvotes.push(user)
  return {...item, upvotes, downvotes, passedOn:downvotes.length >= 3}
}
export function saveMusicShelf(item:MusicItem,user:string,shelf:MusicShelf,order:number):MusicItem {
  return {...item,shelves:{...item.shelves,[user]:shelf},organization:{...item.organization,[user]:{...item.organization[user],order:item.shelves[user] === shelf ? item.organization[user]?.order ?? order : order}}}
}
export function recordListen(item:MusicItem,user:string,date:string,note:string,id:string):MusicItem {
  return {...item,shelves:{...item.shelves,[user]:'listened'},listens:[...item.listens,{id,userId:user,date,note}].slice(-500)}
}
