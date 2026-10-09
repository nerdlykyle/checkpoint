# Private membership — invitations on hold

## Current release: existing members only

`invitationsEnabled` is deliberately `false`. The frontend shows a closed-group
screen to nonmembers, hides invitation controls, and blocks invitation requests.
Firestore rules deny self-joining and preserve access for the existing UID-keyed
members. Google sign-in by itself does not grant board access.

Deploy this closed mode with **only** `firestore:rules`, followed by the frontend.
Do not deploy Functions, enable invitations, or change billing for this release.
The invitation and Discord backend code below is staged for future use, not live.

A future Spark-compatible invitation flow can instead use Firestore transactions
and Security Rules (`getAfter`) to atomically validate an owner-created,
email-bound, expiring invite and consume it when adding membership. This requires
a separately tested rules/client implementation; flipping the current flag alone
will not enable it. Manually shared links do not require an email delivery service.
Google sign-in and Firestore are available within Spark's no-cost limits.

**2026-10-09 closed-mode verification:** Rules were released at
`2026-10-09T16:09:47Z` and the live source matched the tested local rules. All 31
documents in the fresh private backup were unchanged after deployment. The same
three member UIDs remain; no Auth accounts, tokens, billing settings or Functions
were changed. The emulator suite passed all 148 tests, with TypeScript, lint,
production build and the three Functions unit tests also passing.

## Existing members and data

There is **no data migration**. Access uses the existing Firebase UID keys in
`boards/{boardId}.members`. Existing members keep their name, avatar, Steam
preferences, bookmark color, shelves, votes, ratings, progress and session history.
The existing `ownerUid` determines who can manage invitations; a display name or
email never grants ownership.

Keep the same Firebase project, web app configuration, Google provider and site
origin during deployment. The update keeps Firebase Auth's existing persisted
session; it must not clear browser storage, call sign-out, revoke refresh tokens,
or recreate Auth users. A server membership check is not a sign-out. Existing
members need no invite. Normal Google/Firebase session expiry and browser-cleared
storage can still require signing in independently of the deployment.

Removing someone sets `removedMembers.{uid}: true`, without deleting their member
profile or any content. All shared-board rules check this flag. A fresh invitation
redeemed by the **same Google account/UID** restores access and retains the original
profile. It does not transfer data to a different account. Personal private notes
and music-service preferences remain accessible only to their original UID.

The frontend no longer creates a board or self-joins after a failed read, and no
longer restores local cached media over an empty server response. Admission is
checked against the server; an offline startup asks the user to retry.

## Planned invitation experience (disabled)

Open your avatar → personal settings → **Members & invitations** (owner only).
Enter the recipient's Google email, create an invitation and privately send the
generated link. Creating an invitation does **not** send email automatically.
The recipient signs in with that Google account, chooses a display name and joins.

Links expire after seven days. They are single-use, email-bound and revocable.
A same-account retry after a lost success response is idempotent. A removed member
cannot reuse an old consumed link. Removal also revokes pending links for their
email. To replace a lost invite link, revoke its pending invitation first.

Tokens use 256 bits of randomness; only a SHA-256 hash is stored. Tokens are carried
in URL fragments, not HTTP paths, query strings or referrers. The UI shows a new
link only once. Only the callable backend can read or modify invites and the
membership activity log. Operations are limited to 40 requests per authenticated
account per 15 minutes; there can be at most 50 unexpired pending invitations.

## Rollout history and future invitation deployment

**2026-10-09 rollout status:** Owner and all three current members were verified.
A private, checked local export includes 31 documents (24 music records, artist
favorites, current group listen, preferences, board and puzzles). All 31 remained
unchanged after the deployment attempt. Firebase blocked Functions deployment
because the project requires the Blaze plan; no new rules or membership frontend
were published. Billing was not changed. Only the independent paperback visual
changes were pushed in commit `c782f29`. The user subsequently approved closing
membership to the three existing accounts while keeping invitations on hold.
For that release, take a fresh backup, run the emulator tests, deploy rules only,
verify unchanged data, and publish the closed-mode frontend. No billing upgrade
is required. The steps below apply only to a future authorized Functions-based
invitation rollout, not the current closed-mode release.

1. Confirm the target Firebase project and board. Read the live board with
   administrator credentials and verify the existing owner UID belongs to the
   intended owner and appears in `members`. Review all existing member UIDs for
   unexpected accounts; do **not** auto-claim ownership from a name or email.
   If the owner is missing or incorrect, stop for explicit owner confirmation.
2. Take and verify a recoverable Firestore backup/export, including board
   subcollections (music, favorites, puzzles), private notes and preferences.
   Keep exports private and out of Git. Do not reseed or recreate the board.
3. Run the local emulator test suite below. It cannot write to production.
4. Deploy the membership callable, protected Discord handler, and rules together:

   ```sh
   firebase deploy --only functions:manageMembership,functions:discordInteractions,firestore:rules --project espress-2f411
   ```

   This needs an authorized Firebase login and a project supporting Cloud Functions.
   All other deployed functions are intentionally left unchanged.
5. Publish the tested frontend. Existing members sign in with their original
   Google accounts; they should not redeem invitations or choose a legacy persona.
6. Verify the owner and other current members still see their saved shelves,
   settings, notes and history. Verify a nonmember cannot read the board or any
   shared subcollection. Test one deliberately invited test account, then revoke
   its access. Never remove a real existing member just to test the feature.

If verification fails, stop new invitations and inspect the failing component.
Do not overwrite live content with a local cache, change member UIDs, or restore
the old self-joining rules as a workaround. Existing clients retain member access
under the new rules but cannot self-join.

## Planned Discord access (backend not deployed)

The Admin SDK bypasses Firestore rules, so `/checkpoint` also checks membership.
A trusted operator must create `discordMembership/{discordUserId}` with
`{ boardId, uid }` after verifying both identities. Clients cannot read or write
these mappings. Unlinked users receive a private instruction to open Checkpoint;
linked but removed members are denied. Group command responses are ephemeral,
not posted to a channel whose audience may include nonmembers.
Personal Discord reminders remain unchanged. Do not infer mappings from names.

## Verification

```sh
npm ci
npm --prefix functions ci
npx tsc -b
npx oxlint
npx vite build
npm --prefix functions test
firebase --config firebase.test.json --project demo-checkpoint emulators:exec --only firestore 'node --test scripts/*.test.mjs'
```

The emulator tests cover Google identity requirements, wrong-email redemption,
expiry, revocation, concurrent retries, owner-only controls, rate limits,
outsider/self-join/promotion rejection, removal across shared subcollections, and
byte-for-byte preservation of representative existing data during join/removal/rejoin.

App Check can add abuse protection after it is configured and verified on all
clients; it is not enabled blindly in this update. Authentication, authorization
and backend rate limits do not depend on App Check.

## Boundaries

Current active members retain the application's existing shared editing powers.
This update does not implement field-by-field author isolation for shared
games/books/music documents, or a multi-tenant group creation flow. Downloaded
content and existing browser caches cannot be remotely erased by revoking access.
Private-note rules remain UID-private. Treat membership as a trusted-group model.
