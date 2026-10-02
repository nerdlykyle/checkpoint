# Personal book organization

My books supports Library, To read, Reading, Read, Paused, and Didn’t finish. Personal status never changes a club read. Readers’ shelves uses the same views with a reader selector; another reader’s shelf is read-only in the UI. Save to my books adds your own shelf entry without altering theirs. Shared ratings, comments, and nominations are unchanged.

## Ordering and filtering

Each book has optional `readerOrganization[uid]` with an order and personal tags. Each shelf has an independent ordering; moving a book to a different shelf appends it after the existing books. Old entries without ranks retain a deterministic creation-date/id order until rearranged. Choose a shelf, Reading order, and turn off Group by series for drag handles, arrows, or Move to position. Pointer-based dragging works with mouse/touch; arrows and numeric position are keyboard-accessible alternatives. Filtered views retain full-shelf positions. Read next moves a To read book to #1. Random selection only uses the filtered To read books and never alters shelves.

## Series and genres

Optional shared `series` and `genres` describe the book, not a reader’s queue. Group by series uses normalized series name plus a shared author, sorts known book positions numerically, and shows the shelf’s completion count. It only groups books already on that reader’s shelf. Find other books in this series searches the catalogs; selecting a result is required before adding anything. After finishing a series book, the app offers the next known installment or a catalog search. No missing titles or total counts are fabricated.

Google Books categories and Open Library subjects supply normalized genres. Series are best-effort: explicitly numbered title/subtitle text and Open Library edition series data. Unknown data stays unknown. ISBN/work/title-and-author matching is required before applying catalog metadata to an existing book. Existing personal books are enriched sequentially in the background; Refresh series & genres retries catalog lookups. Catalog failure never blocks adding/reading and never clears shelf data. Organize permits manual corrections and sets `metadataEdited`, protecting both series and genres from later automatic refreshes. Catalog coverage is incomplete; some series require manual naming/numbering.

## Private notes

“Why I saved this” notes are **not** stored in the shared board or local shelf cache. They use `readerNotes/{Firebase UID}/books/{bookId}` with owner-only Firestore read/write rules. Save is explicit and clearing then saving removes the text. Errors retain the unsaved input. Notes remain attached to the original book after Remove or Change book. Deploy the Firestore rules before publishing the UI:

```sh
firebase deploy --only firestore:rules --project espress-2f411
```

## Verification

```sh
node --test scripts/*.test.mjs
firebase emulators:exec --config firebase.test.json --only firestore --project demo-checkpoint "node --test scripts/private-book-notes.test.mjs"
npx tsc -b
npm run lint
npx vite build
```

The isolated development fixture at `/tests/books.html` supplies in-memory sample shelves for UI testing without changing the shared board. It is not a production build entry. Check series grouping, tags/genres, full-shelf ranks while filtered, pointer drag, numeric Move, other-reader views, save to own shelf, continue-series prompts, and narrow-screen overflow. Private-note rules tests explicitly deny cross-reader/anonymous access and malformed writes.
