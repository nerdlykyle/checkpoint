import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gameCollections } from '../src/lib/gameCollections.ts'

const base = { id:'base', title:'The Game', contentType:'game' }
const dlc = { id:'dlc', title:'Expansion', contentType:'dlc', parentGameId:'base' }
const other = { id:'other', title:'Another Game', contentType:'game' }
test('DLC groups behind its parent regardless of order, without changing records', () => {
  const games=[dlc,other,base],before=JSON.stringify(games)
  assert.deepEqual(gameCollections(games,games),[{game:base,extras:[dlc]},{game:other,extras:[]}])
  assert.equal(JSON.stringify(games),before)
})
test('filtering to DLC brings its parent along as context, but not unrelated content', () => {
  assert.deepEqual(gameCollections([dlc],[base,dlc,other]),[{game:base,extras:[dlc]}])
  assert.deepEqual(gameCollections([base],[base,dlc,other]),[{game:base,extras:[]}])
})
test('orphan DLC stays reachable and title fallback only links an unambiguous base', () => {
  assert.deepEqual(gameCollections([dlc],[dlc]),[{game:dlc,extras:[]}])
  const legacy={...dlc,parentGameId:undefined,parentGameTitle:' the game '}
  assert.equal(gameCollections([legacy],[base,legacy])[0].game.id,'base')
  assert.equal(gameCollections([legacy],[base,{...base,id:'duplicate'},legacy])[0].game.id,'dlc')
})
test('cards keep reactions in details, separate card expansion from details and restore focus', () => {
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
  const card=app.slice(app.indexOf('export function LibraryCard'),app.indexOf('function RecommendationCard'))
  assert.doesNotMatch(card, /<VoteButton|<ThumbsDown/)
  assert.match(card, /onClick=\{onActivate \|\| onOpen\}/)
  assert.match(app,/details-quick-actions.*onArchive.*ThumbsDown/)
  const shelf=readFileSync(new URL('../src/GameShelf.tsx',import.meta.url),'utf8')
  assert.match(shelf,/key === 'Escape'/)
  assert.match(shelf,/trigger\?\.focus/)
  assert.match(shelf,/aria-label="Collapse extra content"/)
})
