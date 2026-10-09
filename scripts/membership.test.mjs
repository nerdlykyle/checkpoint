import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { initializeApp, deleteApp } from 'firebase/app'
import { initializeFirestore, connectFirestoreEmulator, doc, getDocFromServer, setDoc, updateDoc, getDocs, collection } from 'firebase/firestore'
import { emulatorAdmin } from './emulator-admin.mjs'
const require = createRequire(new URL('../functions/index.js', import.meta.url))
const { createMembershipService, identity, displayName, emailAddress, hash } = require('../functions/membership.js')
const auth = uid => ({ uid, token: { email: `${uid}@example.test`, email_verified: true, firebase: { sign_in_provider: 'google.com' } } })
const profile = uid => ({ name: uid, email: `${uid}@example.test`, photoUrl: '', joinedAt: '2026-08-01T00:00:00.000Z', bookmarkColor: '#123abc', steamLinkPreference: 'browser', preferredMode: 'books', customPhotoUrl: 'https://example.test/avatar.png' })
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code)
const emulated = { skip: !process.env.FIRESTORE_EMULATOR_HOST }

test('membership requires verified Google identity and validates profile input', () => {
  assert.throws(() => identity(null), { code: 'unauthenticated' })
  for (const patch of [{ email_verified: false }, { firebase: { sign_in_provider: 'password' } }]) assert.throws(() => identity({ ...auth('a'), token: { ...auth('a').token, ...patch } }), { code: 'permission-denied' })
  assert.equal(identity(auth('a')).email, 'a@example.test')
  assert.equal(displayName(' New friend '), 'New friend')
  assert.equal(emailAddress(' Friend@Example.test '), 'friend@example.test')
  for (const value of ['', 'x'.repeat(41), 'bad\nname', null]) assert.throws(() => displayName(value))
  assert.throws(() => emailAddress('not an email'))
})

test('invite lifecycle preserves every existing UID, profile, media record and private setting', emulated, async () => {
  const db = emulatorAdmin(), boardId = crypto.randomUUID(), owner = 'o'+crypto.randomUUID(), member = 'm'+crypto.randomUUID(), newcomer = 'n'+crypto.randomUUID()
  const ref = db.doc(`boards/${boardId}`)
  const original = { ownerUid: owner, members: { [owner]: profile(owner), [member]: profile(member) }, games: [{ id: 'game', votes: [member], ownedBy: [member] }], books: [{ id: 'book', shelves: { [member]: 'read' }, progress: { [member]: 19 } }], sessions: [{ participantIds: [member] }], activity: [], gameNights: [], recommendationFeedback: { game: { downvotes: [member] } } }
  await ref.set(original)
  const music = { title: 'Album', shelves: { [member]: 'listened' } }, privateNote = { note: 'Keep me', updatedAt: '' }
  await ref.collection('music').doc('album').set(music)
  await db.doc(`readerNotes/${member}/books/book`).set(privateNote)
  await db.doc(`musicPreferences/${member}`).set({ service: 'youtube' })
  let time = Date.now()
  const service = createMembershipService(db, { now: () => time })
  const call = (uid, data) => service({ auth: auth(uid), data: { boardId, ...data } })
  await rejects(call(member, { action: 'create', email: auth(newcomer).token.email }), 'permission-denied')
  await rejects(call(newcomer, { action: 'list' }), 'permission-denied')
  await rejects(call(owner, { action: 'remove', uid: owner }), 'failed-precondition')
  const invite = await call(owner, { action: 'create', email: auth(newcomer).token.email })
  assert.equal(invite.token.length, 43)
  const stored = (await ref.collection('membershipInvites').doc(hash(invite.token)).get()).data()
  assert.equal(JSON.stringify(stored).includes(invite.token), false)
  await rejects(call(owner, { action: 'create', email: auth(newcomer).token.email }), 'already-exists')
  await rejects(call(member, { action: 'redeem', token: invite.token, name: 'Imposter' }), 'permission-denied')
  const joined = await Promise.all([1,2].map(() => call(newcomer, { action: 'redeem', token: invite.token, name: 'New friend' })))
  assert.equal(joined[0].name, 'New friend')
  let saved = (await ref.get()).data()
  assert.deepEqual(saved.members[owner], original.members[owner])
  assert.deepEqual(saved.members[member], original.members[member])
  assert.equal(saved.members[newcomer].name, 'New friend')
  await call(owner, { action: 'remove', uid: newcomer })
  await rejects(call(newcomer, { action: 'redeem', token: invite.token, name: 'Nope' }), 'failed-precondition')
  await call(owner, { action: 'remove', uid: member })
  const returnInvite = await call(owner, { action: 'create', email: auth(member).token.email })
  await call(member, { action: 'redeem', token: returnInvite.token, name: 'Do not overwrite' })
  saved = (await ref.get()).data()
  assert.deepEqual(saved.members[member], original.members[member])
  for (const key of ['games','books','sessions','activity','gameNights','recommendationFeedback','ownerUid']) assert.deepEqual(saved[key], original[key], key)
  assert.deepEqual((await ref.collection('music').doc('album').get()).data(), music)
  assert.deepEqual((await db.doc(`readerNotes/${member}/books/book`).get()).data(), privateNote)
  assert.deepEqual((await db.doc(`musicPreferences/${member}`).get()).data(), { service: 'youtube' })
  const expiring = await call(owner, { action: 'create', email: auth(newcomer).token.email })
  time += 7 * 24 * 60 * 60 * 1000 + 1
  await rejects(call(newcomer, { action: 'redeem', token: expiring.token, name: 'Expired' }), 'failed-precondition')
  const revoked = await call(owner, { action: 'create', email: auth(newcomer).token.email })
  await call(owner, { action: 'revoke', inviteId: hash(revoked.token) })
  await rejects(call(newcomer, { action: 'redeem', token: revoked.token, name: 'Revoked' }), 'failed-precondition')
  const roster = await call(owner, { action: 'list' })
  assert.ok(roster.events.some(event => event.action === 'rejoined'))
  assert.equal(JSON.stringify(roster).includes(invite.token), false)
})

test('membership rate limits failed attempts as well as successful requests', emulated, async () => {
  const uid = 'limited'+crypto.randomUUID(), boardId = crypto.randomUUID(), service = createMembershipService(emulatorAdmin())
  for (let i = 0; i < 40; i++) await rejects(service({ auth: auth(uid), data: { boardId, action: 'list' } }), 'permission-denied')
  await rejects(service({ auth: auth(uid), data: { boardId, action: 'list' } }), 'resource-exhausted')
})

test('rules reject outsider reads, self-joining, promotion and all revoked shared access', emulated, async () => {
  const db = emulatorAdmin(), boardId = crypto.randomUUID(), owner = 'o'+crypto.randomUUID(), member = 'm'+crypto.randomUUID(), outsider = 'x'+crypto.randomUUID(), apps = []
  const board = { ownerUid: owner, members: { [owner]: profile(owner), [member]: profile(member) }, games: [], books: [] }
  const ref = db.doc(`boards/${boardId}`); await ref.set(board)
  const client = uid => {
    const app = initializeApp({ projectId: 'demo-checkpoint' }, crypto.randomUUID()); apps.push(app)
    const clientDb = initializeFirestore(app, {}), [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':')
    connectFirestoreEmulator(clientDb, host, Number(port), uid ? { mockUserToken: { sub: uid, user_id: uid, ...auth(uid).token } } : undefined)
    return clientDb
  }
  const own = client(owner), mem = client(member), out = client(outsider), anon = client(null)
  const boardDoc = clientDb => doc(clientDb, 'boards', boardId)
  try {
    assert.deepEqual((await getDocFromServer(boardDoc(mem))).data(), board)
    for (const c of [out,anon]) await rejects(getDocFromServer(boardDoc(c)), 'permission-denied')
    await rejects(setDoc(doc(out,'boards',crypto.randomUUID()), { ...board, ownerUid: outsider }), 'permission-denied')
    await rejects(updateDoc(boardDoc(out), { [`members.${outsider}`]: profile(outsider) }), 'permission-denied')
    await rejects(updateDoc(boardDoc(mem), { ownerUid: member }), 'permission-denied')
    await rejects(updateDoc(boardDoc(own), { [`members.${outsider}`]: profile(outsider) }), 'permission-denied')
    await rejects(updateDoc(boardDoc(mem), { [`members.${owner}.name`]: 'overwrite' }), 'permission-denied')
    await rejects(updateDoc(boardDoc(mem), { [`members.${member}.joinedAt`]: 'changed' }), 'permission-denied')
    await updateDoc(boardDoc(mem), { [`members.${member}.bookmarkColor`]: '#abcdef' })
    for (const collectionName of ['membershipInvites','membershipEvents']) {
      await rejects(getDocs(collection(own,'boards',boardId,collectionName)), 'permission-denied')
      await rejects(setDoc(doc(own,'boards',boardId,collectionName,'fake'),{}), 'permission-denied')
    }
    await rejects(setDoc(doc(own,'discordMembership','12345'),{ uid: owner, boardId }), 'permission-denied')
    await ref.update({ [`removedMembers.${member}`]: true })
    await rejects(getDocFromServer(boardDoc(mem)), 'permission-denied')
    await rejects(updateDoc(boardDoc(mem), { [`removedMembers.${member}`]: false }), 'permission-denied')
    await rejects(updateDoc(boardDoc(mem), { books: [] }), 'permission-denied')
    for (const tail of [['music','album'],['musicState','current'],['artistFavorites',owner,'artists','artist'],['puzzles','game'],['puzzles','game','pages','page']]) {
      const path = ['boards',boardId,...tail]
      await rejects(getDocFromServer(doc(mem,...path)), 'permission-denied')
      await rejects(setDoc(doc(mem,...path),{}), 'permission-denied')
    }
    await setDoc(doc(mem,'readerNotes',member,'books','book'), { note: 'Still mine', updatedAt: '' })
    assert.equal((await getDocFromServer(doc(mem,'readerNotes',member,'books','book'))).data().note, 'Still mine')
    assert.equal((await getDocFromServer(boardDoc(own))).data().members[member].bookmarkColor, '#abcdef')
  } finally { await Promise.all(apps.map(deleteApp)) }
})
