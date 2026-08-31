import type { ActivityChange, ActivityEntry, Game } from '../types'

export function recoverMissingGameAdds(games: Game[], activity: ActivityEntry[]) {
  const existingIds = new Set(games.map((game) => game.id))
  const latestChangeByGame = new Map<string, { entry: ActivityEntry; change: ActivityChange }>()
  const newestFirst = [...activity].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  newestFirst.forEach((entry) => entry.undo?.changes.forEach((change) => {
    if (change.entity === 'game' && !latestChangeByGame.has(change.entityId)) latestChangeByGame.set(change.entityId, { entry, change })
  }))
  const recovered = [...latestChangeByGame.values()].flatMap(({ entry, change }) => {
    if (entry.action !== 'game-added' || entry.undoneAt || existingIds.has(change.entityId) || !change.after) return []
    const game = change.after as Partial<Game>
    if (typeof game.id !== 'string' || typeof game.title !== 'string' || typeof game.status !== 'string') return []
    existingIds.add(game.id)
    return [change.after as Game]
  })
  return { games: [...games, ...recovered], recovered }
}
