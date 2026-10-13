# Personal favorites

Games, books and movies have a Favorites tab in their libraries. Use the heart
in an item's details to toggle your favorite. The member picker lets crew browse
each other's favorites. Favorites do not change votes, queues, ownership, seen
status, reading progress or existing saved libraries.

Music's Favorites shelf combines existing favorite artists with favorite albums
and EPs, retaining its collapsed-by-default behavior. Existing artist and album
favorite records are reused without migration.

Games/books/movies use `boards/{boardId}/personalFavorites/{uid}` documents with
`games`, `books` and `movies` ID lists. Only that member can write their document;
active crew can read it. Transactions preserve concurrent changes across types.
Errors disable saving and offer retry rather than replacing cloud records with
an empty local copy. Demo favorites use a separate local-storage key.

Deploy the updated Firestore rules before publishing the client. No authentication
changes or existing media/profile migrations are required. If external backups
enumerate collections, include `personalFavorites` along with existing music and
artist-favorite collections. This change does not configure external backups.

Tests: `scripts/personal-favorites.test.mjs` and
`scripts/personal-favorites-rules.test.mjs` (demo Firestore emulator required).
