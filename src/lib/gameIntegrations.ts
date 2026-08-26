import type {
  SteamAchievementSnapshot,
  SteamCrewSnapshot,
} from '../types'
import type { SteamProfile } from './sharedBoard'

const apiBase = String(import.meta.env.VITE_CHECKPOINT_API_URL || 'https://checkpoint-game-data.claw8ex.workers.dev').replace(/\/$/, '')

export const gameIntegrationsConfigured = Boolean(apiBase)

async function requestJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (!apiBase) throw new Error('Game integrations are not configured yet.')
  const response = await fetch(`${apiBase}${path}`, { signal, headers: { Accept: 'application/json' } })
  const body = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) {
    const message = body.error === 'steam_private'
      ? 'Steam could not read that profile. Set Profile and Game details to Public, then try again.'
      : body.error === 'steam_unconfigured'
        ? 'Steam tracking still needs its private API key.'
        : body.error || 'The game data service is unavailable.'
    throw new Error(message)
  }
  return body as T
}

function query(boardId: string, values: Record<string, string>) {
  const params = new URLSearchParams({ board: boardId, ...values })
  return params.toString()
}

export async function resolveSteamProfile(boardId: string, profile: string, signal?: AbortSignal) {
  return requestJson<SteamProfile>(`/steam/resolve?${query(boardId, { profile })}`, signal)
}

export async function loadSteamCrew(boardId: string, steamIds: string[], appIds: string[], signal?: AbortSignal) {
  if (!steamIds.length || !appIds.length) return null
  return requestJson<SteamCrewSnapshot>(`/steam/crew?${query(boardId, {
    steamIds: steamIds.join(','),
    appIds: appIds.join(','),
  })}`, signal)
}

export async function loadGameAchievements(boardId: string, steamIds: string[], appId: string, signal?: AbortSignal) {
  if (!steamIds.length || !appId) return []
  const result = await requestJson<{ achievements: SteamAchievementSnapshot[] }>(`/steam/achievements?${query(boardId, {
    steamIds: steamIds.join(','),
    appId,
  })}`, signal)
  return result.achievements
}
