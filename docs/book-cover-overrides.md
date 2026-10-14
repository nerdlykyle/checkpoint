# Personal book covers

Book details → More book actions → Change my cover offers catalog alternatives,
upload, and direct image URL import, plus Reset to catalog cover. Uploads are
cropped to 2:3, resized to 512×768 and re-encoded as JPEG with photo metadata
removed. JPEG/PNG/WebP files only: 8 MB input, 24 MP decoded limit, 180 KB maximum
encoded data URL. A permission confirmation is required before saving.

URL import is browser-side HTTPS/CORS with omitted credentials, no redirects,
bounded download size and timeout. It rejects local/IP URLs; no arbitrary URL
proxy or backend fetch is introduced. A blocked source directs the user to upload
a permitted copy. Catalog candidates may instead be pinned as explicit links to
Google Books or Open Library, with a warning about continued provider dependency.

Storage reuses the existing bounded-image Firestore pattern used by puzzle pages:
`boards/{boardId}/bookCovers/{uid}/covers/{bookId}` contains `kind`, `image`, and
`updatedAt`. No original uploads, source URL for imported images, or base64 image
data go into the shared board document. The image field is excluded from indexes.
Only each owner may save or reset their covers. Active crew can read them when
browsing that reader's shelf. One shared subscription per displayed reader loads
only their manual overrides; no scans of every member. This is intended for a
small number of missing-cover corrections, not a general photo library. If cover
volume grows, move blobs to object storage while retaining the personal pointers.

Overrides take priority over automatic artwork resolution and never alter the
book record, edition, progress, comments, reviews or other members' choices.
Reset deletes only the caller's override and retries catalog artwork. A failed
save preserves the previous override. Demo data uses separate local storage.

Release: deploy `firestore:rules,firestore:indexes` before publishing the client.
No auth or media migration is needed. Include the bookCovers/covers subcollections
in any external backup that enumerates paths. This does not configure backups.

Checks: custom-book-cover.test.mjs, custom-book-cover-rules.test.mjs (demo emulator),
tests/book-covers.html (local editor/persistence/member isolation), tests/books.html
(full details menu integration). No production data is touched by fixtures.
