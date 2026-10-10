import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { makeGameReview } from '../src/lib/gameReviews.ts'
import { reviewMovie, makeMovie, changeMovie, rateMovie } from '../src/lib/movies.ts'

test('movie review editor sits in the left column above movie settings', () => {
  const details=readFileSync(new URL('../src/MovieDetails.tsx',import.meta.url),'utf8')
  const main=details.split('className="movie-detail-main"')[1].split('<aside')[0]
  assert.ok(main.indexOf('<ReviewEditor') > 0)
  assert.ok(main.indexOf('<ReviewEditor') < main.indexOf('<h3>Movie settings'))
  assert.equal(details.split('<ReviewEditor').length-1,1)
})

test('movie reviews preserve ratings, crew reviews, shelves and group state', () => {
  const old = { ...makeMovie('movie-test', {title:'Film',year:'2026',posterUrl:'',description:''}, 'owner'), reviews:{friend:'Their review'}, ratings:{owner:4,friend:5} }
  const next = reviewMovie(old, 'owner', '  My thoughts\nSecond line  ')
  assert.equal(next.reviews.owner, 'My thoughts\nSecond line')
  assert.equal(next.reviews.friend, 'Their review')
  assert.deepEqual(next.ratings, old.ratings)
  assert.deepEqual(next.libraries, old.libraries)
  assert.equal(next.clubStatus, old.clubStatus)
  assert.equal(old.reviews.owner, undefined)
  assert.deepEqual(changeMovie(next,'owner','remove','').reviews, next.reviews)
  assert.deepEqual(rateMovie(next,'owner',0).reviews, next.reviews)
  assert.deepEqual(reviewMovie(next,'owner','').reviews, {friend:'Their review',owner:''})
  assert.throws(() => reviewMovie(old,'owner','x'.repeat(2001)))
})
test('written reviews do not require or manufacture a star rating', () => {
  assert.equal(makeGameReview('Thoughts',0).stars,0)
  assert.equal(makeGameReview('  Thoughts  ',5).text,'Thoughts')
  for (const stars of [-1,6,2.5,NaN]) assert.throws(() => makeGameReview('Review',stars))
  assert.throws(() => makeGameReview('x'.repeat(2001),3))
  assert.equal(makeGameReview('',0).text,'')
  const book=readFileSync(new URL('../src/BookClub.tsx',import.meta.url),'utf8')
  const music=readFileSync(new URL('../src/MusicDetails.tsx',import.meta.url),'utf8')
  assert.doesNotMatch(book,/stars: ownRating \|\| 1/)
  assert.match(book,/aria-label="My review"/)
  assert.match(book,/>Save review</)
  assert.doesNotMatch(music,/disabled={!stars}>Save rating/)
})
test('review editor preserves failed drafts and uses safe plain text with bounded input', () => {
  const editor=readFileSync(new URL('../src/ReviewEditor.tsx',import.meta.url),'utf8')
  assert.match(editor,/await onSave\(value\)/)
  assert.match(editor,/Your text is still here/)
  assert.ok(editor.includes('maxLength={2000}'))
  assert.match(editor,/type="button"/)
  assert.doesNotMatch(editor,/dangerouslySetInnerHTML/)
  const store=readFileSync(new URL('../src/lib/movieStore.ts',import.meta.url),'utf8')
  assert.match(store,/new FieldPath\('reviews', user\)/)
})
