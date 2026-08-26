import type { GameDeal } from '../types'

const API = 'https://www.cheapshark.com/api/1.0'
const CACHE_KEY = 'checkpoint-cheapshark-v1'

type CheapSharkDeal = {
  title?: string
  dealID?: string
  storeID?: string
  salePrice?: string
  normalPrice?: string
  savings?: string
}

type PriceCache = {
  windowId: string
  checkedAppIds: string[]
  deals: GameDeal[]
}

function centralPriceWindow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const hour = Number(values.hour)
  let date = `${values.year}-${values.month}-${values.day}`
  let slot = 20
  if (hour < 8) {
    const previous = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) - 1, 12))
    date = previous.toISOString().slice(0, 10)
  } else if (hour < 14) slot = 8
  else if (hour < 20) slot = 14
  return `${date}-${slot}`
}

function readCache() {
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') as PriceCache | null
    return value && Array.isArray(value.deals) && Array.isArray(value.checkedAppIds) ? value : null
  } catch {
    return null
  }
}

async function stores(signal?: AbortSignal) {
  const response = await fetch(`${API}/stores`, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('CheapShark stores are unavailable.')
  const rows = await response.json() as Array<{ storeID: string; storeName: string; isActive: number }>
  return Object.fromEntries(rows.filter((store) => store.isActive === 1).map((store) => [store.storeID, store.storeName]))
}

async function cheapestSteamDeal(appId: string, storeNames: Record<string, string>, signal?: AbortSignal): Promise<GameDeal | null> {
  const url = new URL(`${API}/deals`)
  url.searchParams.set('steamAppID', appId)
  url.searchParams.set('steamworks', '1')
  url.searchParams.set('pageSize', '60')
  url.searchParams.set('sortBy', 'Price')
  url.searchParams.set('desc', '0')
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) return null
  const rows = await response.json() as CheapSharkDeal[]
  const deal = rows.filter((row) => row.dealID && Number.isFinite(Number(row.salePrice))).sort((a, b) => Number(a.salePrice) - Number(b.salePrice))[0]
  if (!deal?.dealID) return null
  const price = Number(deal.salePrice)
  const retailPrice = Number(deal.normalPrice || deal.salePrice)
  return {
    steamAppId: appId,
    title: deal.title || '',
    price,
    retailPrice,
    savingsPercent: Math.max(0, Number(deal.savings || (retailPrice > 0 ? (1 - price / retailPrice) * 100 : 0))),
    storeName: storeNames[deal.storeID || ''] || 'PC store',
    dealUrl: `https://www.cheapshark.com/redirect?dealID=${deal.dealID}`,
    updatedAt: new Date().toISOString(),
  }
}

async function mapFiveAtATime<T, R>(values: T[], task: (value: T) => Promise<R>) {
  const results: R[] = []
  let cursor = 0
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++
      results[index] = await task(values[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(5, values.length) }, worker))
  return results
}

export async function loadCheapSharkDeals(appIds: string[], signal?: AbortSignal) {
  const requested = [...new Set(appIds)].slice(0, 40)
  if (!requested.length) return []
  const cached = readCache()
  const windowId = centralPriceWindow()
  if (cached?.windowId === windowId && requested.every((id) => cached.checkedAppIds.includes(id))) {
    return cached.deals.filter((deal) => requested.includes(deal.steamAppId))
  }
  try {
    const storeNames = await stores(signal)
    const deals = (await mapFiveAtATime(requested, (appId) => cheapestSteamDeal(appId, storeNames, signal)))
      .filter((deal): deal is GameDeal => Boolean(deal))
    const next: PriceCache = { windowId, checkedAppIds: requested, deals }
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)) } catch { /* Live prices still work without the browser cache. */ }
    return deals
  } catch (error) {
    if (cached) return cached.deals.filter((deal) => requested.includes(deal.steamAppId))
    throw error
  }
}
