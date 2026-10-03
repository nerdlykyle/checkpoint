import test from 'node:test'
import assert from 'node:assert/strict'
import { campaignArtworkUrls } from '../src/lib/campaignArtwork.ts'

test('wide artwork precedes covers and parent fallbacks without duplicates', () => {
  const urls = campaignArtworkUrls({ steamAppId: '2183900' }, ['dlc-cover', 'parent-cover', 'dlc-cover'])
  assert.deepEqual(urls, ['https://cdn.akamai.steamstatic.com/steam/apps/2183900/library_hero.jpg', 'dlc-cover', 'parent-cover'])
})
test('manual games and empty campaigns do not request invalid Steam artwork', () => {
  assert.deepEqual(campaignArtworkUrls(undefined, []), [])
  assert.deepEqual(campaignArtworkUrls({ steamAppId: '../bad' }, ['manual-cover']), ['manual-cover'])
})
test('refreshing artwork invalidates the hero cache', () => {
  assert.match(campaignArtworkUrls({ steamAppId: '123', artworkUpdatedAt: '2026-10-03T01:00:00Z' }, [])[0], /checkpoint=2026-10-03T01%3A00%3A00Z$/)
})
