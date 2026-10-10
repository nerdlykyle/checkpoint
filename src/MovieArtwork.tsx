import { useState } from 'react'
import { Film, MoreHorizontal } from 'lucide-react'
import type { Movie } from './lib/movies'
import './MovieArtwork.css'

export function MoviePoster({ movie }: { movie: Movie }) {
  const [failed, setFailed] = useState('')
  return <div className="movie-poster">
    <span className="movie-poster-fallback"><Film aria-hidden="true" /><strong>{movie.title}</strong></span>
    {movie.posterUrl && failed !== movie.posterUrl && <img src={movie.posterUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(movie.posterUrl)} />}
  </div>
}

export function MovieCassette({ movie, onOpen }: { movie: Movie; onOpen: () => void }) {
  return <article className="movie-feature">
    <div className="movie-cassette" role="img" aria-label={`VHS cassette of ${movie.title}, with film on both spools`}>
      <span className="movie-topmark" aria-hidden="true">Insert this side up · ▲ · Do not touch the tape</span>
      <div className="movie-window left" aria-hidden="true"><div className="movie-reel"><div className="movie-hub" /></div></div>
      <div className="movie-art-label"><MoviePoster movie={movie} /><h3 className="movie-cassette-title" title={movie.title}>{movie.title}</h3></div>
      <div className="movie-window right" aria-hidden="true"><div className="movie-reel"><div className="movie-hub" /></div></div>
      <span className="movie-vhs" aria-hidden="true">VHS</span><span className="movie-grade" aria-hidden="true">High grade · T-120</span>
      <i className="movie-screw left" aria-hidden="true" /><i className="movie-screw right" aria-hidden="true" />
    </div>
    <div className="movie-feature-caption"><div>{movie.year && <p>{movie.year}</p>}</div><div className="movie-actions">
      <button type="button" className="icon-button" title="Movie details" aria-label={`Open ${movie.title} details`} aria-haspopup="dialog" onClick={onOpen}><MoreHorizontal size={20} /></button>
    </div></div>
  </article>
}

export function MovieSleeve({ movie, onOpen }: { movie: Movie; onOpen: () => void }) {
  const [out, setOut] = useState(false)
  return <article className="movie-sleeve-item">
    <div className={`movie-sleeve${out ? ' is-out' : ''}`}>
      <div className="movie-mini-tape" aria-hidden="true"><i className="movie-mini-hub" /><i className="movie-mini-hub lower" /><span className="movie-mini-label">{movie.title}</span></div>
      <div className="movie-sleeve-box"><MoviePoster movie={movie} />
        <button type="button" className="movie-sleeve-open" aria-label={`${out ? 'Put away' : 'Slide out'} ${movie.title} cassette`} aria-pressed={out} onClick={() => setOut(value => !value)} />
        <button type="button" className="movie-sleeve-menu icon-button" title="Movie details" aria-label={`Open ${movie.title} details`} aria-haspopup="dialog" onClick={onOpen}><MoreHorizontal size={20} /></button>
      </div>
    </div>
    <div className="movie-sleeve-caption"><h3>{movie.title}</h3>{movie.year && <p>{movie.year}</p>}</div>
  </article>
}
