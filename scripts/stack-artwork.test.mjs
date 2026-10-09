import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sharpArtworkUrl, artworkSources } from '../src/lib/sharpArtwork.ts'

test('desktop albums upgrade known 250/500px thumbnails and keep their original fallback', () => {
  for (const size of [250,500]) {
    const url=`https://coverartarchive.org/release-group/example/front-${size}`
    assert.deepEqual(artworkSources(url),{original:url,sharp:'https://coverartarchive.org/release-group/example/front-1200'})
  }
})
test('Steam cover upgrades preserve revisions and leave alternate art alone', () => {
  const url='https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/620/library_600x900.jpg?t=123'
  assert.equal(sharpArtworkUrl(url),url.replace('600x900.jpg','600x900_2x.jpg'))
  const custom='https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/asset/header_alt_assets_5.jpg?t=123'
  assert.equal(sharpArtworkUrl(custom),custom)
})
test('unknown/signed artwork is not rewritten and unsafe URLs are rejected', () => {
  for(const url of ['https://example.com/front-250?token=private','https://coverartarchive.org/release/example/front-250?signature=abc','https://shared.fastly.steamstatic.com/steam/apps/620/library_600x900.jpg?signature=abc']) assert.equal(sharpArtworkUrl(url),url)
  for(const url of ['javascript:alert(1)','data:image/svg+xml,test','https://user:pass@example.com/cover.jpg','not a URL']) assert.equal(artworkSources(url),undefined)
})
test('stack covers are high resolution with lazy loading and error fallbacks', () => {
  const read=file=>readFileSync(new URL('../src/'+file,import.meta.url),'utf8')
  assert.match(read('BookOrganizer.tsx'),/behind=.*<BookCoverImage[^>]+large lazy/)
  assert.match(read('BookCoverImage.tsx'),/useState\(large && !lazy\)/)
  assert.match(read('MusicMode.tsx'),/behind=.*<SharpArtwork/)
  assert.match(read('GameShelf.tsx'),/<SharpArtwork src={art}/)
  const image=read('SharpArtwork.tsx')
  assert.match(image,/media="\(min-width: 701px\)"/)
  assert.match(image,/currentSrc/)
  assert.match(image,/loading="lazy"/)
  for(const file of ['CollectionStack.css','GameShelf.css']) {
    assert.match(read(file),/outline:1px solid transparent/)
    assert.match(read(file),/translate3d/)
    assert.doesNotMatch(read(file),/scale\(\.98\)/)
  }
})
