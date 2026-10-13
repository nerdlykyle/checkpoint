export type MovieSection = 'home' | 'library' | 'queue' | 'watched'
export type MovieStatus = 'none' | 'up-next' | 'watching' | 'watched'
export type MovieDraft = { title: string; year: string; posterUrl: string; description: string; tmdbId?: number }
export type Movie = MovieDraft & {
  id: string
  addedBy: string
  createdAt: string
  clubStatus: MovieStatus
  queuedAt: string
  libraries: Record<string, boolean>
  seenBy?: Record<string, boolean>
  ratings?: Record<string, number>
  reviews?: Record<string, string>
}
export type MovieAction = 'save' | 'remove' | 'queue' | 'unqueue' | 'start' | 'finish' | 'seen' | 'unseen'
export type MovieShelf = 'all' | 'favorites' | 'watched' | 'watchlist' | 'group' | 'crew'
export const movieShelves: Record<MovieShelf, string> = { all: 'My library', favorites: 'Favorites', watched: 'Watched', watchlist: 'Watchlist', group: 'Group watchlist', crew: 'Crew collection' }
export function moviesOnShelf(items: Movie[], user: string, shelf: MovieShelf, favoriteIds: string[] = []): Movie[] {
  if (shelf === 'favorites') return items.filter(item=>favoriteIds.includes(item.id))
  if (shelf === 'group') return items.filter(item => item.clubStatus === 'up-next').sort((a,b) => a.queuedAt.localeCompare(b.queuedAt) || a.id.localeCompare(b.id))
  if (shelf === 'crew') return items
  return items.filter(item => item.libraries[user] && (shelf === 'all' || (shelf === 'watched' ? item.seenBy?.[user] === true : item.seenBy?.[user] !== true)))
}
export function rateMovie(item: Movie, user: string, stars: number): Movie {
  if (!Number.isInteger(stars) || stars < 0 || stars > 5) throw new Error('Choose a rating from 1 to 5, or clear your rating.')
  return { ...item, ratings: { ...item.ratings, [user]: stars } }
}
export function reviewMovie(item: Movie, user: string, text: string): Movie {
  if (text.length > 2000) throw new Error('Keep your review under 2,000 characters.')
  return { ...item, reviews: { ...item.reviews, [user]: text.trim() } }
}
export const movieSections: Record<MovieSection, string> = {
  home: 'Movie home', library: 'My movies', queue: 'Group watchlist', watched: 'Club watched',
}
export function movieImageUrl(value: string): string {
  if (!value.trim()) return ''
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' && !url.username && !url.password && value.length <= 2000) return url.href
  } catch { /* Only public HTTPS artwork links are accepted. */ }
  throw new Error('Use an HTTPS image link for the artwork.')
}
export function validateMovie(draft: MovieDraft): MovieDraft {
  const title = draft.title.trim(), year = draft.year.trim()
  if (!title || title.length > 250) throw new Error('Enter a movie title (up to 250 characters).')
  if (year && !/^\d{4}$/.test(year)) throw new Error('Enter a four-digit release year, or leave it blank.')
  if (draft.description.length > 5000) throw new Error('Keep the synopsis under 5,000 characters.')
  if (draft.tmdbId !== undefined && (!Number.isSafeInteger(draft.tmdbId) || draft.tmdbId < 1 || draft.tmdbId > 9999999999)) throw new Error('Invalid catalog movie. Please select it again.')
  return { title, year, posterUrl: movieImageUrl(draft.posterUrl.trim()), description: draft.description.trim(), ...(draft.tmdbId ? {tmdbId:draft.tmdbId} : {}) }
}
export async function movieId(draft: MovieDraft) {
  const key = draft.tmdbId ? `tmdb:${draft.tmdbId}` : `${draft.title.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ')}|${draft.year.trim()}`
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)))
  return `movie-${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`
}
export function makeMovie(id: string, draft: MovieDraft, user: string): Movie {
  return { ...validateMovie(draft), id, addedBy: user, createdAt: new Date().toISOString(), clubStatus: 'none', queuedAt: '', libraries: { [user]: true } }
}
export function changeMovie(item: Movie, user: string, action: MovieAction, currentId: string): Movie {
  if (action === 'seen' || action === 'unseen') return { ...item, libraries: { ...item.libraries, [user]: true }, seenBy: { ...item.seenBy, [user]: action === 'seen' } }
  if (action === 'save' || action === 'remove') return { ...item, libraries: { ...item.libraries, [user]: action === 'save' } }
  if (action === 'start') {
    if (currentId && currentId !== item.id) throw new Error('Finish the current group watch first.')
    return { ...item, clubStatus: 'watching' }
  }
  if (action === 'finish') {
    if (currentId !== item.id || item.clubStatus !== 'watching') throw new Error('This movie is no longer the current group watch.')
    return { ...item, clubStatus: 'watched' }
  }
  if (item.clubStatus === 'watching') throw new Error('Finish the current group watch before changing its queue status.')
  if (action === 'queue') return { ...item, clubStatus: 'up-next', queuedAt: item.clubStatus === 'up-next' ? item.queuedAt : new Date().toISOString() }
  if (item.clubStatus !== 'up-next') throw new Error('This movie is no longer in Up Next.')
  return { ...item, clubStatus: 'none', queuedAt: '' }
}
