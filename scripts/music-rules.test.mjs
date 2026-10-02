import test from 'node:test'
import assert from 'node:assert/strict'
import {initializeApp,deleteApp} from 'firebase/app'
import {initializeFirestore,connectFirestoreEmulator,doc,setDoc,getDoc,getDocs,collection,updateDoc,runTransaction} from 'firebase/firestore'
import {makeMusicItem} from '../src/lib/music.ts'
test('music records sync across crew, preserve concurrent edits, and isolate private data',{skip:!process.env.FIRESTORE_EMULATOR_HOST},async()=>{
  const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':'),apps=[]
  const create=(uid)=>{const app=initializeApp({projectId:'demo-checkpoint'},`music-${uid||'anon'}-${Date.now()}`);apps.push(app);const db=initializeFirestore(app,{});connectFirestoreEmulator(db,host,Number(port),uid?{mockUserToken:{sub:uid,user_id:uid,email:`${uid}@example.test`}}:undefined);return db}
  const owner=create('owner'),other=create('other'),outsider=create('outsider'),anon=create(null)
  const board=crypto.randomUUID(),profile=(uid)=>({name:uid,persona:'Jern',email:`${uid}@example.test`,photoUrl:'',joinedAt:new Date().toISOString()})
  const path=['boards',board,'music','test-album'],item=makeMusicItem({id:'test-album',title:'Test album',artists:['Test artist'],kind:'album'},'owner')
  const denied=(promise)=>assert.rejects(promise,error=>error.code==='permission-denied')
  try{
    await setDoc(doc(owner,'boards',board),{games:[],books:[],ownerUid:'owner',members:{owner:profile('owner')}})
    await updateDoc(doc(other,'boards',board),{'members.other':profile('other')})
    await setDoc(doc(owner,...path),item)
    assert.equal((await getDoc(doc(other,...path))).data().title,'Test album')
    assert.equal((await getDocs(collection(other,'boards',board,'music'))).size,1)
    await denied(getDoc(doc(outsider,...path)));await denied(getDocs(collection(anon,'boards',board,'music')))
    await denied(setDoc(doc(outsider,...path),item))
    await Promise.all([[owner,'owner'],[other,'other']].map(([db,uid])=>runTransaction(db,async tx=>{const ref=doc(db,...path),snapshot=await tx.get(ref),old=snapshot.data();tx.set(ref,{...old,shelves:{...old.shelves,[uid]:'to-listen'}})})))
    assert.deepEqual((await getDoc(doc(owner,...path))).data().shelves,{owner:'to-listen',other:'to-listen'})
    await setDoc(doc(owner,'readerNotes','owner','music','test-album'),{note:'Private',updatedAt:''})
    await denied(getDoc(doc(other,'readerNotes','owner','music','test-album')))
    await denied(setDoc(doc(other,'readerNotes','owner','music','test-album'),{note:'Changed',updatedAt:''}))
    await setDoc(doc(owner,'musicPreferences','owner'),{service:'youtube'})
    await denied(getDoc(doc(other,'musicPreferences','owner')))
    await denied(setDoc(doc(other,'musicPreferences','owner'),{service:'spotify'}))
    await denied(setDoc(doc(owner,...path),{...item,tracks:Array.from({length:151},()=>({title:'too many'}))}))
    await denied(setDoc(doc(owner,'musicPreferences','owner'),{service:'invalid'}))
  }finally{await Promise.all(apps.map(deleteApp))}
})
