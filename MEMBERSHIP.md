# Manual invitations (Firebase Spark)

## Using invitations

Open your avatar → **Members & invitations**. Only the existing board owner sees
invitation controls. Enter the recipient's Google account email, create a link,
and copy/send it privately. No email is sent automatically. The recipient opens
the link, signs in with that Google account, and chooses a display name.

Links are email-bound, single-use and expire after seven days. The owner can
revoke pending links. Accepted, expired and revoked invitations remain visible.
The secret link is shown only when created, never stored in browser storage. If
lost, revoke the pending invitation and create another. Ordinary shared board
links do not grant membership.

Existing members need no invitation and continue using their original Google
accounts. This release adds invitations, not member removal, reinstatement or
account transfer. Existing administrative removal flags are still enforced.

## Free-plan architecture and safeguards

The live client uses Firestore directly, **not Cloud Functions**. No billing
upgrade, paid mail service, migration or new Firebase project is required. Usage
remains subject to Spark's normal Firestore/Auth quotas.

- The browser generates a 256-bit random token and stores only its SHA-256 hash
  as the `boards/{boardId}/manualInvites/{hash}` document ID. Links carry the token
  in a URL fragment, not the HTTP path/query/referrer.
- Only the current owner can create/list/revoke invitations. An intended
  recipient can read their exact invite with matching verified Google email.
  Other members and unrelated accounts cannot list invitations.
- Rules enforce owner identity, recipient email, server-time expiry, immutable
  invite fields, and pending → used/revoked transitions. Used/revoked records
  cannot be reopened, replaced or deleted by clients.
- Acceptance is a Firestore transaction. It consumes the invitation and updates
  only `members.{uid}`, `membershipClaims.{uid}`, and `updatedAt` on the board.
  Both documents' Security Rules use `getAfter()` to require matching atomic
  changes. Neither half may be committed alone. The recipient cannot read the
  board beforehand or alter media, other profiles, owner or removal flags.
- Concurrent acceptance and lost-response retries recognize the same completed
  claim without overwriting the new profile. Later removal still denies access.
- Clients cannot create boards, self-join without an invite, promote themselves,
  add a different UID, overwrite an existing profile or remove another member.

The old `functions/membership.js` service and callable in `functions/index.js`
remain as historical tested source, but are **not used or deployed** for this
flow. Their separate `membershipInvites`/`membershipEvents` collections remain
inaccessible to clients. Do not deploy that alternate backend for this release.
Its rate limits and removal controls are not features of manual invitations.

## Preservation and authentication

There is **no data migration**. Existing Firebase UID keys, `ownerUid`, profiles,
avatars, bookmark colors, preferences, shelves, votes, progress, notes, sessions,
games, books, music and favorites are preserved. Owner identity uses UID, never
a display name or client-chosen email.

Keep the same Firebase project, web configuration, Google provider and site
origin. Auth uses the same persisted session. Do not clear browser storage,
sign out users, revoke refresh tokens or recreate accounts during deployment.
Normal session expiry/browser-cleared storage is independent of this update.
Server-only membership verification is not a sign-out; offline admission asks
the user to retry and never writes cached data over the board.

## Deployment checklist

1. Verify the intended board and member/owner UIDs with a read-only administrator
   check. Stop for unexpected members or owner changes.
2. Export and verify a private backup of the board, all subcollections (including
   music, artist favorites, current listen and puzzles), each member's private
   notes and music preferences. Keep exports outside Git.
3. Run verification:

   ```sh
   npm ci
   npm --prefix functions ci
   npx tsc -b
   npx oxlint
   npx vite build
   firebase --config firebase.test.json --project demo-checkpoint emulators:exec --only firestore 'node --test scripts/*.test.mjs'
   ```

4. Deploy **rules only**, then publish the tested frontend:

   ```sh
   firebase deploy --only firestore:rules --project espress-2f411
   ```

5. Compare released rules with tested source and verify backed-up documents are
   unchanged. Do not create test users/invites in production. Verify the published
   bundle and deployment status.

Tests run the actual TypeScript client against emulator-enforced rules, covering
valid joins, concurrent/retried acceptance, wrong email, unverified/non-Google
identity, expiry, revocation, unauthorized creation/listing, existing-profile
overwrite attempts, escalation, media tampering and half-transaction bypasses.
Existing regression tests still cover books, games, music and profiles. Isolated
browser checks verify invitation creation/revocation/join screens, owner-only
controls and no overflow at desktop and phone widths with no console errors.

## Boundaries and history

Invited members have the same trusted-group shared editing powers as existing
members. Private notes/preferences remain UID-private. Joining does not transfer
someone else's personal shelves. This is not multi-tenant group creation. Spark
quotas still apply; no automatic emails or callable-style rate limiter is promised.

On 2026-10-09 the Functions-based attempt was blocked by Spark with no data/billing
changes. Closed membership was then published with all 31 backed-up documents
unchanged. The user subsequently authorized this free manual invitation flow.
No Discord deployment changes are included.
