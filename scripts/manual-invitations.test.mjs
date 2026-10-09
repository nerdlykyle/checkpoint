import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { initializeApp, deleteApp } from 'firebase/app'
import * as sdk from 'firebase/firestore'
import { emulatorAdmin } from './emulator-admin.mjs'

const emulated = { skip: !process.env.FIRESTORE_EMULATOR_HOST }
const code = ts.transpileModule(readFileSync(new URL('../src/lib/membership.ts', import.meta.url),'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const denied = promise => assert.rejects(promise, error => error.code === 'permission-denied')
async function fixture() {
  const admin = emulatorAdmin(), boardId = crypto.randomUUID(), apps = []
  const owner = 'owner-'+crypto.randomUUID(), existing = 'old-'+crypto.randomUUID()
  const original = { ownerUid: owner, members: {
    [owner]: { name:'Owner', email:owner+'@example.test', photoUrl:'', joinedAt:'2026-01-01' },
    [existing]: { name:'Existing', email:existing+'@example.test', photoUrl:'custom', joinedAt:'2026-01-01', bookmarkColor:'#123abc', preferredMode:'music' },
  }, games:[{id:'saved-game',votes:[existing]}],books:[{id:'saved-book',shelves:{[existing]:'read'}}],sessions:[{note:'Keep'}],gameNights:[],activity:[],recommendationFeedback:{} }
  const ref=admin.doc('boards/'+boardId); await ref.set(original)
  await ref.collection('music').doc('saved-album').set({title:'Saved',shelves:{[existing]:'listened'}})
  await admin.doc(`readerNotes/${existing}/books/book`).set({note:'private',updatedAt:''})
  await admin.doc(`musicPreferences/${existing}`).set({service:'youtube'})
  function client(uid, claims={}) {
    const email=uid+'@example.test'
    const app=initializeApp({projectId:'demo-checkpoint'},crypto.randomUUID());apps.push(app)
    const db=sdk.initializeFirestore(app,{})
    const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':')
    sdk.connectFirestoreEmulator(db,host,Number(port),{mockUserToken:{sub:uid,user_id:uid,email,email_verified:true,firebase:{sign_in_provider:'google.com'},...claims}})
    const user={uid,email:claims.email||email}, exports={}
    new Function('require','exports',code)(name=>name==='firebase/firestore'?sdk:{database:db,auth:{currentUser:user}},exports)
    return {db,uid,user,api:exports,call:data=>exports.membershipAction({boardId,...data}),board:sdk.doc(db,'boards',boardId)}
  }
  const own=client(owner), member=client(existing)
  async function invite(recipient) { return own.call({action:'create',email:recipient.user.email}) }
  async function rawJoin(recipient,token,{boardPatch={},invitePatch={},boardOnly=false,inviteOnly=false}={}) {
    const id=await recipient.api.invitationId(token),batch=sdk.writeBatch(recipient.db)
    if(!inviteOnly)batch.update(recipient.board,{['members.'+recipient.uid]:{name:'New reader',email:recipient.user.email,photoUrl:'',joinedAt:'2026-10-09'},['membershipClaims.'+recipient.uid]:id,updatedAt:sdk.serverTimestamp(),...boardPatch})
    if(!boardOnly)batch.update(sdk.doc(recipient.db,'boards',boardId,'manualInvites',id),{status:'used',usedBy:recipient.uid,usedAt:sdk.serverTimestamp(),...invitePatch})
    return batch.commit()
  }
  return {admin,boardId,owner,existing,original,ref,own,member,client,invite,rawJoin,close:()=>Promise.all(apps.map(deleteApp))}
}

test('free invitations: actual client creates, redeems concurrently, retries safely, and preserves all existing data',emulated,async()=>{
  const f=await fixture()
  try {
    const newcomer=f.client('new-'+crypto.randomUUID()),wrong=f.client('wrong-'+crypto.randomUUID())
    await denied(sdk.getDocFromServer(newcomer.board))
    const {token}=await f.invite(newcomer),id=await newcomer.api.invitationId(token)
    assert.match(token,/^[A-Za-z0-9_-]{43}$/);assert.match(id,/^[a-f0-9]{64}$/)
    const stored=(await f.ref.collection('manualInvites').doc(id).get()).data()
    assert.equal(JSON.stringify(stored).includes(token),false)
    await assert.rejects(wrong.call({action:'redeem',token,name:'Wrong'}),/unavailable/)
    await Promise.all([1,2].map(()=>newcomer.call({action:'redeem',token,name:'New reader'})))
    await newcomer.call({action:'redeem',token,name:'Must not overwrite'})
    const saved=(await sdk.getDocFromServer(newcomer.board)).data()
    assert.equal(saved.members[newcomer.uid].name,'New reader')
    for(const uid of [f.owner,f.existing])assert.deepEqual(saved.members[uid],f.original.members[uid])
    for(const key of ['ownerUid','games','books','sessions','gameNights','activity','recommendationFeedback'])assert.deepEqual(saved[key],f.original[key])
    assert.deepEqual((await sdk.getDocFromServer(sdk.doc(newcomer.db,'boards',f.boardId,'music','saved-album'))).data(),{title:'Saved',shelves:{[f.existing]:'listened'}})
    await denied(sdk.getDocFromServer(sdk.doc(newcomer.db,'readerNotes',f.existing,'books','book')))
    assert.equal((await f.admin.doc(`readerNotes/${f.existing}/books/book`).get()).data().note,'private')
    assert.deepEqual((await f.admin.doc(`musicPreferences/${f.existing}`).get()).data(),{service:'youtube'})
    const roster=await f.own.call({action:'list'})
    assert.equal(roster.invites[0].status,'used');assert.equal(roster.members.length,3)
    await sdk.updateDoc(newcomer.board,{['members.'+newcomer.uid+'.bookmarkColor']:'#abcdef'})
  } finally {await f.close()}
})

test('free invitation rules reject unauthorized creation, listing, atomicity bypasses, data changes and privilege escalation',emulated,async()=>{
  const f=await fixture()
  try {
    const guest=f.client('guest-'+crypto.randomUUID()),{token}=await f.invite(guest),id=await guest.api.invitationId(token)
    const inv=sdk.doc(guest.db,'boards',f.boardId,'manualInvites',id)
    assert.equal((await sdk.getDocFromServer(inv)).data().status,'pending')
    for(const client of [guest,f.member]) {
      await denied(sdk.getDocsFromServer(sdk.collection(client.db,'boards',f.boardId,'manualInvites')))
      await denied(sdk.setDoc(sdk.doc(client.db,'boards',f.boardId,'manualInvites','a'.repeat(64)),{email:guest.user.email,createdBy:client.uid,createdAt:sdk.serverTimestamp(),expiresAt:sdk.Timestamp.fromMillis(Date.now()+100000),status:'pending'}))
    }
    await denied(f.rawJoin(guest,token,{boardOnly:true}))
    await denied(f.rawJoin(guest,token,{inviteOnly:true}))
    for(const patch of [{ownerUid:guest.uid},{games:[]},{books:[]},{['members.'+f.existing+'.name']:'Overwrite'},{removedMembers:{[f.owner]:true}},{['membershipClaims.'+f.owner]:id}])await denied(f.rawJoin(guest,token,{boardPatch:patch}))
    await denied(f.rawJoin(guest,token,{invitePatch:{email:'changed@example.test'}}))
    await denied(f.rawJoin(guest,token,{invitePatch:{usedBy:f.existing}}))
    await denied(f.rawJoin(guest,token,{boardPatch:{['members.'+guest.uid+'.role']:'owner'}}))
    assert.deepEqual((await f.ref.get()).data(),f.original)
    assert.equal((await f.ref.collection('manualInvites').doc(id).get()).data().status,'pending')
    await f.rawJoin(guest,token)
    await denied(f.rawJoin(guest,token))
    await denied(sdk.updateDoc(inv,{status:'pending'}))
    await denied(sdk.deleteDoc(inv))
    await denied(sdk.setDoc(sdk.doc(f.own.db,'boards',f.boardId,'manualInvites','b'.repeat(64)),{email:guest.user.email,createdBy:f.owner,createdAt:sdk.serverTimestamp(),expiresAt:sdk.Timestamp.fromMillis(Date.now()+8*86400000),status:'pending'}))
  } finally {await f.close()}
})

test('free invitations reject expired/revoked links, wrong or unverified identities, and existing profile replacement',emulated,async()=>{
  const f=await fixture()
  try {
    for(const kind of ['expired','revoked','unverified','password','existing','removed']) {
      const uid=kind==='existing'?f.existing:kind+'-'+crypto.randomUUID()
      const guest=f.client(uid,kind==='unverified'?{email_verified:false}:kind==='password'?{firebase:{sign_in_provider:'password'}}:{})
      let token
      if(kind==='existing') {
        // A malicious owner client still cannot overwrite an existing profile.
        token='Z'.repeat(43)
        await f.ref.collection('manualInvites').doc(await guest.api.invitationId(token)).set({email:guest.user.email,status:'pending',expiresAt:new Date(Date.now()+100000),createdBy:f.owner})
      } else ({token}=await f.invite(guest))
      const id=await guest.api.invitationId(token)
      if(kind==='expired')await f.ref.collection('manualInvites').doc(id).update({expiresAt:new Date(Date.now()-1000)})
      if(kind==='revoked')await f.own.call({action:'revoke',inviteId:id})
      if(kind==='removed')await f.ref.update({['removedMembers.'+uid]:true})
      await denied(f.rawJoin(guest,token))
    }
    const saved=(await f.ref.get()).data();assert.deepEqual(saved.members,f.original.members)
    await assert.rejects(f.own.call({action:'create',email:f.member.user.email}),/already has a member profile/)
    await assert.rejects(f.member.call({action:'create',email:'new@example.test'}),/Only the group owner/)
  } finally {await f.close()}
})
