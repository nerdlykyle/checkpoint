import test from 'node:test'
import assert from 'node:assert/strict'
import { initializeApp, deleteApp } from 'firebase/app'
import { initializeFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore'

test('private note rules isolate readers and reject malformed or oversized notes', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':')
  const apps = []
  const client = (uid) => {
    const app = initializeApp({ projectId: 'demo-checkpoint' }, `notes-${uid || 'anon'}-${Date.now()}`)
    apps.push(app)
    const db = initializeFirestore(app, {})
    connectFirestoreEmulator(db, host, Number(port), uid ? { mockUserToken: { sub: uid, user_id: uid } } : undefined)
    return db
  }
  const owner = client('nern'), other = client('jern'), anon = client(null)
  const path = ['readerNotes', 'nern', 'books', `test-${Date.now()}`]
  const note = { note: 'Private reminder', updatedAt: new Date().toISOString() }
  const denied = (operation) => assert.rejects(operation, (error) => error.code === 'permission-denied')
  try {
    await setDoc(doc(owner, ...path), note)
    assert.equal((await getDoc(doc(owner, ...path))).data().note, note.note)
    await denied(getDoc(doc(other, ...path)))
    await denied(getDoc(doc(anon, ...path)))
    await denied(getDocs(collection(other, 'readerNotes', 'nern', 'books')))
    await denied(setDoc(doc(other, ...path), note))
    await denied(deleteDoc(doc(other, ...path)))
    await denied(setDoc(doc(owner, ...path), { ...note, extra: 'not allowed' }))
    await denied(setDoc(doc(owner, ...path), { ...note, note: 'x'.repeat(4001) }))
    await setDoc(doc(owner, ...path), { ...note, note: '' })
    assert.equal((await getDoc(doc(owner, ...path))).data().note, '')
    await deleteDoc(doc(owner, ...path))
  } finally { await Promise.all(apps.map(deleteApp)) }
})
