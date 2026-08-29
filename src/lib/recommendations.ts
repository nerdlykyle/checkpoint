import type { RecommendationFeed } from '../types'

function isRecommendationFeed(value: unknown): value is RecommendationFeed {
  if (!value || typeof value !== 'object') return false
  const feed = value as Partial<RecommendationFeed>
  return typeof feed.editionDate === 'string'
    && typeof feed.generatedAt === 'string'
    && feed.minimumReviews === 25
    && feed.minimumOnlinePlayers === 3
    && Array.isArray(feed.recommendations)
    && feed.recommendations.every((game) => game
      && typeof game.steamAppId === 'string'
      && typeof game.title === 'string'
      && typeof game.onlineCoopMax === 'number'
      && typeof game.totalReviews === 'number')
}

export async function loadRecommendationFeed(signal?: AbortSignal) {
  const response = await fetch(`${import.meta.env.BASE_URL}recommendations.json`, {
    signal,
    cache: 'no-cache',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error('The weekly recommendation feed is unavailable.')
  const data = await response.json() as unknown
  if (!isRecommendationFeed(data)) throw new Error('The weekly recommendation feed needs to be refreshed.')
  return data
}
