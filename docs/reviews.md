# Written reviews

All four media detail screens have a personal written review, visible to the
crew. Stars are optional. Reviews are plain text, limited to 2,000 characters.

- Books retain their existing per-reader ratings/reviews on the board. The
  explicit Save review button replaces blur-only saving. A review without stars
  no longer manufactures a one-star rating, and averages exclude unrated entries.
- Music retains its existing ratings/reviews. Text-only reviews can now be saved.
- Movies add an optional UID-keyed `reviews` map; existing ratings, seen status,
  libraries and group watches are untouched. Transactions merge only the author's
  review field. Empty text clears it without deleting anyone else's review.
- Games use `boards/{boardId}/gameReviews/{gameId}/members/{uid}` documents with
  `text`, optional-rating sentinel `stars: 0`, and `updatedAt`. Each author
  writes only their own document. No existing game record migration is needed.

Game/movie reviews are readable by active board members only. Rules validate
length/type/rating and deny writes to another member's review. Local previews
have isolated fixtures and do not touch production data.

## Release requirement

Deploy the updated Firestore rules **before** publishing the client. Until then,
the live rules reject the new game review collection and movie review field.
Do not change authentication or migrate existing member/media data.

If a backup enumerates collections rather than exporting the whole database,
include the new gameReviews member subcollections. Movie reviews live inside
the existing movie documents.

Checks: `scripts/reviews.test.mjs`, `scripts/review-rules.test.mjs` and
`scripts/movie-rules.test.mjs`. Rule tests require the demo Firestore emulator.
Browser fixtures: `tests/reviews.html` and `tests/movies.html`.
