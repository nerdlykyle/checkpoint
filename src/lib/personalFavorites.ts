export type FavoriteKind = 'games' | 'books' | 'movies'
export type PersonalFavorites = Record<FavoriteKind, string[]>
export const emptyFavorites = (): PersonalFavorites => ({ games: [], books: [], movies: [] })
export function readFavorites(raw: unknown): PersonalFavorites {
  const data = raw && typeof raw === 'object' ? raw as Partial<PersonalFavorites> : {}
  return Object.fromEntries(['games','books','movies'].map(kind => [kind, Array.isArray(data[kind as FavoriteKind]) ? [...new Set(data[kind as FavoriteKind]!.filter(id => typeof id === 'string' && id.length > 0 && id.length <= 200))].slice(0,2000) : []])) as PersonalFavorites
}
export function setPersonalFavorite(old: PersonalFavorites, kind: FavoriteKind, id: string, active: boolean): PersonalFavorites {
  if (!id || id.length > 200) throw new Error('Invalid favorite.')
  const items = old[kind].filter(value => value !== id)
  if (active) items.push(id)
  if (items.length > 2000) throw new Error('Your favorites shelf is full.')
  return { ...old, [kind]: items }
}
