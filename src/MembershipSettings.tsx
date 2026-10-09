import { useEffect, useState, type FormEvent } from 'react'
import { Copy, RefreshCw, UserMinus, UserPlus, X } from 'lucide-react'
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
  const [tab, setTab] = useState<'members' | 'invites' | 'history'>('members')
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
      if (result.token) { setLink(invitationUrl(boardId,result.token)); setEmail(''); setTab('invites') }
      else setNotice(action === 'remove' ? 'Access removed. Their settings and collections are preserved.' : 'Invitation revoked.')
      await reload()
    } catch (next) { setError(message(next)) }
    finally { setBusy(false) }
  }
  return <section className="membership-settings"><h3>Members & invitations</h3><p>Only you, the group owner, can invite or remove members. Invitations last 7 days and require the matching Google account.</p>
    <form className="membership-invite-form" onSubmit={event => { event.preventDefault(); void act('create',{email}) }}><label>Invite by email<input type="email" value={email} maxLength={320} required placeholder="friend@example.com" autoComplete="off" onChange={event => setEmail(event.target.value)} /></label><button className="button button-secondary" disabled={busy || !email.trim()}><UserPlus size={17} />Create invite</button></form>
    {link && <div className="membership-copy"><label>Copy this link and send it privately<input readOnly value={link} onClick={event=>event.currentTarget.select()} /></label><button className="button button-secondary" type="button" onClick={() => { void navigator.clipboard.writeText(link).then(()=>setNotice('Invite link copied.')).catch(()=>setError('Select the link and copy it manually.')) }}><Copy size={16} />Copy</button><small>This link is shown only now. Creating an invite does not send an email.</small></div>}
    {error && <p className="membership-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <div className="membership-tabs" role="group" aria-label="Membership views">{(['members','invites','history'] as const).map(value=><button type="button" className={`button button-secondary ${tab===value?'active':''}`} aria-pressed={tab===value} onClick={()=>setTab(value)} key={value}>{value==='members'?'Active members':value==='invites'?'Pending invites':'Activity'}</button>)}<button type="button" className="icon-button" aria-label="Refresh membership" disabled={busy} onClick={()=>{setBusy(true);setError('');void reload().catch(next=>setError(message(next))).finally(()=>setBusy(false))}}><RefreshCw size={17}/></button></div>
    {!roster ? <p>Membership list is not loaded yet.</p> : tab==='members' ? <ul className="membership-list">{roster.members.filter(member=>!member.removed).map(member=><li key={member.uid}><div><strong>{member.name}</strong><small>{member.role==='owner'?'Owner':member.email}</small></div>{member.role!=='owner' && <button className="icon-button" type="button" disabled={busy} aria-label={`Remove ${member.name} from group`} title="Remove access" onClick={()=>{if(window.confirm(`Remove ${member.name}'s access? Their settings, books, music, and history will be kept. A new invitation to the same Google account can restore access.`))void act('remove',{uid:member.uid})}}><UserMinus size={18}/></button>}</li>)}</ul>
      : tab==='invites' ? <ul className="membership-list">{roster.invites.filter(invite=>invite.status==='pending').map(invite=><li key={invite.id}><div><strong>{invite.email}</strong><small>Expires {new Date(invite.expiresAt).toLocaleString()}</small></div><button className="icon-button" type="button" disabled={busy} aria-label={`Revoke invitation for ${invite.email}`} onClick={()=>void act('revoke',{inviteId:invite.id})}><X size={18}/></button></li>)}{!roster.invites.some(invite=>invite.status==='pending')&&<li>No pending invitations.</li>}</ul>
      : <ul className="membership-list">{roster.events.map(event=><li key={event.id}><div><strong>{event.target} — {event.action}</strong><small>{new Date(event.createdAt).toLocaleString()} · {roster.members.find(member=>member.uid===event.actorUid)?.name || 'Member'}</small></div></li>)}{!roster.events.length&&<li>No membership changes recorded yet.</li>}</ul>}
  </section>
}
