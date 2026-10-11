# Checkpoint game-data worker

This Worker keeps the Steam Web API key out of the public site. CheapShark pricing is fetched directly by the browser because its API is public and keyless.

It also serves public MusicBrainz metadata and Spotify/YouTube link resolution at `/music/catalog`, using the same board allowlist. No streaming-service secret or Firebase billing upgrade is needed. See [Music mode](../docs/music.md) for limits, storage, and release steps.

Movie search uses `/movies/catalog`, with a server-only `TMDB_READ_ACCESS_TOKEN`
secret and `FIREBASE_PROJECT_ID`. Unlike the public music metadata endpoint, it
requires a Firebase ID token and a successful board-member check. See
[Movies](../docs/movies.md) for setup, attribution, and release order.

Required deployment configuration:

- `STEAM_WEB_API_KEY`: a Wrangler secret created from a Steam Web API key
- `CHECKPOINT_BOARD_ID`: the private Checkpoint board UUID
- `ALLOWED_ORIGINS`: the GitHub Pages origin plus local development origins

Checkpoint’s browser cache divides each Central Time day into morning, afternoon, and evening windows, so prices refresh at most once in each window whenever someone has the site open.
# Album artwork cache

`GET /music/artwork/{release|release-group}/{MusicBrainz UUID}/{250|500|1200}` serves public Cover Art Archive images. It caches successful images at the edge and in the browser for seven days. It accepts no arbitrary URLs, query strings, credentials, or private library data. Redirects are limited to Cover Art Archive and Internet Archive HTTPS hosts, with an eight-second deadline and five-MiB size limit. Errors are not cached. The site falls back to the original image provider if this service fails.

Deploy this worker before publishing a frontend that uses the endpoint. No new secret or database migration is needed.
