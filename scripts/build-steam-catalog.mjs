import { access, mkdir, writeFile } from 'node:fs/promises'

const source = 'https://raw.githubusercontent.com/jsnli/SteamAppIDList/master/data/games_appid.json'
const destination = new URL('../public/steam-games/', import.meta.url)

function normalize(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/^(the|an|a)\s+/, '')
}

function bucketFor(value) {
  const first = normalize(value)[0]
  return first && /[a-z0-9]/.test(first) ? first : '_'
}
let response
try {
  response = await fetch(source)
  if (!response.ok) throw new Error(`Steam catalog download failed (${response.status})`)
} catch (error) {
  try {
    await access(new URL('s.json', destination))
    console.warn('Steam catalog refresh failed; keeping the existing catalog.', error)
    process.exit(0)
  } catch {
    throw error
  }
}

const games = await response.json()
const compact = games
  .filter((game) => Number.isInteger(game.appid) && typeof game.name === 'string' && game.name.trim())
  .map((game) => [game.appid, game.name])

const buckets = new Map()
for (const game of compact) {
  const key = bucketFor(game[1])
  buckets.set(key, [...(buckets.get(key) ?? []), game])
}

await mkdir(destination, { recursive: true })
await Promise.all([...buckets].map(([key, bucket]) => writeFile(new URL(`${key}.json`, destination), JSON.stringify(bucket))))
console.log(`Prepared ${compact.length.toLocaleString()} Steam games for search.`)
