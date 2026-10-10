import test from 'node:test'
import assert from 'node:assert/strict'
import {initializeApp,deleteApp} from 'firebase/app'
import {initializeFirestore,connectFirestoreEmulator,doc,setDoc,getDoc,getDocs,collection,runTransaction,deleteDoc} from 'firebase/firestore'
import {makeMovie,movieId,changeMovie} from '../src/lib/movies.ts'
import {emulatorAdmin} from './emulator-admin.mjs'

test('movies restrict access, isolate libraries and atomically protect the current group watch',{skip:!process.env.FIRESTORE_EMULATOR_HOST},async()=>{
  const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':'),apps=[]
  const create=uid=>{const app=initializeApp({projectId:'demo-checkpoint'},`movies-${uid||'anon'}-${Date.now()}`);apps.push(app);const db=initializeFirestore(app,{});connectFirestoreEmulator(db,host,Number(port),uid?{mockUserToken:{sub:uid,user_id:uid,email:`${uid}@example.test`}}:undefined);return db}
  const owner=create('owner'),friend=create('friend'),stranger=create('stranger'),anon=create(null),board=crypto.randomUUID()
  const draft={title:'QA film',year:'2026',posterUrl:'',description:''},id=await movieId(draft)
  const item=makeMovie(id,draft,'owner'),path=['boards',board,'movies',id],state=['boards',board,'movieState','current']
  const denied=promise=>assert.rejects(promise,error=>error.code==='permission-denied')
  const transition=(db,id,action)=>runTransaction(db,async tx=>{
    const ref=doc(db,'boards',board,'movies',id),stateRef=doc(db,...state)
    const [movie,current]=await Promise.all([tx.get(ref),tx.get(stateRef)])
    tx.set(ref,changeMovie(movie.data(),'owner',action,current.data()?.movieId||''))
    tx.set(stateRef,{movieId:action==='start'?id:''})
  })
  try{
    await emulatorAdmin().doc(`boards/${board}`).set({games:[],books:[],ownerUid:'owner',members:{owner:{name:'Owner'},friend:{name:'Friend'}},removedMembers:{removed:true}})
    await setDoc(doc(owner,...path),item)
    assert.equal((await getDoc(doc(friend,...path))).data().title,'QA film')
    await denied(getDoc(doc(stranger,...path)));await denied(getDocs(collection(anon,'boards',board,'movies')))
    await denied(setDoc(doc(stranger,...path),item));await denied(deleteDoc(doc(owner,...path)))
    await denied(setDoc(doc(friend,...path),{...item,libraries:{owner:false,friend:true}}))
    await setDoc(doc(friend,...path),{...item,libraries:{owner:true,friend:true}})
    await setDoc(doc(owner,...path),{...item,libraries:{owner:false,friend:true}})
    assert.equal((await getDoc(doc(friend,...path))).data().libraries.friend,true)
    await denied(setDoc(doc(owner,...path),{...item,addedBy:'friend'}))
    await denied(setDoc(doc(owner,...path),{...item,clubStatus:'watching'}))
    await transition(owner,id,'start')
    assert.equal((await getDoc(doc(friend,...state))).data().movieId,id)
    const draft2={...draft,title:'Second movie',tmdbId:550},id2=await movieId(draft2),second=makeMovie(id2,draft2,'owner')
    await setDoc(doc(owner,'boards',board,'movies',id2),second)
    await denied(setDoc(doc(owner,'boards',board,'movies',id2),{...second,tmdbId:551}))
    await denied(runTransaction(owner,async tx=>{tx.set(doc(owner,'boards',board,'movies',id2),{...second,clubStatus:'watching'});tx.set(doc(owner,...state),{movieId:id2})}))
    await denied(setDoc(doc(owner,...state),{movieId:''}))
    await transition(owner,id,'finish')
    await transition(owner,id2,'start')
    assert.equal((await getDoc(doc(friend,...state))).data().movieId,id2)
    assert.equal((await getDoc(doc(friend,...path))).data().clubStatus,'watched')
    const removed=create('removed');await denied(getDoc(doc(removed,...path)))
  }finally{await Promise.all(apps.map(deleteApp))}
})
