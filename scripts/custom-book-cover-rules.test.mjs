import test from 'node:test'
import assert from 'node:assert/strict'
import {initializeApp,deleteApp} from 'firebase/app'
import {initializeFirestore,connectFirestoreEmulator,doc,setDoc,getDoc,getDocs,collection,deleteDoc} from 'firebase/firestore'
import {emulatorAdmin} from './emulator-admin.mjs'
test('custom covers are crew-readable, owner-only edits and independent of books and other readers',{skip:!process.env.FIRESTORE_EMULATOR_HOST},async()=>{
  const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':'),apps=[]
  const create=uid=>{const app=initializeApp({projectId:'demo-checkpoint'},`covers-${uid||'anon'}-${Date.now()}`);apps.push(app);const db=initializeFirestore(app,{});connectFirestoreEmulator(db,host,Number(port),uid?{mockUserToken:{sub:uid,user_id:uid}}:undefined);return db}
  const owner=create('owner'),friend=create('friend'),outsider=create('outsider'),removed=create('removed'),anon=create(null),board=crypto.randomUUID()
  const path=['boards',board,'bookCovers','owner','covers','book'],data={kind:'image',image:'data:image/jpeg;base64,/9j/AA==',updatedAt:''}
  const original={ownerUid:'owner',members:{owner:{name:'Owner'},friend:{name:'Friend'},removed:{name:'Removed'}},removedMembers:{removed:true},books:[{id:'book',progress:{owner:12},ratings:{friend:5}}],games:[]}
  const denied=promise=>assert.rejects(promise,error=>error.code==='permission-denied')
  try{
    await emulatorAdmin().doc(`boards/${board}`).set(original)
    await setDoc(doc(owner,...path),data)
    assert.deepEqual((await getDoc(doc(friend,...path))).data(),data)
    assert.equal((await getDocs(collection(friend,...path.slice(0,-1)))).size,1)
    await denied(setDoc(doc(friend,...path),data));await denied(deleteDoc(doc(friend,...path)))
    for(const db of [outsider,removed,anon]){await denied(getDoc(doc(db,...path)));await denied(getDocs(collection(db,...path.slice(0,-1))));await denied(setDoc(doc(db,...path),data))}
    for(const invalid of [{...data,image:'data:image/svg+xml,<svg/>'},{...data,image:data.image+'x'.repeat(180000)},{...data,extra:true},{...data,kind:'catalog',image:'https://books.google.com.evil.com/a.jpg'},{...data,kind:'catalog',image:'https://user@books.google.com/a.jpg'}])await denied(setDoc(doc(owner,...path),invalid))
    await setDoc(doc(owner,...path),{...data,kind:'catalog',image:'https://covers.openlibrary.org/b/isbn/123-L.jpg'})
    const friendPath=['boards',board,'bookCovers','friend','covers','book']
    await setDoc(doc(friend,...friendPath),data)
    await deleteDoc(doc(owner,...path))
    assert.equal((await getDoc(doc(owner,...path))).exists(),false)
    assert.deepEqual((await getDoc(doc(owner,...friendPath))).data(),data)
    assert.deepEqual((await emulatorAdmin().doc(`boards/${board}`).get()).data(),original)
  }finally{await Promise.all(apps.map(deleteApp))}
})
