# Checkpoint Music

Music is a third mode alongside Games and Books. The preferred mode follows the existing account preference; both desktop and mobile navigation expose the same sections.

## First release

- Personal albums/EPs: To listen, Listening, Listened, Not for me, and independent Favorites.
- Personal ordering: drag, arrows, or numbered Move; genre/tag filtering, artist grouping, and random next-listen choice.
- Listeners’ collections: browse another member’s shelves without changing their order; save a title to your own shelf.
- Club listens: separate group queue, one current group listen, explicit join/leave, and completed listens. These never change personal shelves.
- Album poll: one vote per member; three thumbs down closes a nomination, retaining personal shelves and ratings.
- Songs to share: a separate shared feed for individual songs.
- Album/song details: cover, editable metadata, available tracklist, favorite tracks, shared ratings/reviews and discussion, useful links, and owner-only private notes.
- Manual dated listen logs, including repeat listens. There is no playback tracking, streaming history import, or Spotify/YouTube account connection.

Both Spotify and YouTube Music links are always shown. Verified catalog URLs or links supplied by the user open directly; otherwise the button explicitly says Search. Device settings decide whether HTTPS links open the installed streaming app. The user’s preferred service is displayed first.

## Catalog

The existing Cloudflare Worker serves `GET /music/catalog?board=…&action=search|detail|resolve`.
It uses the existing board allowlist and CORS policy, and returns only public catalog metadata. The board identifier is not strong authentication; private account/library data is never handled by this route.

MusicBrainz supplies artist/release identifiers, genre metadata and tracklists, with Cover Art Archive image URLs. Calls are queued at least 1.1 seconds apart per worker isolate and cached for 15 minutes in memory and at Cloudflare's upstream cache. MusicBrainz can still return busy responses across isolates; the UI offers manual entry. Provider requests identify Checkpoint with a User-Agent. A global cross-region rate limiter is not implemented.

Spotify and YouTube oEmbed may prefill a supplied link; users must confirm the title and artist. Unsupported URLs are never fetched. Manual entry and editable cover/service URLs remain available when metadata is missing.

Frontend uses `VITE_CHECKPOINT_API_URL` (same as Steam), optionally overridden by `VITE_MUSIC_CATALOG_URL`. No new provider secret is needed. Firebase Cloud Functions are not used: that deployment would require a Blaze upgrade.

## Storage and safeguards

- `boards/{boardId}/music/{musicId}`: live shared music records. Functional Firestore transactions preserve other members' concurrent edits.
- `boards/{boardId}/musicState/current`: transactional singleton for the current group listen.
- `musicPreferences/{uid}`: owner-only preferred listening service.
- `readerNotes/{uid}/music/{musicId}`: owner-only notes; never embedded in shared music records.

Music is separate from the legacy board document, so older game/book clients cannot overwrite it. Removing a personal shelf entry preserves shared discussions and others' collections. Favorites are independent and can be unhearted separately. Without Firebase configuration, the explicitly labeled local demo uses isolated device storage.

## Verification and release

```sh
npm run lint
npx tsc -b
node --test scripts/*.test.mjs
firebase emulators:exec --config firebase.test.json --only firestore --project demo-checkpoint "node --test scripts/private-book-notes.test.mjs scripts/music-rules.test.mjs"
npm --prefix worker run check
npx vite build
```

Development-only `/tests/music.html` supplies an in-memory crew and records for UI checks. It is not a production build entry and does not write to a real board.

Release the backend and rules before publishing the frontend:

```sh
npm --prefix worker run deploy
firebase deploy --only firestore:rules --project espress-2f411
git push origin main
```

If Wrangler reports expired authentication, run `cd worker && npx wrangler login` and complete the browser login. Do not upgrade Firebase billing merely for music lookup.
