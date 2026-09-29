# Book discovery: Jeselnik Book Club

In Books mode, **Discover → Jeselnik Book Club** shows the official monthly
selections, newest first. A pick for the current Central-time month is labeled
Current monthly pick; if no new selection is announced, the previous selection
becomes Latest announced pick instead of falsely claiming the club is still
reading it. Past picks retain their dates and discussion links.

- Add to my shelf defaults to the current reader's To read shelf. Existing
  Reading/Read statuses and other readers' data are preserved.
- Nominate for our poll adds a yes vote without adding a personal shelf or
  starting/queuing a group read. Passed-on and already queued/current/completed
  club books cannot be re-nominated here.
- Catalog ISBN, Open Library work ID, source ID, and matching title + author
  prevent common duplicate imports. Existing notes, ratings, and progress win.
- The initial feed contains January–September 2026 picks and eight discussions.
  Short summaries and catalog corrections were checked against the official
  page, publishers, and Open Library; source links are included on each card.

## Automatic refresh

The existing Pages workflow runs daily at noon **America/Chicago**, adjusting for
daylight saving time. GitHub may delay scheduled jobs during busy periods. Each
build runs `node scripts/update-jeselnik-books.mjs`; the site reads the generated
`public/jeselnik-books.json`, not the external website from the browser. No CORS
proxy, account connection, Firebase function, or additional secret is needed.

The importer reads explicit month headings, ISBN purchase links, and YouTube
discussion embeds from the official page. New ISBNs are enriched with Open
Library data; existing catalog metadata is reused. It keeps all earlier months,
even if removed from the source. If the layout, source, or a new book's metadata
cannot be read safely, the previous feed and its successful-check timestamp are
left untouched. The UI warns when that timestamp is over three days old.

After a successful build, the workflow commits **only** the saved book feed back
to main, then deploys the same build. This requires the workflow's `contents:
write` permission. There is no force push; concurrent repository updates or a
protected branch will fail the push rather than overwrite work. The built-in
GitHub Actions token's push does not trigger a recursive push workflow. Pull
remote changes before future edits because the daily job can update this file.

`Reload list` downloads the most recently published feed; it does not scrape the
source on demand. For an immediate source refresh, run the Pages workflow
manually in GitHub Actions or run the importer locally and publish the result.

## Verification

Run `node --test scripts/*.test.mjs`, `npx tsc -b`, `npx vite build`, and
`npm run lint`. Importer tests use fake source pages and temporary feeds; they
cover year rollover, incomplete/ambiguous parsing, outage retention, new picks,
duplicate prevention, and personal/group isolation without touching live data.
