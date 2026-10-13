import test from 'node:test'
import assert from 'node:assert/strict'
import {initializeApp,deleteApp} from 'firebase/app'
import {initializeFirestore,connectFirestoreEmulator,doc,setDoc,getDoc,getDocs,collection,runTransaction,deleteDoc} from 'firebase/firestore'
import {emptyFavorites,readFavorites,setPersonalFavorite} from '../src/lib/personalFavorites.ts'
import {emulatorAdmin} from './emulator-admin.mjs'

test('favorites are member-readable, owner-writable and preserve concurrent saves',{skip:!process.env.FIRESTORE_EMULATOR_HOST},async()=>{
  const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':'),apps=[]
  const create=uid=>{const app=initializeApp({projectId:'demo-checkpoint'},`favorites-${uid||'anon'}-${Date.now()}`);apps.push(app);const db=initializeFirestore(app,{});connectFirestoreEmulator(db,host,Number(port),uid?{mockUserToken:{sub:uid,user_id:uid,email:`${uid}@example.test`}}:undefined);return db}
  const owner=create('owner'),friend=create('friend'),outsider=create('outsider'),removed=create('removed'),anon=create(null)
  const board=crypto.randomUUID(),path=['boards',board,'personalFavorites','owner']
  const denied=promise=>assert.rejects(promise,error=>error.code==='permission-denied')
  const original={games:[],books:[],ownerUid:'owner',members:{owner:{name:'Owner'},friend:{name:'Friend'}},removedMembers:{removed:true}}
  try {
    await emulatorAdmin().doc(`boards/${board}`).set(original)
    await setDoc(doc(owner,...path),emptyFavorites())
    await setDoc(doc(friend,'boards',board,'personalFavorites','friend'),{games:['friend-game'],books:[],movies:[]})
    assert.equal((await getDocs(collection(friend,'boards',board,'personalFavorites'))).size,2)
    await Promise.all(['games','books','movies'].map(kind=>runTransaction(owner,async tx=>{const ref=doc(owner,...path),saved=await tx.get(ref);tx.set(ref,setPersonalFavorite(readFavorites(saved.data()),kind,kind,true))})))
    assert.deepEqual((await getDoc(doc(friend,...path))).data(),{games:['games'],books:['books'],movies:['movies']})
    await denied(setDoc(doc(friend,...path),emptyFavorites()))
    for(const db of [outsider,removed,anon]) {
      await denied(getDocs(collection(db,'boards',board,'personalFavorites')))
      await denied(setDoc(doc(db,...path),emptyFavorites()))
    }
    await denied(setDoc(doc(owner,...path),{...emptyFavorites(),extra:true}))
    await denied(setDoc(doc(owner,...path),{games:'bad',books:[],movies:[]}))
    await denied(setDoc(doc(owner,...path),{games:Array(2001).fill('x'),books:[],movies:[]}))
    await denied(deleteDoc(doc(owner,...path)))
    await setDoc(doc(owner,...path),emptyFavorites())
    assert.deepEqual((await getDoc(doc(friend,'boards',board,'personalFavorites','friend'))).data().games,['friend-game'])
    assert.deepEqual((await emulatorAdmin().doc(`boards/${board}`).get()).data(),original)
  } finally {await Promise.all(apps.map(deleteApp))}
})
