import test from 'node:test'
import assert from 'node:assert/strict'
import {initializeApp,deleteApp} from 'firebase/app'
import {initializeFirestore,connectFirestoreEmulator,doc,setDoc,getDoc,getDocs,collection,FieldPath} from 'firebase/firestore'
import {makeMovie,movieId,reviewMovie} from '../src/lib/movies.ts'
import {makeGameReview} from '../src/lib/gameReviews.ts'
import {emulatorAdmin} from './emulator-admin.mjs'

test('game and movie reviews are crew-readable but author-only writes', {skip:!process.env.FIRESTORE_EMULATOR_HOST}, async () => {
  const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':'), apps=[]
  const create=uid=>{const app=initializeApp({projectId:'demo-checkpoint'},'reviews-'+uid+'-'+crypto.randomUUID());apps.push(app);const db=initializeFirestore(app,{});connectFirestoreEmulator(db,host,Number(port),uid?{mockUserToken:{sub:uid,user_id:uid}}:undefined);return db}
  const owner=create('owner'),friend=create('friend'),stranger=create('stranger'),anon=create(null),removed=create('removed'),board=crypto.randomUUID()
  const denied=promise=>assert.rejects(promise,error=>error.code==='permission-denied')
  try {
    await emulatorAdmin().doc('boards/'+board).set({games:[],books:[],members:{owner:{name:'Owner'},friend:{name:'Friend'},removed:{name:'Removed'}},removedMembers:{removed:true}})
    const path=['boards',board,'gameReviews','game-qa','members']
    await Promise.all([setDoc(doc(owner,...path,'owner'),makeGameReview('Mine',0)),setDoc(doc(friend,...path,'friend'),makeGameReview('Theirs',5))])
    assert.equal((await getDocs(collection(friend,...path))).size,2)
    await denied(setDoc(doc(friend,...path,'owner'),makeGameReview('Overwrite',1)))
    await denied(setDoc(doc(owner,...path,'owner'),{...makeGameReview('',0),text:'x'.repeat(2001)}))
    await denied(setDoc(doc(owner,...path,'owner'),{...makeGameReview('',0),stars:6}))
    await denied(setDoc(doc(owner,...path,'owner'),{...makeGameReview('',0),extra:true}))
    for (const db of [stranger,anon,removed]) {
      await denied(getDocs(collection(db,...path)))
      await denied(setDoc(doc(db,...path,'owner'),makeGameReview('Bad',1)))
    }
    await setDoc(doc(owner,...path,'owner'),makeGameReview('',0))
    assert.equal((await getDoc(doc(owner,...path,'friend'))).data().text,'Theirs')
    const draft={title:'Review QA',year:'2026',posterUrl:'',description:''},id=await movieId(draft),movie=makeMovie(id,draft,'owner'),mp=['boards',board,'movies',id]
    await setDoc(doc(owner,...mp),movie)
    await Promise.all([[owner,'owner'],[friend,'friend']].map(([db,uid])=>setDoc(doc(db,...mp),reviewMovie(movie,uid,uid+' review'),{mergeFields:[new FieldPath('reviews',uid)]})))
    const saved=(await getDoc(doc(owner,...mp))).data()
    assert.deepEqual(saved.reviews,{owner:'owner review',friend:'friend review'})
    await denied(setDoc(doc(friend,...mp),reviewMovie(saved,'owner','Overwrite')))
    await denied(setDoc(doc(owner,...mp),{...saved,reviews:{owner:'x'.repeat(2001),friend:saved.reviews.friend}}))
    await denied(setDoc(doc(owner,...mp),{...saved,reviews:{owner:42,friend:saved.reviews.friend}}))
    await denied(setDoc(doc(owner,...mp),movie))
    await setDoc(doc(owner,...mp),reviewMovie(saved,'owner',''))
    assert.equal((await getDoc(doc(friend,...mp))).data().reviews.friend,'friend review')
  } finally { await Promise.all(apps.map(deleteApp)) }
})
