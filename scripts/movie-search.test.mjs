import test from 'node:test'
import assert from 'node:assert/strict'
import {authorizeMovieCatalog,mapMovie,movieCatalog} from '../worker/src/movies.js'
import {movieId,validateMovie} from '../src/lib/movies.ts'

const row={id:550,title:'Fight Club',release_date:'1999-10-15',poster_path:'/poster.jpg',overview:'A synopsis.',adult:false}
test('TMDB results have stable identity and safe high-resolution images',async()=>{
  const mapped=mapMovie(row)
  assert.deepEqual(mapped,{tmdbId:550,title:'Fight Club',year:'1999',posterUrl:'https://image.tmdb.org/t/p/w780/poster.jpg',description:'A synopsis.'})
  assert.equal(mapMovie({...row,poster_path:'https://attacker.test/image'}).posterUrl,'')
  assert.equal(mapMovie({...row,adult:true}),null)
  assert.equal(mapMovie({...row,id:-1}),null)
  assert.equal(mapMovie({...row,release_date:''}).year,'')
  assert.equal(validateMovie(mapped).tmdbId,550)
  assert.equal(await movieId(mapped),await movieId({...mapped,title:'Translated title'}))
  assert.notEqual(await movieId(mapped),await movieId({...mapped,tmdbId:551}))
  assert.throws(()=>validateMovie({...mapped,tmdbId:1.5}))
})
test('TMDB search keeps secrets in headers, validates requests and caches public results',async()=>{
  let calls=0
  const fetcher=async(url,options)=>{
    calls++;assert.equal(options.headers.Authorization,'Bearer test-secret')
    assert.ok(!url.includes('test-secret'));assert.equal(new URL(url).hostname,'api.themoviedb.org')
    assert.equal(new URL(url).searchParams.get('include_adult'),'false')
    assert.equal(new URL(url).searchParams.get('primary_release_year'),'1999')
    return Response.json({results:[row,{...row,id:551,adult:true}]})
  }
  const env={TMDB_READ_ACCESS_TOKEN:'test-secret'},params={action:'search',q:'Test cache & value',year:'1999'}
  assert.equal((await movieCatalog(env,params,fetcher)).items.length,1)
  await movieCatalog(env,params,fetcher);assert.equal(calls,1)
  await assert.rejects(movieCatalog(env,{action:'detail',id:'../secret'},fetcher),error=>error.status===400)
  await assert.rejects(movieCatalog(env,{action:'search',q:'x'},fetcher),error=>error.status===400)
  await assert.rejects(movieCatalog({},params,fetcher),error=>error.status===503)
})
test('provider quota, unavailable details and malformed responses fail clearly without leaking secrets',async()=>{
  const env={TMDB_READ_ACCESS_TOKEN:'private-secret'}
  for(const [upstream,expected] of [[429,429],[401,503],[403,503],[404,404],[500,502]]){
    await assert.rejects(movieCatalog(env,{action:'detail',id:String(90000+upstream)},async()=>new Response('private upstream text',{status:upstream})),error=>error.status===expected&&!error.message.includes('private'))
  }
  await assert.rejects(movieCatalog(env,{action:'search',q:'Malformed test'},async()=>Response.json({wrong:true})),error=>error.status===502)
  assert.equal((await movieCatalog(env,{action:'detail',id:'550'},async()=>Response.json(row))).tmdbId,550)
})
test('movie search verifies board membership with Firebase before provider access',async()=>{
  const env={FIREBASE_PROJECT_ID:'demo-checkpoint',CHECKPOINT_BOARD_ID:'test-board'}
  const request=new Request('https://worker.test/movies/catalog',{headers:{Authorization:'Bearer abcdefghijklmnopqrstuvwxyz'}})
  let calls=0
  await authorizeMovieCatalog(request,env,async(url,options)=>{
    calls++;assert.equal(new URL(url).hostname,'firestore.googleapis.com')
    assert.equal(new URL(url).searchParams.get('mask.fieldPaths'),'ownerUid')
    assert.equal(options.headers.Authorization,request.headers.get('Authorization'))
    return Response.json({fields:{ownerUid:{stringValue:'owner'}}})
  })
  assert.equal(calls,1)
  for(const status of [401,403,404])await assert.rejects(authorizeMovieCatalog(request,env,async()=>new Response('',{status})),error=>error.status===403)
  await assert.rejects(authorizeMovieCatalog(new Request('https://worker.test'),env),error=>error.status===401)
})
