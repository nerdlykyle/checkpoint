import test from 'node:test'
import assert from 'node:assert/strict'
import {initializeApp,deleteApp} from 'firebase/app'
import {initializeFirestore,connectFirestoreEmulator,doc,setDoc,getDoc,getDocs,collection,deleteDoc,runTransaction,serverTimestamp} from 'firebase/firestore'
import {emulatorAdmin} from './emulator-admin.mjs'
import {updateGuideRun} from '../src/lib/farFarWestGuide.ts'

test('guide crew sync, personal isolation, concurrent edits and reset safety',{skip:!process.env.FIRESTORE_EMULATOR_HOST},async()=>{
  const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':'),apps=[]
  const create=uid=>{const app=initializeApp({projectId:'demo-checkpoint'},`guide-${uid||'anon'}-${Date.now()}`);apps.push(app);const db=initializeFirestore(app,{});connectFirestoreEmulator(db,host,Number(port),uid?{mockUserToken:{sub:uid,user_id:uid}}:undefined);return db}
  const owner=create('owner'),friend=create('friend'),outsider=create('outsider'),removed=create('removed'),anon=create(null),board=crypto.randomUUID()
  const root=['boards',board,'fieldGuides','far-far-west'],path=[...root,'maps','canyon'],unlock=[...root,'unlocks','owner']
  const original={ownerUid:'owner',members:{owner:{name:'Owner'},friend:{name:'Friend'},removed:{name:'Removed'}},removedMembers:{removed:true},games:[{id:'far'}],books:[{id:'book'}],sessions:[{id:'session',note:'Keep me'}]}
  const data=()=>({checked:['sheriff'],attempt:1,updatedBy:'owner',updatedAt:serverTimestamp()})
  const denied=promise=>assert.rejects(promise,error=>error.code==='permission-denied')
  async function change(db,user,step,attempt=1){return runTransaction(db,async t=>{const ref=doc(db,...path),saved=await t.get(ref);t.set(ref,{...updateGuideRun(saved.data(),'canyon',attempt,step,true),updatedBy:user,updatedAt:serverTimestamp()})})}
  try{
    await emulatorAdmin().doc(`boards/${board}`).set(original)
    await setDoc(doc(owner,...path),data())
    assert.deepEqual((await getDoc(doc(friend,...path))).data().checked,['sheriff'])
    assert.equal((await getDocs(collection(friend,...root,'maps'))).size,1)
    await Promise.all([change(owner,'owner','digging'),change(friend,'friend','dynamite')])
    assert.deepEqual(new Set((await getDoc(doc(owner,...path))).data().checked),new Set(['sheriff','digging','dynamite']))
    await setDoc(doc(owner,...unlock),{checked:['canyon'],updatedAt:serverTimestamp()})
    await setDoc(doc(friend,...root,'unlocks','friend'),{checked:['north'],updatedAt:serverTimestamp()})
    await denied(getDoc(doc(friend,...unlock)));await denied(setDoc(doc(friend,...unlock),{checked:[],updatedAt:serverTimestamp()}))
    for(const db of [outsider,removed,anon]){await denied(getDoc(doc(db,...path)));await denied(getDocs(collection(db,...root,'maps')));await denied(setDoc(doc(db,...path),data()));await denied(getDoc(doc(db,...unlock)))}
    for(const invalid of [{...data(),checked:['fake']},{...data(),checked:['sheriff','sheriff']},{...data(),checked:'sheriff'},{...data(),attempt:0},{...data(),attempt:5},{...data(),attempt:2},{...data(),updatedBy:'friend'},{...data(),updatedAt:''},{...data(),extra:true}])await denied(setDoc(doc(owner,...path),invalid))
    await denied(setDoc(doc(owner,...root,'maps','unknown'),data()))
    await denied(setDoc(doc(owner,'boards',board,'fieldGuides','another-guide','maps','canyon'),data()))
    await denied(setDoc(doc(owner,...unlock),{checked:['unknown'],updatedAt:serverTimestamp()}))
    await denied(deleteDoc(doc(owner,...path)));await denied(deleteDoc(doc(owner,...unlock)))
    await change(friend,'friend',null)
    assert.deepEqual((await getDoc(doc(owner,...path))).data().checked,[])
    assert.equal((await getDoc(doc(owner,...path))).data().attempt,2)
    await assert.rejects(change(owner,'owner','targets'),/new attempt/)
    assert.deepEqual((await getDoc(doc(owner,...unlock))).data().checked,['canyon'])
    assert.deepEqual((await getDoc(doc(friend,...root,'unlocks','friend'))).data().checked,['north'])
    assert.deepEqual((await emulatorAdmin().doc(`boards/${board}`).get()).data(),original)
  }finally{await Promise.all(apps.map(deleteApp))}
})
