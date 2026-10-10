# Movies — VHS edition

Movies has its own mode, personal library, shared Up Next queue, and watched history.
The current group watch uses an animated VHS cassette. Other movies use worn sleeves;
hover or tap reveals the cassette, and the three-dot button opens movie details.
Motion can be paused and respects reduced-motion preferences.

## Personal viewing and crew ratings

My movies has My library, Watched, Watchlist, Group watchlist, and Crew collection
tabs. Watched and Watchlist are personal; Group watchlist is the shared queue.
Club watched remains the separate group-watch history.

Movie details uses a two-column layout (stacked on mobile) with synopsis, group
controls, personal viewing status, 1–5 star ratings, and crew ratings/seen status.
“Seen it” and “Not yet” save the movie to the member's library and update only
that member's status. Finishing a group watch never marks members as having seen it.
Ratings save immediately; clearing a rating stores zero (excluded from averages).

Optional `seenBy` and `ratings` maps work with existing movie records without a
migration. Missing seen status means “Not marked yet,” not an explicit “Not seen.”
Only a member's own entries can change; transactions preserve concurrent updates.
Deploy the updated Firestore rules before publishing these controls.

## Catalog search

Add Movie searches TMDB by title with an optional release-year filter. Selecting a
result loads its detail record, then lets the user confirm its title, poster and
synopsis. TMDB IDs provide stable identity across translated/edited titles and keep
different catalog movies separate. Existing manual movies remain unchanged; they
are not automatically merged into catalog records based on similar names.

Manual entry remains available on failures or when no result fits. Missing or
failed art displays the title instead. No demonstration movies enter real boards.

### Secure setup (required before live search)

1. Create an API Read Access Token in https://www.themoviedb.org/settings/api.
2. In Cloudflare, select the `checkpoint-game-data` Worker. Under Settings →
   Variables and Secrets, add **a Secret** named `TMDB_READ_ACCESS_TOKEN` with
   that token. Do not put it in a `VITE_` variable, GitHub source, or chat.
   Alternatively, from `worker/`, use `npx wrangler secret put TMDB_READ_ACCESS_TOKEN`
   and enter the token only at the hidden prompt.
3. Deploy the Worker source including the new `/movies/catalog` route, and the
   accompanying Firestore rules, before publishing the website.
4. Test a signed-in search and verify the TMDB logo/credits render in the release.

`FIREBASE_PROJECT_ID` is a non-secret Worker variable. Every catalog request uses
the caller's Firebase ID token to read an owner-field-only board projection through
Firestore rules; guests and removed members cannot use the TMDB secret. The server
only permits fixed TMDB search/detail endpoints and caches successful public
metadata for 15 minutes, at most 100 requests per isolate. No tokens or private
board data enter the cache. Results exclude adult titles and are capped at 20.

TMDB requires its logo and notice (included in the movie catalog credits).
Its free API is for non-commercial use; confirm a commercial license before
monetizing or selling a hosted edition. Review their current terms, including
metadata retention requirements, before wider distribution:
https://developer.themoviedb.org/docs/faq and https://www.themoviedb.org/api-terms-of-use.

## Storage and deployment

- Shared records: `boards/{boardId}/movies/{movieId}`.
- Current-watch lock: `boards/{boardId}/movieState/current`.
- Movies are isolated from the existing board document, books, games, music, and auth.
- Library removals only change the signed-in member's membership in that movie.
- Shared metadata is editable by board members. Starts/finishes update the movie and
  current-watch lock in one transaction. Another active watch cannot be overwritten.
- Demo mode uses a separate `checkpoint-movies-demo:{boardId}` local-storage key;
  configured Firebase environments never silently fall back to local-only writes.

Deploy the accompanying Firestore rules **before** publishing the client. The new
rules also permit `movies` as a member's preferred mode. Existing collections/rules
are preserved. Any external backup/export job that explicitly enumerates collections
must include both `movies` and `movieState`; this repo does not contain such a job.
Do not claim these new records are backed up until that external setup is verified.

Verification: `node --test scripts/movies.test.mjs`; movie permission/transaction
tests in `scripts/movie-rules.test.mjs` run with the Firestore emulator. A no-cloud
interactive fixture is available at `/tests/movies.html` through the dev server.
