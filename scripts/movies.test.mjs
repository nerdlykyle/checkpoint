import test from 'node:test'
import assert from 'node:assert/strict'
import { changeMovie, makeMovie, movieId, validateMovie } from '../src/lib/movies.ts'

const draft = {title:'The Last Signal',year:'2026',posterUrl:'',description:'A fictional film.'}
test('movie validation rejects unsafe art and invalid fields', () => {
  assert.throws(() => validateMovie({...draft,title:' '}))
  assert.throws(() => validateMovie({...draft,year:'abc'}))
  for (const posterUrl of ['javascript:alert(1)','data:image/png;base64,AAA','http://example.test/art.jpg','https://user:pass@example.test/image']) assert.throws(() => validateMovie({...draft,posterUrl}))
  assert.throws(() => validateMovie({...draft,description:'x'.repeat(5001)}))
  assert.equal(validateMovie({...draft,title:' A film '}).title,'A film')
})
test('movie ids deduplicate title/year without merging remakes', async () => {
  assert.equal(await movieId(draft),await movieId({...draft,title:' the LAST   signal '}))
  assert.notEqual(await movieId(draft),await movieId({...draft,year:'1984'}))
})
test('personal removal preserves other members, metadata, and group watch', async () => {
  const item = {...makeMovie(await movieId(draft),draft,'owner'),libraries:{owner:true,friend:true},clubStatus:'watching'}
  const removed=changeMovie(item,'owner','remove',item.id)
  assert.deepEqual(removed.libraries,{owner:false,friend:true})
  assert.equal(removed.clubStatus,'watching');assert.equal(item.libraries.owner,true)
  assert.deepEqual(changeMovie(removed,'owner','save',item.id),item)
})
test('queue and group-watch transitions cannot replace an active movie',async()=>{
  const item=makeMovie(await movieId(draft),draft,'owner')
  const queued=changeMovie(item,'owner','queue','')
  assert.equal(queued.clubStatus,'up-next');assert.ok(queued.queuedAt)
  assert.equal(changeMovie(queued,'owner','queue','').queuedAt,queued.queuedAt)
  assert.throws(()=>changeMovie(item,'owner','start','another-movie'))
  const playing=changeMovie(queued,'owner','start','')
  assert.throws(()=>changeMovie(playing,'owner','unqueue',item.id))
  assert.throws(()=>changeMovie(playing,'owner','finish','another-movie'))
  assert.equal(changeMovie(playing,'owner','finish',item.id).clubStatus,'watched')
  assert.equal(changeMovie(queued,'owner','unqueue','').clubStatus,'none')
})
