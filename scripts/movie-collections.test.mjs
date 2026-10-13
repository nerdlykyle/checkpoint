import test from 'node:test'
import assert from 'node:assert/strict'
import { mapMovie } from '../worker/src/movies.js'
import { loadMovieCollections, movieCollectionCache, movieCollections } from '../src/lib/movieCollections.ts'
import { makeMovie, moviesOnShelf, validateMovie } from '../src/lib/movies.ts'

const series = { id: 264, name: 'Back to the Future Collection' }
const first = { ...makeMovie('first', { title: 'Back to the Future', year: '1985', posterUrl: '', description: '', tmdbId: 105 }, 'me'), clubStatus: 'up-next', queuedAt: '1' }
const second = { ...makeMovie('second', { title: 'Back to the Future Part II', year: '1989', posterUrl: '', description: '', tmdbId: 165 }, 'me'), seenBy: {me:true}, ratings:{me:5}, reviews:{me:'Great sequel'}, clubStatus:'up-next', queuedAt:'2' }
const other = makeMovie('other', { title:'Back to the Future Again', year:'2020', posterUrl:'', description:'', tmdbId:999 }, 'friend')

test('catalog exposes verified collection IDs from details, not title guesses', () => {
  const row = { id:105, title:first.title, belongs_to_collection:series }
  assert.deepEqual(mapMovie(row).collection, series)
  assert.equal(mapMovie({...row,belongs_to_collection:null}).collection,null)
  assert.equal(mapMovie({...row,belongs_to_collection:{id:-1,name:'Bad'}}).collection,null)
  assert.equal(mapMovie({id:105,title:first.title}).collection,undefined)
  // Metadata is a sidecar; the existing strict movie schema remains unchanged.
  assert.equal(validateMovie({...first,collection:series}).collection,undefined)
})

test('existing movie records stack newest first without changing personal or group data', () => {
  const items = [first,other,second], before = structuredClone(items)
  const groups = movieCollections(items,{105:series,165:series,999:{id:555,name:series.name}})
  assert.equal(groups.length,2)
  assert.deepEqual(groups[0].items.map(item=>item.id),['second','first'])
  assert.equal(groups[1].items[0].id,'other')
  assert.deepEqual(items,before)
  assert.equal(movieCollections(items,{}).length,3)
})

test('grouping happens after member, watched, watchlist and queue filters', () => {
  const items=[first,second,other], metadata={105:series,165:series,999:series}
  for (const shelf of ['all','watched','watchlist','group']) {
    const expected = moviesOnShelf(items,'me',shelf)
    assert.deepEqual(movieCollections(expected,metadata).flatMap(group=>group.items).map(item=>item.id).sort(), expected.map(item=>item.id).sort())
  }
  assert.deepEqual(movieCollections(moviesOnShelf(items,'friend','all'),metadata)[0].items.map(item=>item.id),['other'])
})

test('old records hydrate with two concurrent requests, cached standalone results and no repeated calls', async () => {
  const data=new Map(), storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)}
  const cache=movieCollectionCache(storage), results={}, calls=[]
  let active=0,max=0
  const request=async id=>{calls.push(id);active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,5));active--;return {tmdbId:id,collection:id===999?null:series}}
  assert.deepEqual(await loadMovieCollections([105,165,105,999],request,new AbortController().signal,(id,value)=>results[id]=value,cache),[])
  assert.equal(max,2);assert.equal(calls.length,3);assert.equal(results[999],null)
  assert.equal(movieCollections([first,second],results).length,1)
  await loadMovieCollections([105,165,999],()=>{throw Error('Should use cache')},new AbortController().signal,()=>{},movieCollectionCache(storage))
  assert.equal(calls.length,3)
})

test('outages, missing old-server metadata and mismatched identities remain retryable',async()=>{
  const cache=movieCollectionCache(), controller=new AbortController()
  for (const reply of [{tmdbId:105},{tmdbId:999,collection:series},{tmdbId:105,collection:{id:0,name:'Invalid'}}]) {
    assert.deepEqual(await loadMovieCollections([105],async()=>reply,controller.signal,()=>assert.fail('must not publish'),cache),[105])
    assert.equal(cache.get(105),undefined)
  }
  assert.deepEqual(await loadMovieCollections([105],async()=>{throw Error('Offline')},controller.signal,()=>{},cache),[105])
  assert.deepEqual(await loadMovieCollections([105],async()=>({tmdbId:105,collection:series}),controller.signal,()=>{},cache),[])
})

test('aborted lookups never publish or cache late results',async()=>{
  const controller=new AbortController(),cache=movieCollectionCache()
  await loadMovieCollections([105,165,999],async id=>{controller.abort();return {tmdbId:id,collection:series}},controller.signal,()=>assert.fail('late result'),cache)
  assert.equal(cache.get(105),undefined)
})

test('invalid and expired cache entries are ignored',()=>{
  for(const raw of ['broken','null','[]',JSON.stringify({105:{collection:series,expires:0}}),JSON.stringify({105:{collection:{id:0,name:'Invalid'},expires:Date.now()+99999}})]) {
    assert.equal(movieCollectionCache({getItem:()=>raw,setItem:()=>{}}).get(105),undefined)
  }
})
