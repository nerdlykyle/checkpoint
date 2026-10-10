// Only these fixed TMDB endpoints are reachable; callers cannot proxy arbitrary URLs.
const cache = new Map()
export class MovieCatalogError extends Error {
  constructor(message, status = 502) { super(message); this.status = status }
}
const text = (value, max) => typeof value === 'string' ? value.slice(0, max) : ''
export function mapMovie(row) {
  if (!row || !Number.isSafeInteger(row.id) || row.id < 1 || typeof row.title !== 'string' || !row.title.trim() || row.adult === true) return null
  return {
    tmdbId: row.id, title: row.title.trim().slice(0, 250),
    year: /^\d{4}-/.test(row.release_date || '') ? row.release_date.slice(0, 4) : '',
    description: text(row.overview, 5000),
    posterUrl: typeof row.poster_path === 'string' && /^\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(row.poster_path) ? `https://image.tmdb.org/t/p/w780${row.poster_path}` : '',
  }
}
export async function authorizeMovieCatalog(request, env, fetcher = fetch) {
  const token = request.headers.get('Authorization') || ''
  if (!/^Bearer [A-Za-z0-9._-]{20,8192}$/.test(token)) throw new MovieCatalogError('Sign in to search movies.', 401)
  if (!/^[a-z][a-z0-9-]{4,62}$/.test(env.FIREBASE_PROJECT_ID || '')) throw new MovieCatalogError('Movie search authentication is not configured yet.', 503)
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/boards/${encodeURIComponent(env.CHECKPOINT_BOARD_ID)}?mask.fieldPaths=ownerUid`
  let response
  try { response = await fetcher(url, { headers: { Authorization: token }, signal: AbortSignal.timeout(10000) }) }
  catch { throw new MovieCatalogError('Could not verify your membership. Please retry.', 503) }
  // Firestore applies the existing board-member rules to the supplied ID token.
  // Do not return or cache private board content, even though the mask is minimal.
  await response.body?.cancel()
  if ([401,403,404].includes(response.status)) throw new MovieCatalogError('Sign in as a member of this crew to search movies.', 403)
  if (!response.ok) throw new MovieCatalogError('Could not verify your membership. Please retry.', 503)
}
export async function movieCatalog(env, params, fetcher = fetch) {
  let endpoint
  if (params.action === 'search') {
    const query = (params.q || '').trim(), year = (params.year || '').trim()
    if (query.length < 2 || query.length > 120 || (year && !/^\d{4}$/.test(year))) throw new MovieCatalogError('Enter a title (2–120 characters) and an optional four-digit year.', 400)
    endpoint = `/search/movie?${new URLSearchParams({ query, include_adult:'false', language:'en-US', page:'1', ...(year ? {primary_release_year:year} : {}) })}`
  } else if (params.action === 'detail' && /^[1-9]\d{0,9}$/.test(params.id || '')) {
    endpoint = `/movie/${params.id}?language=en-US`
  } else throw new MovieCatalogError('Invalid movie search request.', 400)
  if (!env.TMDB_READ_ACCESS_TOKEN) throw new MovieCatalogError('Movie search needs its TMDB access token. Manual entry is still available.', 503)
  const saved = cache.get(endpoint)
  if (saved && saved.expires > Date.now()) return saved.value
  let response
  try {
    response = await fetcher(`https://api.themoviedb.org/3${endpoint}`, { headers: { Accept:'application/json', Authorization:`Bearer ${env.TMDB_READ_ACCESS_TOKEN}` }, signal:AbortSignal.timeout(12000) })
  } catch { throw new MovieCatalogError('Movie search timed out. Please retry or add the movie manually.', 504) }
  if ([401,403].includes(response.status)) throw new MovieCatalogError('TMDB access needs attention. Check the server’s access token.', 503)
  if (response.status === 429) throw new MovieCatalogError('Movie search is busy. Wait a moment and try again.', 429)
  if (response.status === 404) throw new MovieCatalogError('This movie is no longer available in the catalog.', 404)
  if (!response.ok) throw new MovieCatalogError('The movie catalog is temporarily unavailable.')
  let data
  try { data = await response.json() } catch { throw new MovieCatalogError('The movie catalog returned an invalid response.') }
  if (params.action === 'search' && !Array.isArray(data?.results)) throw new MovieCatalogError('The movie catalog returned an invalid response.')
  const value = params.action === 'search' ? {items:data.results.map(mapMovie).filter(Boolean).slice(0,20)} : mapMovie(data)
  if (!value) throw new MovieCatalogError('This movie is not available in the catalog.', 404)
  if (cache.size >= 100) cache.delete(cache.keys().next().value)
  cache.set(endpoint, {value, expires:Date.now()+15*60*1000})
  return value
}
