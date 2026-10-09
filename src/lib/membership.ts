import { collection, doc, FieldPath, getDocFromServer, getDocsFromServer, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { auth, database } from './firebase'

export const invitationsEnabled = true

export type MembershipRoster = {
  members: { uid: string; name: string; email: string; photoUrl: string; role: 'owner' | 'member'; removed: boolean }[]
  invites: { id: string; email: string; expiresAt: number; status: string }[]
  events: { id: string; action: string; target: string; actorUid: string; createdAt: number }[]
}
export async function membershipAction<T>(data: Record<string, unknown>): Promise<T> {
  if (!database || !auth?.currentUser) throw new Error('Sign in with Google first.')
  const db = database, user = auth.currentUser
  const boardId = String(data.boardId || '')
  if (!/^[0-9a-f-]{36}$/i.test(boardId)) throw new Error('Invalid group link.')
  const boardRef = doc(db, 'boards', boardId)
  const invites = collection(boardRef, 'manualInvites')
  if (data.action === 'redeem') {
    const token = String(data.token || ''), name = String(data.name || '').trim()
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('This invitation link is invalid.')
    if (!name || name.length > 40 || /[\r\n\t]/.test(name)) throw new Error('Enter a display name of 1–40 characters.')
    const id = await invitationId(token), ref = doc(invites, id)
    try {
      await runTransaction(db, async transaction => {
        const invite = (await transaction.get(ref)).data()
        if (!invite || invite.email !== user.email?.toLowerCase()) throw new Error('Use the Google account this invitation was created for.')
        // A lost success response can be retried without overwriting a profile.
        if (invite.status === 'used' && invite.usedBy === user.uid) return
        if (invite.status !== 'pending' || invite.expiresAt.toMillis() <= Date.now()) throw new Error('This invitation has expired or was revoked. Ask the owner for a new link.')
        transaction.update(ref, { status: 'used', usedBy: user.uid, usedAt: serverTimestamp() })
        // Never read or rewrite media, other profiles, preferences or ownerUid.
        transaction.update(boardRef,
          new FieldPath('members', user.uid), { name, email: user.email, photoUrl: '', joinedAt: new Date().toISOString() },
          new FieldPath('membershipClaims', user.uid), id,
          'updatedAt', serverTimestamp())
      })
    } catch (error) {
      // Competing tabs can commit the same link before this transaction's rules
      // check. Confirm that exact successful claim instead of rewriting it.
      try {
        const settled = (await getDocFromServer(ref)).data()
        if (settled?.status === 'used' && settled.usedBy === user.uid && await getMembership(boardId, user.uid)) return {} as T
      } catch { /* Keep the original error when access or connectivity failed. */ }
      if ((error as { code?: string }).code === 'permission-denied') throw new Error('This link is unavailable for this Google account. Ask the owner to check the invitation.')
      throw error
    }
    return {} as T
  }
  const board = (await getDocFromServer(boardRef)).data()
  if (!board || board.ownerUid !== user.uid || board.removedMembers?.[user.uid]) throw new Error('Only the group owner can manage invitations.')
  if (data.action === 'list') {
    const records = await getDocsFromServer(invites)
    return {
      members: Object.entries(board.members || {}).map(([uid, raw]) => {
        const member = raw as { name: string; email: string; photoUrl: string }
        return { uid, ...member, role: uid === board.ownerUid ? 'owner' : 'member', removed: Boolean(board.removedMembers?.[uid]) }
      }),
      invites: records.docs.map(record => {
        const invite = record.data()
        return { id: record.id, email: invite.email, expiresAt: invite.expiresAt.toMillis(), status: invite.status === 'pending' && invite.expiresAt.toMillis() <= Date.now() ? 'expired' : invite.status }
      }).sort((a,b) => b.expiresAt - a.expiresAt),
      events: [],
    } as T
  }
  if (data.action === 'create') {
    const email = String(data.email || '').trim().toLowerCase()
    if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter their Google account email address.')
    if (Object.values(board.members || {}).some(raw => (raw as {email?: string}).email?.toLowerCase() === email)) throw new Error('This account already has a member profile. No invitation is needed; use the original Google account.')
    const token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
    await setDoc(doc(invites, await invitationId(token)), { email, createdBy: user.uid, createdAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 7 * 86400000), status: 'pending' })
    return { token } as T
  }
  if (data.action === 'revoke') {
    const id = String(data.inviteId || '')
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('Invalid invitation.')
    await updateDoc(doc(invites, id), { status: 'revoked', revokedAt: serverTimestamp() })
    return {} as T
  }
  throw new Error('Unsupported membership action.')
}

export async function invitationId(token: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2,'0')).join('')
}
export async function getMembership(boardId: string, uid: string) {
  if (!database) return null
  try {
    // Server-only admission: cached/local profiles never authorize a new session.
    const snapshot = await getDocFromServer(doc(database, 'boards', boardId))
    const board = snapshot.data(), member = board?.members?.[uid]
    if (!member || board?.removedMembers?.[uid]) return null
    return { name: String(member.name || member.persona || 'Member'), owner: board?.ownerUid === uid }
  } catch (error) {
    if ((error as { code?: string }).code === 'permission-denied') return null
    throw error
  }
}
export function invitationToken() {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('invite')
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null
}
export function clearInvitation(boardId: string) {
  window.history.replaceState(null, '', `${location.pathname}${location.search}#board=${boardId}`)
}
export function invitationUrl(boardId: string, token: string) {
  // A fragment is not sent in HTTP requests or referrer headers.
  return `${location.origin}${location.pathname}#board=${boardId}&invite=${encodeURIComponent(token)}`
}
