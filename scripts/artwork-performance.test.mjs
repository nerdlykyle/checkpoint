import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { musicArtworkSources } from '../src/lib/musicArtwork.ts'
import { artworkTarget, allowedArtworkRedirect, cachedMusicArtwork } from '../worker/src/artwork.ts'
import { cachedBookArtwork, resolveBookArtwork, refreshBookArtwork } from '../src/lib/bookArtwork.ts'

const id = '76df3287-6cda-33eb-8e9a-044b5e15ffdd'
const path = `/music/artwork/release/${id}/500`
const request = new Request(`https://art.example${path}`)
function imageCache() {
  const items = new Map()
  return { match: async key => items.get(key.url)?.clone(), put: async (key, value) => { items.set(key.url, value) } }
}
test('music cache supports responsive sizes but never proxies arbitrary or signed URLs', () => {
  assert.deepEqual(musicArtworkSources(`https://coverartarchive.org/release/${id}/front-250`, 'https://art.example').map(row => row.size), [250,500,1200])
  for (const url of ['https://example.org/image.jpg', `https://coverartarchive.org/release/${id}/front-250?secret=private`]) assert.equal(musicArtworkSources(url, 'https://art.example'), undefined)
  assert.equal(artworkTarget(path), `https://coverartarchive.org/release/${id}/front-500`)
  assert.equal(artworkTarget(path.replace('500','9999')), undefined)
  for (const url of ['http://archive.org/image','https://archive.org.evil.test/image','https://user:pass@archive.org/image','https://127.0.0.1/image']) assert.equal(allowedArtworkRedirect(url), false)
})
test('shared image cache follows trusted redirects, caches successes and avoids repeat upstream loads', async () => {
  const cache = imageCache(), calls = []
  const fetcher = async url => { calls.push(url); return calls.length === 1 ? new Response(null, {status:302,headers:{Location:'https://archive.org/image.jpg'}}) : new Response('image bytes',{headers:{'Content-Type':'image/jpeg'}}) }
  assert.equal((await cachedMusicArtwork(request, cache, fetcher)).status, 200)
  assert.equal((await cachedMusicArtwork(request, cache, fetcher)).headers.get('Cache-Control'), 'public, max-age=604800')
  assert.equal(calls.length, 2)
})
test('image proxy refuses hostile redirects, HTML, huge images and query strings without caching errors', async () => {
  for (const reply of [new Response(null,{status:302,headers:{Location:'https://evil.test/private'}}),new Response('<html/>',{headers:{'Content-Type':'text/html'}}),new Response('too big',{headers:{'Content-Type':'image/jpeg','Content-Length':'99999999'}})]) {
    const cache=imageCache()
    assert.equal((await cachedMusicArtwork(request,cache,async()=>reply)).status,502)
    assert.equal(await cache.match(request),undefined)
  }
  assert.equal((await cachedMusicArtwork(new Request(request.url+'?url=private'),imageCache(),()=>{throw Error('must not fetch')})).status,400)
})
test('successful book URLs persist separately from user data and explicit refresh clears them', async t => {
  const data = new Map()
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable:true, value:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)} })
  t.after(() => { if(original) Object.defineProperty(globalThis,'localStorage',original); else delete globalThis.localStorage })
  const book={title:'Cache test',authors:['Author'],coverUrl:'https://example.test/cover.jpg'}
  await resolveBookArtwork(book,{large:true,signal:new AbortController().signal,probe:async()=>true})
  assert.equal(cachedBookArtwork(book,true),book.coverUrl)
  assert.ok(data.get('checkpoint-cover-cache-v1').includes(book.coverUrl))
  const restored = await import('../src/lib/bookArtwork.ts?restore-test')
  assert.equal(restored.cachedBookArtwork(book,true),book.coverUrl)
  refreshBookArtwork(book)
  assert.equal(cachedBookArtwork(book,true),undefined)
  assert.ok(!data.get('checkpoint-cover-cache-v1').includes(book.coverUrl))
})
test('mobile sleeves toggle without opening details, and only club books auto-riffle', () => {
  const read = file => readFileSync(new URL('../src/'+file,import.meta.url),'utf8')
  assert.match(read('VinylSleeve.tsx'), /aria-pressed={open} onClick={\(\) => setOpen\(value => !value\)}/)
  assert.match(read('MusicAlbumTile.css'), /\.vinyl-sleeve-wrap.is-open \.music-album-hover/)
  assert.doesNotMatch(read('MusicAlbumTile.css'), /music-album-hover \{ display:none/)
  assert.match(read('VisualControls.css'), /movie-sleeve-open,\.vinyl-sleeve-toggle\)\):hover/)
  assert.match(read('MovieArtwork.tsx'), /aria-pressed={out} onClick={\(\) => setOut\(value => !value\)}/)
  assert.match(read('PaperbackCard.tsx'), /if \(!club \|\|/)
  assert.match(read('PaperbackCard.tsx'), /image\?\.complete/)
  assert.match(read('GameArtworkCards.css'), /\.game-case-front \{[^}]*border-radius:0/)
})

test('lazy covers observe the visible artwork container, not hidden paperback initials', () => {
  const read = file => readFileSync(new URL('../src/'+file,import.meta.url),'utf8')
  const loader = read('BookCoverImage.tsx')
  assert.match(read('PaperbackCard.css'), /\.paperback-cover-front > span[^\n]+display:none/)
  assert.match(read('PaperbackCard.tsx'), /large lazy=\{!club\}/)
  assert.match(loader, /const artwork = anchor\.current\?\.parentElement/)
  assert.match(loader, /observer\.observe\(artwork\)/)
  assert.doesNotMatch(loader, /observer\.observe\(anchor\.current\)/)
  assert.match(loader, /observer\.disconnect\(\)/)
})
