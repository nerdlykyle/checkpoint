// Short, attributed field notes. Images are bundled, never hotlinked at runtime.
export const GUIDE_SOURCE = 'https://farfarwestguides.com/guides/far-far-west-all-secret-missions-medallion-locations-guide'
export const GUIDE_ID = 'far-far-west'
export type GuideImage = { file: string; label: string }
export type GuideStep = { id: string; title: string; hint?: string; image?: GuideImage }
export type GuideMission = { id: string; map: string; title: string; reward: string; overview: GuideImage; note?: string; steps: GuideStep[] }
export const guideMissions: GuideMission[] = [
  { id:'far-west', map:'Far West', title:'Great Bell', reward:'Bell Shot', overview:{file:'bells-map',label:'Bell locations'}, note:'Repeat each bell’s sequence, then return to the church.', steps:[
    ...[1,2,3].map(n=>({id:`bell-${n}`,title:`Bell puzzle ${n}`})),
    {id:'church',title:'Restore the Great Bell',image:{file:'church',label:'Church and Great Bell'}},
  ]},
  { id:'canyon', map:'Canyon', title:'Medallion hunt', reward:'Pick Joker', overview:{file:'canyon-map',label:'Medallion locations'}, steps:[
    {id:'sheriff',title:'Sheriff’s medallion',hint:'Body beside the cave.',image:{file:'cave',label:'Medallion cave'}},
    {id:'digging',title:'Digging medallion',hint:'East bridge · dig rocky mounds.',image:{file:'digging',label:'Digging reference'}},
    {id:'dynamite',title:'Dynamite medallion',hint:'North · blast glowing rocks.',image:{file:'dynamite',label:'Dynamite reference'}},
    {id:'targets',title:'Target medallion',hint:'West · shoot all 10 target sets; loot safe.',image:{file:'targets',label:'Target reference'}},
    {id:'cave',title:'Cave turn-in',hint:'Insert all four medallions.',image:{file:'treasure',label:'Cave reward'}},
  ]},
  { id:'desert', map:'Desert', title:'Cactus reunion', reward:'Cactus Day', overview:{file:'cactus-map',label:'Cactus reference'}, note:'Reunite six child–parent pairs. Follow their clues. The guide’s image is a reference photo, not a marked map.', steps:Array.from({length:6},(_,i)=>({id:`pair-${i+1}`,title:`Pair ${i+1} reunited`})) },
  { id:'woodlands', map:'Woodlands', title:'Mushroom sequence', reward:'Shroom Grave', overview:{file:'mushroom-map',label:'Woodlands map (unmarked)'}, note:'Follow the cave’s sequence: southeast, then clockwise. This source map has no numbered markers.', steps:[
    ...Array.from({length:7},(_,i)=>({id:`mushroom-${i+1}`,title:`Mushroom ${i+1}`})), {id:'stone',title:'Return to the cave stone'},
  ]},
  { id:'north', map:'Far Far North', title:'Snowman', reward:'Carabao Skin', overview:{file:'snowman-map',label:'Snowman locations'}, note:'Roll each part to the cave. Avoid trees.', steps:['body','chest','head'].map(id=>({id,title:`Return ${id}`})) },
  { id:'area-41', map:'Area 41', title:'Monoliths', reward:'Anti-Gravity Falls', overview:{file:'monolith',label:'Monolith reference'}, note:'Record symbols, then enter them in this order. The guide has no location map for this mission.', steps:[
    ...['Far West','Desert','Canyon','Woodlands'].map((map,i)=>({id:`symbol-${i+1}`,title:`${i+1}. ${map} symbol`})), {id:'enter',title:'Enter sequence · press button'},
  ]},
]
export function isFarFarWest(game?: { title: string; steamAppId?: string }) {
  return Boolean(game && (game.steamAppId === '3124540' || game.title.trim().toLowerCase().replace(/\s+/g,' ') === 'far far west'))
}
export type GuideRun = { checked: string[]; attempt: number }
export const emptyRun = (): GuideRun => ({checked:[],attempt:1})
export function missionById(id: string) {
  const mission=guideMissions.find(item=>item.id===id)
  if (!mission) throw new Error('Unknown field-guide map.')
  return mission
}
export function readGuideRun(raw: unknown, mapId: string): GuideRun {
  const data=raw && typeof raw==='object' ? raw as Partial<GuideRun> : {}
  const ids=missionById(mapId).steps.map(step=>step.id)
  return {checked:Array.isArray(data.checked)?[...new Set(data.checked.filter(id=>ids.includes(id)))]:[],attempt:Number.isSafeInteger(data.attempt)&&data.attempt!>0?data.attempt!:1}
}
export function updateGuideRun(raw: unknown, mapId: string, expectedAttempt: number, step: string | null, checked: boolean): GuideRun {
  const run=readGuideRun(raw,mapId)
  if (run.attempt!==expectedAttempt) throw new Error('The crew started a new attempt. Review the updated checklist and try again.')
  if (step===null) return {checked:[],attempt:run.attempt+1}
  if (!missionById(mapId).steps.some(item=>item.id===step)) throw new Error('Unknown checklist step.')
  return {...run,checked:[...run.checked.filter(id=>id!==step),...(checked?[step]:[])]}
}
export function readGuideUnlocks(raw: unknown): string[] {
  const list=raw && typeof raw==='object' && 'checked' in raw ? raw.checked : []
  return Array.isArray(list)?[...new Set(list.filter((id): id is string=>typeof id==='string'&&guideMissions.some(mission=>mission.id===id)))]:[]
}
export function updateGuideUnlocks(raw: unknown, id: string, active: boolean) {
  missionById(id)
  return [...readGuideUnlocks(raw).filter(value=>value!==id),...(active?[id]:[])]
}
