import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function connectionHarness(data, readError) {
  const writes = [], states = [], remotes = []
  let listener, failure
  const sdk = {
    doc: () => ({}),
    FieldPath: class { constructor(...parts) { this.parts = parts } },
    getDocFromServer: async () => { if (readError) throw readError; return { exists: () => Boolean(data), data: () => data } },
    updateDoc: async (...args) => { writes.push(args) },
    onSnapshot: (_ref, _options, callback, error) => { listener = callback; failure = error; return () => {} },
    serverTimestamp: () => 'server-time',
  }
  const source = readFileSync(new URL('../src/lib/sharedBoard.ts', import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  new Function('require','exports',code)(name => name === 'firebase/firestore' ? sdk : name === './firebase' ? { database: {} } : { validBookmarkColor: () => true }, exports)
  return {
    writes, states, remotes,
    connect: () => exports.connectBoard('board', { uid: 'reader', email: 'reader@example.test', photoURL: '' }, 'Reader', (...args) => remotes.push(args), state => states.push(state)),
    emit: value => listener({ exists: () => true, data: () => value, metadata: { fromCache: false } }),
    fail: error => failure(error),
  }
}
const existing = () => ({
  games: [{ id:'game', title:'Game', status:'playing' }], books: [], sessions: [], activity: [], gameNights: [],
  members: { reader: { name:'Original name', email:'reader@example.test', photoUrl:'', googlePhotoUrl:'', joinedAt:'2026-01-01', bookmarkColor:'#123abc', steamLinkPreference:'browser' } },
})

test('membership rollout keeps Firebase persisted sign-in and never resets accounts or browser storage', () => {
  const firebase = readFileSync(new URL('../src/lib/firebase.ts', import.meta.url), 'utf8')
  const membership = readFileSync(new URL('../src/lib/membership.ts', import.meta.url), 'utf8')
  const backend = readFileSync(new URL('../functions/membership.js', import.meta.url), 'utf8')
  assert.match(firebase, /app \? getAuth\(app\) : null/)
  assert.match(firebase, /onAuthStateChanged\(auth, callback\)/)
  assert.doesNotMatch(firebase, /setPersistence|inMemoryPersistence|browserSessionPersistence/)
  for (const source of [membership, backend]) assert.doesNotMatch(source, /signOut\(|revokeRefreshTokens|deleteUser|localStorage\.clear|indexedDB\.deleteDatabase/)
})

test('manual invitations use Firestore only and preserve owner-only UI', () => {
  const source = readFileSync(new URL('../src/lib/membership.ts', import.meta.url), 'utf8')
  const ui = readFileSync(new URL('../src/MembershipSettings.tsx', import.meta.url), 'utf8')
  assert.match(source, /export const invitationsEnabled = true/)
  assert.match(ui, /const token = invitationsEnabled \? invitationToken\(\) : null/)
  assert.match(ui, /if \(!isOwner\) return/)
  assert.doesNotMatch(source, /httpsCallable|firebase\/functions|membershipFunctions/)
  assert.match(source, /runTransaction/)
  assert.match(source, /crypto\.getRandomValues/)
  assert.match(source, /SHA-256/)
})

test('a failed board read never creates membership, reseeds the board or writes cached media', async () => {
  for (const [data,error] of [[null,null],[existing(),new Error('offline')],[{...existing(),members:{}},null]]) {
    const h = connectionHarness(data,error)
    await assert.rejects(h.connect())
    assert.deepEqual(h.writes,[])
    assert.deepEqual(h.remotes,[])
  }
})
test('existing profiles hydrate without resetting data; revoked access emits no further media', async () => {
  const original = existing(), h = connectionHarness(original)
  await h.connect()
  assert.deepEqual(h.writes,[])
  assert.deepEqual(h.remotes[0][0], original.games)
  assert.equal(h.remotes[0][2][0].name,'Original name')
  assert.equal(h.remotes[0][2][0].bookmarkColor,'#123abc')
  h.emit({...original,removedMembers:{reader:true}})
  assert.equal(h.states.at(-1),'denied')
  assert.equal(h.remotes.length,1)
  h.fail({code:'permission-denied'})
  assert.equal(h.states.at(-1),'denied')
})
test('malformed shared media is never replaced with an empty library', async () => {
  const h = connectionHarness({...existing(), books:[{id:'damaged'}]})
  await assert.rejects(h.connect(),/could not be read safely/)
  assert.deepEqual(h.remotes,[])
  assert.deepEqual(h.writes,[])
  const live = connectionHarness(existing()); await live.connect()
  live.emit({...existing(),sessions:'invalid'})
  assert.equal(live.states.at(-1),'error')
  assert.equal(live.remotes.length,1)
})
