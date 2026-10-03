import test from 'node:test'
import assert from 'node:assert/strict'
import {artistServiceLink,makeFavoriteArtist} from '../src/lib/musicArtists.ts'
import {musicCatalog} from '../worker/src/music.js'
test('favorite artists normalize safe metadata and remove without destroying the record',()=>{
 const artist=makeFavoriteArtist({id:'artist-1',name:'  A Band ',imageUrl:'javascript:alert(1)',imageCredit:'Credit',spotify:'https://open.spotify.com/artist/0123456789012345678901'})
 assert.equal(artist.name,'A Band');assert.equal(artist.imageUrl,'');assert.equal(artist.active,true)
 const removed=makeFavoriteArtist(artist,false)
 assert.equal(removed.createdAt,artist.createdAt);assert.equal(removed.active,false);assert.equal(removed.imageCredit,'Credit')
 assert.equal(makeFavoriteArtist(removed).active,true)
 assert.throws(()=>makeFavoriteArtist({id:'../../bad',name:'Bad'}))
})
test('artist service links are direct only for exact supported artist/channel URLs',()=>{
 const artist={name:'Nine Inch Nails',spotify:'https://open.spotify.com/artist/0123456789012345678901',youtube:'https://music.youtube.com/channel/UC0123456789012345678901'}
 assert.equal(artistServiceLink(artist,'spotify').direct,true)
 assert.equal(artistServiceLink(artist,'youtube').direct,true)
 for(const url of ['javascript:alert(1)','https://open.spotify.com.evil.test/artist/0123456789012345678901','https://user:pass@open.spotify.com/artist/0123456789012345678901'])assert.equal(artistServiceLink({...artist,spotify:url},'spotify').direct,false)
 assert.match(artistServiceLink({...artist,youtube:''},'youtube').url,/search\?q=Nine%20Inch%20Nails/)
})
test('artist catalog uses verified MusicBrainz relationships and returns photo licensing',async()=>{
 const original=globalThis.fetch,calls=[]
 globalThis.fetch=async url=>{
  calls.push(String(url))
  if(String(url).includes('musicbrainz.org'))return Response.json({name:'Example Band',type:'Group',relations:[{url:{resource:'https://www.wikidata.org/wiki/Q123'}},{url:{resource:'https://open.spotify.com/artist/0123456789012345678901'}},{url:{resource:'https://evil.test/wiki/Q999'}}]})
  if(String(url).includes('wikidata.org'))return Response.json({entities:{Q123:{claims:{P18:[{mainsnak:{datavalue:{value:'Example.jpg'}}}]}}}})
  return Response.json({query:{pages:{123:{imageinfo:[{thumburl:'https://upload.wikimedia.org/example.jpg',extmetadata:{Artist:{value:'<b>Photographer</b>'},LicenseShortName:{value:'CC BY-SA 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by-sa/4.0/'}}}]}}}})
 }
 try{
  const result=await musicCatalog({action:'artist-detail',id:'01234567-0123-0123-0123-012345678901'})
  assert.equal(result.name,'Example Band');assert.equal(result.imageCredit,'Photographer');assert.equal(result.imageLicense,'CC BY-SA 4.0')
  assert.equal(result.imageUrl,'https://upload.wikimedia.org/example.jpg');assert.match(result.imageSource,/File:Example.jpg/)
  assert.equal(calls.some(url=>url.includes('evil.test')),false)
  await assert.rejects(musicCatalog({action:'artist-detail',id:'https://evil.test'}))
 }finally{globalThis.fetch=original}
})
test('missing artist photography still returns usable artist metadata',async()=>{
 const original=globalThis.fetch
 globalThis.fetch=async()=>Response.json({name:'No Photo Artist',relations:[]})
 try{const result=await musicCatalog({action:'artist-detail',id:'11234567-0123-0123-0123-012345678901'});assert.equal(result.name,'No Photo Artist');assert.equal(result.imageUrl,'')}finally{globalThis.fetch=original}
})
