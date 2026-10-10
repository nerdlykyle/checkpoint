import { Check, Eye, EyeOff, ListVideo, Pencil, Play, Plus, Star, Trash2 } from 'lucide-react'
import { MoviePoster } from './MovieArtwork'
import ReviewEditor from './ReviewEditor'
import type { Movie, MovieAction } from './lib/movies'
import type { Member } from './types'

export default function MovieDetails({ movie, current, user, crew, disabled, onAction, onRate, onReview, onEdit }: {
  movie: Movie; current?: Movie; user: string; crew: Member[]; disabled: boolean
  onAction: (action: MovieAction) => void; onRate: (stars: number) => void; onReview: (text: string) => Promise<void>; onEdit: () => void
}) {
  const stars = movie.ratings?.[user] || 0
  const hasSeen = movie.seenBy?.[user] === true
  const ratings = crew.map(member => movie.ratings?.[member.id] || 0).filter(value => value > 0)
  const seen = crew.filter(member => movie.seenBy?.[member.id] === true).length
  return <>
    <div className="movie-detail-intro"><div className="movie-detail-poster"><MoviePoster movie={movie} /></div><div>
      <span className="eyebrow">{movie.clubStatus === 'watching' ? 'Current group watch' : movie.clubStatus === 'up-next' ? 'Group watchlist' : movie.clubStatus === 'watched' ? 'Watched together' : 'Checkpoint movies'}</span>
      <h3>{movie.title}</h3><p>{movie.year}</p>
      <p className="movie-rating-summary"><Star size={17} aria-hidden="true" />{ratings.length ? `${(ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1)} / 5 · ${ratings.length} crew ${ratings.length === 1 ? 'rating' : 'ratings'}` : 'No ratings yet'}</p>
      {movie.tmdbId && <a className="button" href={`https://www.themoviedb.org/movie/${movie.tmdbId}`} target="_blank" rel="noreferrer">TMDB</a>}
    </div></div>
    <div className="movie-detail-grid">
      <div className="movie-detail-main"><section className="movie-detail-synopsis"><h3>Synopsis</h3><p>{movie.description || 'No synopsis yet. Use Edit movie to add one.'}</p></section>
        <section><h3>Movie settings</h3><p className="movie-muted">Added by {crew.find(member => member.id === movie.addedBy)?.name || 'a crew member'}. Artwork and synopsis are shared.</p>
          <div className="movie-detail-actions"><button type="button" className="icon-button" title="Edit movie" aria-label="Edit movie" disabled={disabled} onClick={onEdit}><Pencil size={20} /></button>
            <button type="button" className="icon-button" title={movie.libraries[user] ? 'Remove from my library' : 'Save to my library'} aria-label={movie.libraries[user] ? 'Remove from my library' : 'Save to my library'} disabled={disabled} onClick={() => onAction(movie.libraries[user] ? 'remove' : 'save')}>{movie.libraries[user] ? <Trash2 size={20} /> : <Plus size={20} />}</button></div>
        </section>
      </div>
      <aside className="movie-detail-sidebar">
        <section><h3>Group watch</h3><div className="movie-action-stack">
          {movie.clubStatus !== 'watching' && <button type="button" className="button" disabled={disabled} onClick={() => onAction(movie.clubStatus === 'up-next' ? 'unqueue' : 'queue')}><ListVideo size={18} />{movie.clubStatus === 'up-next' ? 'Remove from group watchlist' : 'Add to group watchlist'}</button>}
          <button type="button" className="button" disabled={disabled || Boolean(current && current.id !== movie.id)} onClick={() => onAction(movie.clubStatus === 'watching' ? 'finish' : 'start')}>{movie.clubStatus === 'watching' ? <Check size={18} /> : <Play size={18} />}{movie.clubStatus === 'watching' ? 'Finish group watch' : 'Start group watch'}</button>
        </div>{current && current.id !== movie.id && <p className="movie-muted">Finish “{current.title}” before starting another group watch.</p>}
        <p className="movie-muted">Finishing a group watch never changes anyone’s personal watched status.</p></section>
        <section><h3>My viewing</h3>
          <button type="button" className="icon-button movie-seen-toggle" disabled={disabled} aria-label="Seen this movie" aria-pressed={hasSeen} title={hasSeen ? 'Seen — tap to mark unseen' : 'Unseen — tap to mark seen'} onClick={() => onAction(hasSeen ? 'unseen' : 'seen')}>
            {hasSeen ? <Eye size={22} aria-hidden="true" /> : <EyeOff size={22} aria-hidden="true" />}
          </button><p className="movie-muted">Tap to mark seen. Tap again to undo.</p>
        </section>
        <section><h3>My rating</h3><div className="movie-stars" role="group" aria-label="Your movie rating">{[1,2,3,4,5].map(value => <button type="button" key={value} disabled={disabled} aria-label={`Rate ${value} ${value === 1 ? 'star' : 'stars'}`} aria-pressed={stars === value} title={`${value} / 5`} onClick={() => onRate(value)}><Star size={23} fill={value <= stars ? 'currentColor' : 'none'} /></button>)}</div>
          <div className="movie-rating-note"><small>{stars ? `${stars} / 5 · Saved` : 'Choose a star to save your rating'}</small>{stars > 0 && <button type="button" className="icon-button" title="Clear my rating" aria-label="Clear my rating" disabled={disabled} onClick={() => onRate(0)}><Trash2 size={16} /></button>}</div>
        </section>
        <section><ReviewEditor key={`${movie.id}:${user}`} saved={movie.reviews?.[user] || ''} disabled={disabled} onSave={onReview} /></section>
        <section><h3>Crew ratings & reviews</h3><p className="movie-muted">{seen} of {crew.length} have seen it</p><div className="movie-crew-ratings">{crew.map(member => {
          const rating = movie.ratings?.[member.id] || 0, watched = movie.seenBy?.[member.id]
          return <div className="movie-crew-rating" key={member.id}><span className="avatar avatar-small" style={{background:member.color}}>{member.photoUrl ? <img src={member.photoUrl} alt="" /> : member.initials || member.name.slice(0,1)}</span><div><strong>{member.name}{member.id === user ? ' (you)' : ''}</strong><small>{watched === undefined ? 'Not marked yet' : watched ? 'Seen it' : 'Not seen yet'}</small></div><span aria-label={`${member.name}: ${rating ? `${rating} out of 5 stars` : 'Not rated'}`}>{rating ? <><Star size={14} aria-hidden="true" /> {rating}/5</> : 'Not rated'}</span>{movie.reviews?.[member.id] && <p className="crew-review-text">{movie.reviews[member.id]}</p>}</div>
        })}</div></section>
      </aside>
    </div>
  </>
}
