const { randomBytes, createHash } = require('node:crypto')
const { FieldPath, FieldValue } = require('firebase-admin/firestore')
const { HttpsError } = require('firebase-functions/v2/https')

const hash = value => createHash('sha256').update(value).digest('hex')
const activeMember = (board, uid) => Boolean(board?.members?.[uid] && !board?.removedMembers?.[uid])
const fail = (code, message) => { throw new HttpsError(code, message) }
function identity(auth) {
  if (!auth?.uid) fail('unauthenticated', 'Sign in with Google first.')
  if (auth.token?.email_verified !== true || auth.token?.firebase?.sign_in_provider !== 'google.com') fail('permission-denied', 'Use a verified Google account.')
  return { uid: auth.uid, email: String(auth.token.email || '').trim().toLowerCase() }
}
function displayName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 40 || [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) fail('invalid-argument', 'Choose a display name of 1–40 characters.')
  return value.trim()
}
function emailAddress(value) {
  if (typeof value !== 'string' || value.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) fail('invalid-argument', 'Enter a valid email address.')
  return value.trim().toLowerCase()
}

/** Membership edits touch only the named member/access fields, never media or settings. */
function createMembershipService(db, { now = () => Date.now(), token = () => randomBytes(32).toString('base64url') } = {}) {
  async function rateLimit(uid) {
    const ref = db.doc(`membershipRateLimits/${hash(uid)}`)
    await db.runTransaction(async tx => {
      const old = (await tx.get(ref)).data(), time = now()
      const count = old && time - old.since < 15 * 60 * 1000 ? old.count + 1 : 1
      if (count > 40) fail('resource-exhausted', 'Too many attempts. Please try again in 15 minutes.')
      tx.set(ref, { since: count === 1 ? time : old.since, count })
    })
  }
  return async function membership(request) {
    const user = identity(request.auth), data = request.data || {}
    if (typeof data.boardId !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(data.boardId)) fail('invalid-argument', 'Invalid group.')
    const ref = db.doc(`boards/${data.boardId}`)
    const owner = board => {
      if (!activeMember(board, user.uid) || board.ownerUid !== user.uid) fail('permission-denied', 'Only the group owner can manage membership.')
    }
    await rateLimit(user.uid)
    if (data.action === 'list') {
      owner((await ref.get()).data())
      const [invites, events] = await Promise.all([
        ref.collection('membershipInvites').where('status', '==', 'pending').get(),
        ref.collection('membershipEvents').orderBy('createdAt', 'desc').limit(50).get(),
      ])
      const latest = (await ref.get()).data(); owner(latest)
      return {
        members: Object.entries(latest.members || {}).map(([uid, profile]) => ({ uid, name: profile.name, email: profile.email, photoUrl: profile.customPhotoUrl || profile.googlePhotoUrl || profile.photoUrl || '', role: uid === latest.ownerUid ? 'owner' : 'member', removed: Boolean(latest.removedMembers?.[uid]) })),
        invites: invites.docs.map(doc => { const i = doc.data(); return { id: doc.id, email: i.email, expiresAt: i.expiresAt, status: i.status === 'pending' && i.expiresAt <= now() ? 'expired' : i.status } }),
        events: events.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      }
    }
    if (data.action === 'create') {
      const email = emailAddress(data.email), rawToken = token(), inviteRef = ref.collection('membershipInvites').doc(hash(rawToken))
      const time = now(), expiresAt = time + 7 * 24 * 60 * 60 * 1000
      await db.runTransaction(async tx => {
        const board = (await tx.get(ref)).data(); owner(board)
        if (Object.entries(board.members || {}).some(([uid, profile]) => activeMember(board, uid) && profile.email?.toLowerCase() === email)) fail('already-exists', 'That account is already a member.')
        // Read the pending set inside the transaction to keep owner double-clicks bounded.
        const pending = await tx.get(ref.collection('membershipInvites').where('status', '==', 'pending'))
        if (pending.docs.some(doc => doc.data().expiresAt > time && doc.data().email === email)) fail('already-exists', 'Revoke the existing invitation for this email before creating another.')
        if (pending.docs.filter(doc => doc.data().expiresAt > time).length >= 50) fail('resource-exhausted', 'Revoke an unused invitation before creating another.')
        tx.create(inviteRef, { email, status: 'pending', createdAt: time, expiresAt, createdBy: user.uid })
        tx.create(ref.collection('membershipEvents').doc(), { action: 'invited', actorUid: user.uid, target: email, createdAt: time })
      })
      return { token: rawToken, expiresAt }
    }
    if (data.action === 'redeem') {
      if (typeof data.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(data.token)) fail('permission-denied', 'This invitation is invalid or no longer available.')
      const name = displayName(data.name), inviteRef = ref.collection('membershipInvites').doc(hash(data.token))
      return db.runTransaction(async tx => {
        const [boardDoc, inviteDoc] = await Promise.all([tx.get(ref), tx.get(inviteRef)])
        const board = boardDoc.data(), invite = inviteDoc.data()
        if (!board || !invite || invite.email !== user.email) fail('permission-denied', 'This invitation is unavailable for this Google account. Ask the owner to check the invited email.')
        // Safe retry after a lost response. A removed member must get a fresh invite.
        if (invite.status === 'used' && invite.usedBy === user.uid && activeMember(board, user.uid)) return { name: board.members[user.uid].name }
        if (invite.status !== 'pending' || invite.expiresAt <= now()) fail('failed-precondition', 'This invitation has expired or was already used or revoked.')
        if (!activeMember(board, invite.createdBy) || board.ownerUid !== invite.createdBy) fail('permission-denied', 'This invitation is no longer available.')
        // Existing UID wins: never replace its name, avatar, preferences, or joinedAt.
        const profile = board.members?.[user.uid] || { name, email: user.email, photoUrl: '', googlePhotoUrl: '', joinedAt: new Date(now()).toISOString() }
        tx.update(ref, new FieldPath('members', user.uid), profile, new FieldPath('removedMembers', user.uid), FieldValue.delete(), 'updatedAt', FieldValue.serverTimestamp())
        tx.update(inviteRef, { status: 'used', usedBy: user.uid, usedAt: now() })
        tx.create(ref.collection('membershipEvents').doc(), { action: board.removedMembers?.[user.uid] ? 'rejoined' : 'joined', actorUid: user.uid, target: profile.name, createdAt: now() })
        return { name: profile.name }
      })
    }
    if (data.action === 'revoke' || data.action === 'remove') {
      if (data.action === 'revoke' && (typeof data.inviteId !== 'string' || !/^[a-f0-9]{64}$/.test(data.inviteId))) fail('invalid-argument', 'Invalid invitation.')
      if (data.action === 'remove' && (typeof data.uid !== 'string' || !data.uid || data.uid.length > 128 || data.uid.includes('/'))) fail('invalid-argument', 'Invalid member.')
      await db.runTransaction(async tx => {
        const board = (await tx.get(ref)).data(); owner(board)
        if (data.action === 'remove') {
          if (data.uid === board.ownerUid) fail('failed-precondition', 'The group owner cannot be removed.')
          if (!activeMember(board, data.uid)) fail('not-found', 'That member is not active.')
          const pending = await tx.get(ref.collection('membershipInvites').where('status', '==', 'pending'))
          for (const invitation of pending.docs) {
            if (invitation.data().email === board.members[data.uid].email?.trim().toLowerCase()) tx.update(invitation.ref, { status: 'revoked', revokedAt: now() })
          }
          tx.update(ref, new FieldPath('removedMembers', data.uid), true, 'updatedAt', FieldValue.serverTimestamp())
          tx.create(ref.collection('membershipEvents').doc(), { action: 'removed', actorUid: user.uid, target: board.members[data.uid].name, createdAt: now() })
        } else {
          const inviteRef = ref.collection('membershipInvites').doc(data.inviteId), invite = (await tx.get(inviteRef)).data()
          if (!invite || invite.status !== 'pending') fail('failed-precondition', 'That invitation is no longer pending.')
          tx.update(inviteRef, { status: 'revoked', revokedAt: now() })
          tx.create(ref.collection('membershipEvents').doc(), { action: 'revoked', actorUid: user.uid, target: invite.email, createdAt: now() })
        }
      })
      return { ok: true }
    }
    fail('invalid-argument', 'Unknown membership action.')
  }
}
module.exports = { createMembershipService, activeMember, identity, displayName, emailAddress, hash }
