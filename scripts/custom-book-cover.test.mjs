import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {coverImportUrl,catalogCoverUrl,coverCropRect,coverFileType,validCustomCover,MAX_COVER_DATA,importCover} from '../src/lib/customBookCover.ts'

test('cover imports reject credentials, local addresses, scripts and unsafe protocols',()=>{
  assert.equal(coverImportUrl('https://images.macmillan.com/cover.jpg'),'https://images.macmillan.com/cover.jpg')
  for(const url of ['http://example.com/a','https://user:pass@example.com/a','https://localhost/a','https://127.0.0.1/a','https://0x7f000001/a','https://192.168.1.1/a','https://[::1]/a','https://router.local/a','https://foo.internal/a','https://example.com:9000/a','data:image/png;base64,abc','javascript:alert(1)'])assert.throws(()=>coverImportUrl(url),url)
  assert.throws(()=>catalogCoverUrl('https://books.google.com.evil.com/a'))
  assert.throws(()=>catalogCoverUrl('https://example.com/a'))
  assert.equal(catalogCoverUrl('https://covers.openlibrary.org/b/isbn/123-L.jpg'),'https://covers.openlibrary.org/b/isbn/123-L.jpg')
})
test('stored overrides are bounded JPEGs or pinned catalog links, never arbitrary executable content',()=>{
  const base={kind:'image',image:'data:image/jpeg;base64,/9j/AA==',updatedAt:''}
  assert.ok(validCustomCover(base))
  assert.ok(validCustomCover({...base,kind:'catalog',image:'https://books.google.com/books/content?id=test'}))
  for(const image of ['data:image/svg+xml,<svg/>','javascript:alert(1)','data:image/jpeg;base64,not-jpeg',base.image+'x'.repeat(MAX_COVER_DATA)])assert.equal(validCustomCover({...base,image}),false)
  assert.equal(validCustomCover({...base,kind:'catalog',image:'https://evil.com/a.jpg'}),false)
})
test('image file signatures reject renamed SVG/HTML, accept supported raster types',()=>{
  assert.equal(coverFileType(Uint8Array.from([255,216,255,1])),'image/jpeg')
  assert.equal(coverFileType(Uint8Array.from([137,80,78,71,13,10,26,10])),'image/png')
  assert.equal(coverFileType(new TextEncoder().encode('RIFF1234WEBP')),'image/webp')
  assert.throws(()=>coverFileType(new TextEncoder().encode('<svg>')))
  assert.throws(()=>coverFileType(new TextEncoder().encode('<html>')))
})
test('crop geometry covers the preview without stretching or exposing empty edges',()=>{
  assert.deepEqual(coverCropRect(1000,1000,{zoom:1,x:.5,y:.5}),{x:(1000-2000/3)*.5,y:0,width:2000/3,height:1000})
  for(const [width,height] of [[100,1000],[1200,800],[512,768]])for(const zoom of [1,2,3]){
    const rect=coverCropRect(width,height,{zoom,x:1,y:0})
    assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=width+.001&&rect.y+rect.height<=height+.001)
    assert.ok(Math.abs(rect.width/rect.height-2/3)<.0001)
  }
  assert.throws(()=>coverCropRect(100,100,{zoom:NaN,x:0,y:0}))
})
test('remote imports never send credentials or follow redirects and enforce payload limits',async t=>{
  let options
  t.mock.method(globalThis,'fetch',async(_url,init)=>{options=init;return new Response('<html>no image</html>',{headers:{'Content-Type':'text/html'}})})
  await assert.rejects(importCover('https://images.example.com/a',new AbortController().signal))
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.mode,'cors')
  t.mock.method(globalThis,'fetch',async()=>new Response(new Uint8Array(1),{headers:{'Content-Type':'image/jpeg','Content-Length':'99999999'}}))
  await assert.rejects(importCover('https://images.example.com/a',new AbortController().signal))
})
test('overrides bypass catalog recovery and remain tied to the displayed reader',()=>{
  const read=file=>readFileSync(new URL('../src/'+file,import.meta.url),'utf8')
  assert.match(read('BookCoverImage.tsx'),/if \(personal.cover\) return <PinnedCover/)
  assert.match(read('PaperbackCard.tsx'),/<BookCoverImage book=\{book\} owner=\{user\}/)
  assert.match(read('BookOrganizer.tsx'),/<BookCoverImage[^\n]+owner=\{owner\}/)
  assert.match(read('BookCoverEditor.tsx'),/Reset to catalog cover/)
  assert.doesNotMatch(read('PersonalBookCovers.tsx'),/setDoc\(doc\(database,\s*'boards',board\),/)
})
