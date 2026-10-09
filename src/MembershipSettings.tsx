import { useEffect, useState, type FormEvent } from 'react'
import { Copy, RefreshCw, UserPlus, X } from 'lucide-react'
import type { User } from 'firebase/auth'
import { signOut } from './lib/firebase'
import { CheckpointLogo } from './CheckpointLogo'
import { clearInvitation, invitationsEnabled, invitationToken, invitationUrl, membershipAction, type MembershipRoster } from './lib/membership'
import './MembershipSettings.css'

const message = (error: unknown) => error instanceof Error ? error.message.replace(/^Firebase:\s*/, '') : 'Something went wrong. Please try again.'

export function MembershipGate({ user, boardId, error, onRetry }: { user: User; boardId: string; error: string; onRetry: () => void }) {
  const token = invitationsEnabled ? invitationToken() : null
  const [name, setName] = useState(user.displayName?.slice(0,40) || '')
  const [busy, setBusy] = useState(false), [problem, setProblem] = useState('')
  async function join(event: FormEvent) {
    event.preventDefault(); setBusy(true); setProblem('')
    try {
      await membershipAction({ action: 'redeem', boardId, token, name })
      clearInvitation(boardId); onRetry()
    } catch (next) { setProblem(message(next)) }
    finally { setBusy(false) }
  }
  return <main className="sign-in-screen"><section className="sign-in-card membership-gate">
    <div className="sign-in-brand"><CheckpointLogo className="brand-mark" /><strong>checkpoint</strong></div>
    <h1>{token ? 'Join the crew' : 'This group is private'}</h1>
    <p>Signed in as {user.email}. {token ? 'Use the Google account the invitation was sent to.' : invitationsEnabled ? 'Ask the group owner for an invitation. Existing members can retry or switch to their original Google account.' : 'New memberships are currently closed. Existing members can retry or switch to their original Google account.'}</p>
    {token && <form onSubmit={join}><label>Your display name<input value={name} maxLength={40} required autoComplete="nickname" onChange={event => setName(event.target.value)} /></label><button className="button button-primary" disabled={busy || !name.trim()}><UserPlus size={17} />{busy ? 'Joining…' : 'Join group'}</button></form>}
    {(problem || error) && <p role="alert" className="membership-error">{problem || error}</p>}
    <div className="membership-actions"><button className="button button-secondary" type="button" disabled={busy} onClick={onRetry}><RefreshCw size={16} />Retry access</button><button className="button button-secondary" type="button" disabled={busy} onClick={() => void signOut()}>Use another account</button></div>
    <small>Your existing settings and collections stay linked to your original Google account.</small>
  </section></main>
}

export default function MembershipSettings({ boardId, isOwner }: { boardId: string; isOwner: boolean }) {
  if (!invitationsEnabled) return <section className="membership-settings"><h3>Membership closed</h3><p>Only existing members can access this group. New sign-ups and invitations are on hold. Your current account, settings, and collections are unchanged.</p></section>
  return <InvitationSettings boardId={boardId} isOwner={isOwner} />
}

function InvitationSettings({ boardId, isOwner }: { boardId: string; isOwner: boolean }) {
  const [roster, setRoster] = useState<MembershipRoster | null>(null)
  const [email, setEmail] = useState(''), [link, setLink] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  useEffect(() => {
    if (!isOwner) return
    let active = true
    membershipAction<MembershipRoster>({ action: 'list', boardId }).then(next => { if (active) setRoster(next) }).catch(next => { if (active) setError(message(next)) })
    return () => { active = false }
  }, [boardId,isOwner])
  if (!isOwner) return <p className="membership-note">This group is invite-only. Ask the owner to invite new members.</p>
  async function reload() { setRoster(await membershipAction<MembershipRoster>({ action: 'list', boardId })) }
  async function act(action: string, values: Record<string,string>) {
    setBusy(true); setError(''); setNotice(''); setLink('')
    try {
      const result = await membershipAction<{ token?: string }>({ action, boardId, ...values })
      if (result.token) { setLink(invitationUrl(boardId,result.token)); setEmail('') }
      else setNotice('Invitation revoked.')
      await reload()
    } catch (next) { setError(message(next)) }
    finally { setBusy(false) }
  }
  return <section className="membership-settings"><h3>Members & invitations</h3><p>Create a private link for a friend's Google email, then send it yourself. Links work once, expire after 7 days, and only admit the matching account.</p>
    <form className="membership-invite-form" onSubmit={event => { event.preventDefault(); void act('create',{email}) }}><label>Invite by email<input type="email" value={email} maxLength={320} required placeholder="friend@example.com" autoComplete="off" onChange={event => setEmail(event.target.value)} /></label><button className="button button-secondary" disabled={busy || !email.trim()}><UserPlus size={17} />Create invite</button></form>
    {link && <div className="membership-copy"><label>Copy this link and send it privately<input readOnly value={link} onClick={event=>event.currentTarget.select()} /></label><button className="button button-secondary" type="button" onClick={() => { void navigator.clipboard.writeText(link).then(()=>setNotice('Invite link copied.')).catch(()=>setError('Select the link and copy it manually.')) }}><Copy size={16} />Copy</button><small>This link is shown only now. Creating an invite does not send an email.</small></div>}
    {error && <p className="membership-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <div className="membership-tabs"><h4>Invitations</h4><button type="button" className="icon-button" aria-label="Refresh invitations" disabled={busy} onClick={()=>{setBusy(true);setError('');void reload().catch(next=>setError(message(next))).finally(()=>setBusy(false))}}><RefreshCw size={17}/></button></div>
    {!roster ? <p>Invitations are loading…</p> : <ul className="membership-list">{roster.invites.map(invite=><li key={invite.id}><div><strong>{invite.email}</strong><small>{invite.status==='pending' ? `Expires ${new Date(invite.expiresAt).toLocaleString()}` : invite.status==='used' ? 'Accepted' : invite.status==='revoked' ? 'Revoked' : 'Expired'}</small></div>{invite.status==='pending' && <button className="icon-button" type="button" disabled={busy} aria-label={`Revoke invitation for ${invite.email}`} title="Revoke invitation" onClick={()=>void act('revoke',{inviteId:invite.id})}><X size={18}/></button>}</li>)}{!roster.invites.length&&<li>No invitations yet.</li>}</ul>}
  </section>
}
