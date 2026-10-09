import type { Game } from '../types.ts'

/** Presentation only. Filters select content; a parent is included as context. */
export function gameCollections(visible: Game[], all: Game[]) {
  const groups = new Map<string, { game: Game; extras: Game[] }>()
  for (const game of visible) {
    const named = !game.parentGameId && game.parentGameTitle
      ? all.filter(item => item.contentType !== 'dlc' && item.title.trim().toLowerCase() === game.parentGameTitle!.trim().toLowerCase()) : []
    const parent = game.contentType === 'dlc'
      ? all.find(item => item.id === game.parentGameId && item.contentType !== 'dlc') || (named.length === 1 ? named[0] : undefined) : undefined
    const root = parent || game
    let group = groups.get(root.id)
    if (!group) { group = { game: root, extras: [] }; groups.set(root.id, group) }
    if (parent && !group.extras.some(item => item.id === game.id)) group.extras.push(game)
  }
  return [...groups.values()]
}
