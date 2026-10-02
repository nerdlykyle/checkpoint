# Checkpoint game-data worker

This Worker keeps the Steam Web API key out of the public site. CheapShark pricing is fetched directly by the browser because its API is public and keyless.

It also serves public MusicBrainz metadata and Spotify/YouTube link resolution at `/music/catalog`, using the same board allowlist. No streaming-service secret or Firebase billing upgrade is needed. See [Music mode](../docs/music.md) for limits, storage, and release steps.

Required deployment configuration:

- `STEAM_WEB_API_KEY`: a Wrangler secret created from a Steam Web API key
- `CHECKPOINT_BOARD_ID`: the private Checkpoint board UUID
- `ALLOWED_ORIGINS`: the GitHub Pages origin plus local development origins

Checkpoint’s browser cache divides each Central Time day into morning, afternoon, and evening windows, so prices refresh at most once in each window whenever someone has the site open.
