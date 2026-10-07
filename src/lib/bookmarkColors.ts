import type { Member } from '../types'

export const bookmarkPalette = ['#8473ed', '#32b5a2', '#e9ac4c', '#e8799d', '#60a5fa', '#b99a79']
export function validBookmarkColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}
export function bookmarkColor(member?: Pick<Member, 'id' | 'name' | 'persona' | 'bookmarkColor'>): string {
  if (validBookmarkColor(member?.bookmarkColor)) return member.bookmarkColor.toLowerCase()
  const persona = (member?.persona || member?.name || '').toLowerCase()
  const known = ['nern', 'jern', 'vern'].indexOf(persona)
  const hash = [...(member?.id || '')].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 0)
  return bookmarkPalette[known >= 0 ? known : hash % bookmarkPalette.length]
}
export function bookmarkInk(color: string): string {
  const rgb = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 > .179 ? '#111820' : '#ffffff'
}
