import test from 'node:test'
import assert from 'node:assert/strict'
import {parseMusicLink,catalogItem} from '../worker/src/music.js'
import {inMusicLibrary,listeningLink,makeMusicItem,musicFromFriends,musicQueue,recordListen,removeMusicFromLibrary,safeHttpUrl,saveMusicShelf,saveMusicToLibrary,serviceLink,voteMusic} from '../src/lib/music.ts'
const album=()=>makeMusicItem({id:'sample',title:'Some Album',artists:['An Artist'],kind:'album'},'nern')
test('every legacy music status and favorite-only entry stays in the simplified library',()=>{
  for(const shelf of ['to-listen','listening','listened','not-for-me'])assert.equal(inMusicLibrary({...album(),shelves:{nern:shelf}},'nern'),true)
  assert.equal(inMusicLibrary({...album(),favorites:['nern']},'nern'),true)
  assert.equal(inMusicLibrary(album(),'nern'),false)
})
test('friend saves keep attribution per user, survive duplicate adds, and never change the source collection',()=>{
  const original={...album(),shelves:{jern:'to-listen',vern:'listening'},organization:{jern:{tags:['Road trip'],order:1}}}
  const saved=saveMusicToLibrary(original,'nern',2,'jern')
  assert.equal(saved.organization.nern.savedFrom,'jern')
  assert.deepEqual(saved.organization.jern,original.organization.jern)
  assert.equal(saved.shelves.jern,'to-listen')
  assert.equal(saveMusicToLibrary(saved,'nern',9,'vern'),saved)
  assert.deepEqual(musicFromFriends([saved],'nern'),[saved])
  assert.deepEqual(musicFromFriends([saved],'vern'),[])
  assert.equal(saveMusicToLibrary(album(),'nern',1,'nern').organization.nern.savedFrom,undefined)
  assert.equal(saveMusicToLibrary(album(),'nern',1,'missing').organization.nern.savedFrom,undefined)
})
test('removal hides favorites too without deleting shared records, reviews, history or friends; re-add sets fresh provenance',()=>{
  let item=saveMusicToLibrary({...album(),shelves:{jern:'listened',vern:'listened'},ratings:{nern:{stars:5,review:'Love it',updatedAt:''}},comments:[{id:'c',text:'Great',userId:'jern',createdAt:''}],listens:[{id:'l',userId:'nern',date:'2026-10-01',note:'First listen'}]},'nern',1,'jern')
  item={...item,favorites:['nern','jern'],organization:{...item.organization,nern:{...item.organization.nern,tags:['Workout']}}}
  const removed=removeMusicFromLibrary(item,'nern')
  assert.equal(inMusicLibrary(removed,'nern'),false)
  assert.equal(inMusicLibrary(removed,'jern'),true)
  assert.deepEqual(musicFromFriends([removed],'nern'),[])
  for(const key of ['comments','ratings','listens'])assert.deepEqual(removed[key],item[key])
  assert.deepEqual(removed.organization.nern.tags,['Workout'])
  assert.equal(saveMusicToLibrary(removed,'nern',2).organization.nern.savedFrom,undefined)
  assert.equal(saveMusicToLibrary(removed,'nern',2,'vern').organization.nern.savedFrom,'vern')
  assert.equal(item.organization.nern.savedFrom,'jern')
})
test('both services use clearly labeled searches until a safe direct link is supplied',()=>{
  const item=album()
  assert.equal(listeningLink(item,'spotify').label,'Search Spotify')
  assert.equal(listeningLink(item,'youtube').label,'Search YouTube Music')
  item.links.spotify='https://open.spotify.com/album/0123456789012345678901?si=tracking'
  assert.equal(listeningLink(item,'spotify').label,'Open in Spotify')
  assert.equal(listeningLink(item,'spotify').url,'https://open.spotify.com/album/0123456789012345678901')
  assert.match(listeningLink(item,'youtube').url,/An%20Artist%20Some%20Album/)
})
test('service parsers reject lookalike hosts, credentials, scripts and arbitrary endpoints',()=>{
  for(const value of ['javascript:alert(1)','https://open.spotify.com.evil.test/album/0123456789012345678901','https://open.spotify.com@evil.test/album/0123456789012345678901','http://127.0.0.1:8080/secrets','https://music.youtube.com/redirect?q=secret']){
    assert.equal(serviceLink(value,'spotify'),undefined);assert.equal(serviceLink(value,'youtube'),undefined);assert.equal(parseMusicLink(value),null)
  }
  assert.equal(safeHttpUrl('javascript:alert(1)'),undefined)
  const url='https://youtu.be/abcdefghijk'
  assert.equal(serviceLink(url,'youtube'),'https://music.youtube.com/watch?v=abcdefghijk')
  assert.equal(parseMusicLink(url).url,serviceLink(url,'youtube'))
})
test('one or two no votes retain nomination, three close it without changing anyone’s shelves',()=>{
  let item={...album(),nominated:true,shelves:{nern:'listening',jern:'to-listen'},ratings:{nern:{stars:5,review:'Great',updatedAt:''}}}
  for(const user of ['nern','jern']){item=voteMusic(item,user,'down');assert.equal(item.passedOn,false)}
  item=voteMusic(item,'vern','down');assert.equal(item.passedOn,true)
  assert.deepEqual(item.shelves,{nern:'listening',jern:'to-listen'});assert.equal(item.ratings.nern.stars,5)
  assert.equal(voteMusic(item,'nern','up'),item)
})
test('votes toggle and cannot count one person twice or in both directions',()=>{
  let item=voteMusic(album(),'nern','up');assert.deepEqual(item.upvotes,['nern'])
  item=voteMusic(item,'nern','down');assert.deepEqual(item.upvotes,[]);assert.deepEqual(item.downvotes,['nern'])
  item=voteMusic(item,'nern','down');assert.deepEqual(item.downvotes,[])
})
test('personal shelves, favorites and repeat listens do not change club state or reviews',()=>{
  const initial={...album(),club:{status:'listening',participants:['jern'],order:1},favorites:['nern'],ratings:{nern:{stars:4,review:'Nice',updatedAt:''}},shelves:{jern:'to-listen'}}
  let item=saveMusicShelf(initial,'nern','listening',2)
  item=recordListen(item,'nern','2026-10-01','First listen','one')
  item=saveMusicShelf(item,'nern','listening',3)
  item=recordListen(item,'nern','2026-10-02','Again','two')
  assert.equal(item.listens.length,2);assert.equal(item.shelves.jern,'to-listen')
  for(const key of ['club','favorites','ratings'])assert.deepEqual(item[key],initial[key])
  assert.equal(initial.shelves.nern,undefined)
})
test('personal ordering is isolated by user; catalog mapping retains stable identifiers',()=>{
  const a=saveMusicShelf(album(),'nern','to-listen',2),b=saveMusicShelf({...album(),id:'b'},'nern','to-listen',1)
  assert.deepEqual(musicQueue([a,b],'nern','to-listen').map(item=>item.id),['b','sample'])
  assert.deepEqual(musicQueue([a,b],'jern'),[])
  const mapped=catalogItem({id:'abcd',title:'Example', 'primary-type':'EP','artist-credit':[{artist:{name:'Artist',id:'artist-id'}}],genres:[{name:'rock'}]},'album')
  assert.equal(mapped.kind,'ep');assert.deepEqual(mapped.artistIds,['artist-id']);assert.deepEqual(mapped.links,{})
})
