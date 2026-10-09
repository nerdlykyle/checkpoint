import { httpsCallable } from 'firebase/functions'
import { doc, getDocFromServer } from 'firebase/firestore'
import { database, membershipFunctions } from './firebase'

// Joining stays closed while the invitation backend is on hold.
export const invitationsEnabled = false

export type MembershipRoster = {
  members: { uid: string; name: string; email: string; photoUrl: string; role: 'owner' | 'member'; removed: boolean }[]
  invites: { id: string; email: string; expiresAt: number; status: string }[]
  events: { id: string; action: string; target: string; actorUid: string; createdAt: number }[]
}
export async function membershipAction<T>(data: Record<string, unknown>): Promise<T> {
  if (!invitationsEnabled) throw new Error('New memberships are currently closed.')
  if (!membershipFunctions) throw new Error('Membership management needs a connected Firebase project.')
  const result = await httpsCallable<Record<string, unknown>, T>(membershipFunctions, 'manageMembership')(data)
  return result.data
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
