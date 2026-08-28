import type { Game, Member, SteamCrewSnapshot } from '../types'

export function manualOwnershipFor(game: Game, memberId: string) {
  return game.manualOwnership && Object.prototype.hasOwnProperty.call(game.manualOwnership, memberId)
    ? game.manualOwnership[memberId]
    : undefined
}

export function ownershipRecordForMember(game: Game, member: Member, steam: SteamCrewSnapshot | null) {
  const manual = manualOwnershipFor(game, member.id)
  if (typeof manual === 'boolean') return { owned: manual, source: 'manual' as const }
  const steamRecord = game.steamAppId && member.steamId ? steam?.ownership[game.steamAppId]?.[member.steamId] : undefined
  return steamRecord ? { ...steamRecord, source: 'steam' as const } : undefined
}

export function ownershipForGame(game: Game, crew: Member[], steam: SteamCrewSnapshot | null) {
  const linked = crew.filter((member) => member.steamId)
  const known = crew.filter((member) => ownershipRecordForMember(game, member, steam))
  const owners = crew.filter((member) => ownershipRecordForMember(game, member, steam)?.owned)
  const missing = crew.filter((member) => ownershipRecordForMember(game, member, steam)?.owned === false)
  const complete = crew.length > 0 && known.length === crew.length
  return { linked, known, owners, missing, everyoneOwns: complete && owners.length === crew.length }
}
