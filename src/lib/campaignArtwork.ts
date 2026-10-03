import type { Game } from '../types'

/** Prefer wide Steam artwork; retain the existing cover/parent fallback chain. */
export function campaignArtworkUrls(game: Pick<Game, 'steamAppId' | 'artworkUpdatedAt'> | undefined, fallbacks: string[]) {
  const appId = game?.steamAppId
  const revision = game?.artworkUpdatedAt ? `?checkpoint=${encodeURIComponent(game.artworkUpdatedAt)}` : ''
  return [...new Set([
    ...(/^\d+$/.test(appId ?? '') ? [`https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_hero.jpg${revision}`] : []),
    ...fallbacks,
  ].filter(Boolean))]
}
