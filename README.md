# Checkpoint

Checkpoint is a shared game tracker for friend groups: one current campaign, an ordered “up next” queue, independent voting, progress notes, and a group library.

This repository contains an install-free website. In demo mode changes are saved to the browser. When Firebase is configured, Google sign-in protects a private shared board and Firestore synchronizes every change live.

## Run locally

```bash
npm install
npm run dev
```

Open the local address shown in the terminal.

## Included in V1

- Responsive desktop and mobile layouts
- Playing, Up next, Maybe, Wishlist, and Completed statuses
- Drag-to-reorder Up next queue
- Per-player voting separate from official queue order
- Progress and shared-note editing
- Game creation and filtering
- Browser persistence for all changes
- Google sign-in for hosted boards
- Private-link group joining with signed-in membership
- Live Firestore syncing across devices
- Seeded demo group and game library

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

The private `#board=...` portion of the Checkpoint URL identifies the board. A visitor must also sign in with Google; opening a private link lets that signed-in user join only as themselves. Firestore collection listing and board deletion are denied by the included rules.

## Publish from GitHub

The included workflow builds and deploys Checkpoint to GitHub Pages whenever `main` is updated.

1. Add the six values from `.env.example` as GitHub repository secrets.
2. In **Settings → Pages**, choose **GitHub Actions** as the source.
3. Push to `main`, then share the resulting Checkpoint URL with the group.
