import test from 'node:test'
import assert from 'node:assert/strict'
import { initializeApp, deleteApp } from 'firebase/app'
import { initializeFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore'

test('bookmark colors sync to crew but only the owner can change a valid color', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':'), apps = []
  const create = uid => {
    const app = initializeApp({ projectId: 'demo-checkpoint' }, `bookmark-${uid}-${Date.now()}`); apps.push(app)
    const db = initializeFirestore(app, {})
    connectFirestoreEmulator(db, host, Number(port), { mockUserToken: { sub: uid, user_id: uid, email: `${uid}@example.test` } })
    return db
  }
  const owner = create('owner'), other = create('other'), board = crypto.randomUUID()
  const profile = uid => ({ name: uid, persona: 'Jern', email: `${uid}@example.test`, photoUrl: '', joinedAt: new Date().toISOString() })
  const denied = promise => assert.rejects(promise, error => error.code === 'permission-denied')
  try {
    await setDoc(doc(owner, 'boards', board), { ownerUid: 'owner', games: [], books: [], members: { owner: profile('owner') } })
    await updateDoc(doc(other, 'boards', board), { 'members.other': profile('other') })
    await updateDoc(doc(owner, 'boards', board), { 'members.owner.bookmarkColor': '#8473ed' })
    assert.equal((await getDoc(doc(other, 'boards', board))).data().members.owner.bookmarkColor, '#8473ed')
    await denied(updateDoc(doc(other, 'boards', board), { 'members.owner.bookmarkColor': '#000000' }))
    await denied(updateDoc(doc(owner, 'boards', board), { 'members.owner.bookmarkColor': 'invalid' }))
    await updateDoc(doc(other, 'boards', board), { 'members.other.bookmarkColor': '#32b5a2' })
    await updateDoc(doc(owner, 'boards', board), { 'members.owner.photoUrl': 'https://example.test/photo.jpg' })
    const saved = (await getDoc(doc(owner, 'boards', board))).data().members
    assert.equal(saved.owner.bookmarkColor, '#8473ed')
    assert.equal(saved.other.bookmarkColor, '#32b5a2')
  } finally { await Promise.all(apps.map(deleteApp)) }
})
