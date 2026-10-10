export type GameReview = { text: string; stars: number; updatedAt: string }
export function makeGameReview(text: string, stars: number): GameReview {
  if (text.length > 2000) throw new Error('Keep your review under 2,000 characters.')
  if (!Number.isInteger(stars) || stars < 0 || stars > 5) throw new Error('Choose up to five stars.')
  return { text: text.trim(), stars, updatedAt: new Date().toISOString() }
}
