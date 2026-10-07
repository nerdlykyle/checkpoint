# Checkpoint

Checkpoint is a shared game tracker for friend groups: one current campaign, an ordered “up next” queue, independent voting, progress notes, and a group library.

This repository contains an install-free, dark-first website. In local mode changes are saved to the browser. When Firebase is configured, Google sign-in protects a private shared board and Firestore synchronizes every change live.

## Run locally

```bash
npm install
npm run dev
```

Open the local address shown in the terminal.

## Included in V1

- Responsive desktop and mobile layouts
- Dark mode by default
- Searchable Steam catalog and exact Steam store-link matching with real titles and cover art
- Playing, Up next, Wishlist, and Completed statuses
- Drag-to-reorder Up next queue
- Per-player voting separate from official queue order
- Progress and shared-note editing
- Game creation and filtering
- Browser persistence for all changes
- Google sign-in for hosted boards
- Private-link group joining with signed-in membership
- Live Firestore syncing across devices
- Empty first-run board with no placeholder players or games
- Crew identities for Nern, Jern, and Vern
- Per-game live puzzle pages with independent notes and drawings
- Layered puzzle screenshots that can be moved, resized, cropped, and reordered without erasing drawings
- Optional Steam profile linking, ownership, playtime, and achievements
- Synced manual ownership overrides for private Steam profiles and manually added games
- CheapShark price cards for Steam-redeemable copies the crew still needs
- Morning, afternoon, and evening price-cache windows in Central Time
- Shared game-night calendar with per-player accept/decline responses and alternate-time suggestions
- One-click personal Google Calendar copies for accepted game nights
- Shared session timer with pause/resume, participant selection, and automatically accumulated playtime
- Tonight Mode with the active game, live timer, session note, puzzle board, and latest recap
- End-of-session progress, recap, and next-objective capture
- Shared activity history with guarded undo that will not overwrite newer changes
- Discord-formatted game-night copy with Discord-native localized timestamps
- Optional user-installed Discord app with `/reminder`, `/checkpoint tonight`, and `/checkpoint next`

## Commands

- `npm run dev` — start local development
- `npm run build` — type-check and build for production
- `npm run lint` — run code quality checks
- `npm run preview` — preview the production build

## Connect Firebase

1. Create a Firebase project on the no-cost Spark plan and add a Web app.
2. Enable **Authentication → Sign-in method → Google**.
3. Create a Firestore database.
4. Copy `.env.example` to `.env.local` and add the Firebase web configuration values.
5. Deploy `firestore.rules` with the Firebase CLI or paste them into the Firestore Rules editor.

The new session and activity fields require the current rules in this repository. Deploy rules and indexes together with `firebase deploy --only firestore`.

The private `#board=...` portion of the Checkpoint URL identifies the board. A visitor must also sign in with Google; opening a private link lets that signed-in user join only as themselves. `kjsparsons@gmail.com` is assigned to Nern automatically, while the other two accounts choose Jern or Vern. Firestore collection listing and board deletion are denied by the included rules.

## Google Calendar

Enable the **Google Calendar API** in the same Google Cloud project used by Firebase. Checkpoint scheduling and RSVPs work without personal-calendar access. A player can optionally click **Add to Google Calendar** on an accepted night; the first use asks that player for the `calendar.events` permission and creates a private event on the Google account used to sign into Checkpoint. Checkpoint keeps the temporary Google access token in memory only; the shared board stores only the returned event ID so it can update the same event without creating duplicates.

## Book search configuration

Enable **Books API** in the Google Cloud project and create a dedicated API key (do not change the existing Firebase key). Restrict it to **Books API** and the website `https://nerdlykyle.github.io/*`; template users should substitute their own deployment origin. Browser referrers can omit paths, so allow the origin rather than only `/checkpoint/`. Add local development origins only if needed.

Save the key as the GitHub Actions repository secret **VITE_GOOGLE_BOOKS_API_KEY**, or the same variable in `.env.local` for local development. Run the Pages workflow after changing a secret: Vite embeds this browser key at build time, so it is visible in the deployed JavaScript despite being stored as an Actions secret. Website/API restrictions are essential; never use a server credential here.

Book searches use Google Books with this key and fall back to Open Library. Missing-key, access, quota and timeout failures are shown in the add/change-book dialog, including when fallback results are available. Successful, nonempty searches are cached in memory for five minutes (at most 50 queries). Errors, partial results and empty results are not cached. Each provider has its own seven-second timeout, and changing the query cancels the old search. This setup does not alter saved books or Firestore.

Book artwork independently recovers from cover-host outages. Visible covers try stored images and smaller-size fallbacks, then Google Books and Open Library metadata. Google recovery uses the saved volume ID or exact ISBN when available; otherwise both title and author must match. This changes only displayed artwork, never the saved edition, shelf or reading history. **Refresh artwork** clears the in-memory cover cache for that book, retries provider images with a fresh URL, and updates all mounted copies (details, shelf and current-read cards). Custom signed image URLs are left intact. Image attempts are cancellable and time-bounded; a late failed request cannot skip a working fallback.

## Steam catalog

The prebuild step refreshes a compact, letter-bucketed title index from the daily-updated [Steam AppID List](https://github.com/jsnli/SteamAppIDList). The deployed browser searches the local index, so no Steam API credential is exposed and only a small catalog slice loads for each search. Steam cover images are loaded from Steam's public asset CDN.

## Steam profiles and prices

The optional Worker in `worker/` is a narrow, read-only proxy for the Steam Web API. Set `VITE_CHECKPOINT_API_URL` to its deployed address and keep `STEAM_WEB_API_KEY` only in the Worker secret store. Each signed-in crew member links their own public Steam profile from the Players screen.

CheapShark does not use the Worker. Its public API is called directly from the browser and cached by morning, afternoon, and evening Central Time windows. Deal links use CheapShark's required redirect URL, and Checkpoint requests Steam-redeemable offers matched by exact Steam AppID.

## Publish from GitHub

The included workflow builds and deploys Checkpoint to GitHub Pages whenever `main` is updated.

1. Add the Firebase values and optional `VITE_CHECKPOINT_API_URL` from `.env.example` as GitHub repository secrets.
2. In **Settings → Pages**, choose **GitHub Actions** as the source.
3. Push to `main`, then share the resulting Checkpoint URL with the group.

## Discord app and reminders

The website’s **Copy for Discord** button works immediately and needs no bot. The optional Discord app runs on Firebase Functions so `/reminder` can wake up later even though the GitHub Pages site is closed. Central time is the default; Eastern, Mountain, and Pacific are daylight-saving aware. See [functions/README.md](functions/README.md) for the one-time Discord Developer Portal, Firebase secret, command-registration, and deployment steps.
