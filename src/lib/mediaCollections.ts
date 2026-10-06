import type { Book } from '../types.ts'
import type { MusicItem } from './music.ts'
import { sameSeries } from './bookOrganization.ts'

// Views only: no records, shelf positions, or group choices are changed.
export function bookCollections(books: Book[]) {
  const groups: Book[][] = []
  for (const book of books) {
    const group = groups.find(items => items.every(item => sameSeries(item, book)))
    if (group) group.push(book)
    else groups.push([book])
  }
  return groups.map(items => {
    const dated = items.every(item => Boolean(item.publishedYear))
    return [...items].sort((a, b) =>
      (dated ? b.publishedYear! - a.publishedYear! : 0)
      || (b.series?.position ?? -1) - (a.series?.position ?? -1)
      || (b.publishedYear ?? 0) - (a.publishedYear ?? 0)
      || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
  })
}

function sameArtist(a: MusicItem, b: MusicItem) {
  if (a.kind === 'song' || b.kind === 'song') return false
  const normalize = (values: string[]) => values.map(value => value.trim().normalize('NFKC').toLowerCase()).sort().join('|')
  if (a.artistIds?.length && b.artistIds?.length) return normalize(a.artistIds) === normalize(b.artistIds)
  return a.artists.length > 0 && normalize(a.artists) !== '' && normalize(a.artists) === normalize(b.artists)
}

export function artistCollections(items: MusicItem[]) {
  const groups: MusicItem[][] = []
  for (const item of items) {
    const group = groups.find(entries => entries.every(entry => sameArtist(entry, item)))
    if (group) group.push(item)
    else groups.push([item])
  }
  return groups.map(entries => [...entries].sort((a, b) =>
    (b.year ?? '').localeCompare(a.year ?? '') || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)))
}
