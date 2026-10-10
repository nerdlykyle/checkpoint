import { useEffect, useRef, useState } from 'react'
import { Film, Search } from 'lucide-react'
import { movieRequest, type MovieResult } from './lib/movieSearch'
import type { MovieDraft } from './lib/movies'
import tmdbLogo from './assets/tmdb.svg'

export function MovieCredits() {
  return <aside className="movie-credits" aria-label="Movie catalog credits"><a href="https://www.themoviedb.org" target="_blank" rel="noreferrer"><img src={tmdbLogo} width="85" height="12" alt="TMDB" loading="lazy" /></a><p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p></aside>
}
export default function MovieSearch({ boardId, onChoose, request = movieRequest }: { boardId: string; onChoose: (draft: MovieDraft) => void; request?: typeof movieRequest }) {
  const [query, setQuery] = useState(''), [year, setYear] = useState('')
  const [results, setResults] = useState<MovieResult[]>([]), [loading, setLoading] = useState(false), [choosing, setChoosing] = useState(false)
  const [error, setError] = useState(''), [searched, setSearched] = useState(false), [retry, setRetry] = useState(0)
  const detailRequest = useRef<AbortController | null>(null)
  useEffect(() => () => detailRequest.current?.abort(), [])
  useEffect(() => {
    const controller = new AbortController()
    setResults([]); setSearched(false); setError('')
    if (query.trim().length < 2 || (year && !/^\d{4}$/.test(year))) { setLoading(false); return }
    setLoading(true)
    const timer = window.setTimeout(() => {
      request<{items:MovieResult[]}>(boardId, {action:'search',q:query.trim(),...(year?{year}:{})}, controller.signal)
        .then(data => { if (!controller.signal.aborted) { setResults(data.items); setSearched(true) } })
        .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not search movies.') })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 500)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [boardId, query, year, request, retry])
  const choose = async (result: MovieResult) => {
    if (choosing) return
    const controller = new AbortController(); detailRequest.current = controller
    setChoosing(true); setError('')
    try {
      const detail = await request<MovieResult>(boardId, {action:'detail',id:String(result.tmdbId)}, controller.signal)
      if (!controller.signal.aborted) onChoose(detail)
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load movie details. Please retry.') }
    finally { if (!controller.signal.aborted) setChoosing(false) }
  }
  return <div className="movie-search-panel">
    <div className="movie-editor"><label>Find a movie<input type="search" placeholder="Movie title…" maxLength={120} value={query} disabled={choosing} onChange={event => setQuery(event.target.value)} /></label><label>Release year (optional)<input inputMode="numeric" maxLength={4} placeholder="Any year" value={year} disabled={choosing} onChange={event => setYear(event.target.value.replace(/\D/g,''))} /></label></div>
    {(loading || choosing) && <p role="status">{choosing ? 'Loading movie details…' : 'Searching movies…'}</p>}
    {error && <div className="movie-error" role="alert">{error}<button type="button" className="button" disabled={choosing} onClick={() => setRetry(value => value + 1)}>Retry search</button></div>}
    {!loading && searched && !results.length && <p>No matches. Try another title or year, or add the movie manually.</p>}
    <div className="movie-search-results">{results.map(result => <button type="button" key={result.tmdbId} disabled={choosing} onClick={() => void choose(result)} aria-label={`Select ${result.title}${result.year ? ` (${result.year})` : ''}`}>
      <span className="movie-search-art"><Film size={24} />{result.posterUrl && <img src={result.posterUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = 'none' }} />}</span>
      <span><strong>{result.title}</strong><small>{result.year || 'Release year unknown'}</small><p>{result.description || 'No synopsis available.'}</p></span><Search size={18} />
    </button>)}</div>
    <button type="button" className="button" disabled={choosing} onClick={() => onChoose({title:query.trim(),year:year.length===4?year:'',posterUrl:'',description:''})}>Add manually</button>
    <MovieCredits />
  </div>
}
