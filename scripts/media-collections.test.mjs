import test from 'node:test'
import assert from 'node:assert/strict'
import { artistCollections, bookCollections } from '../src/lib/mediaCollections.ts'

const book = (id, position, extra = {}) => ({ id, title:id, authors:['Author'], series:{name:'Saga',position}, createdAt:'2026-01-01', ...extra })
const album = (id, year, extra = {}) => ({ id, title:id, kind:'album', artists:['Artist'], year, createdAt:'2026-01-01', ...extra })

test('series stacks show latest publication first, preserve input order and never merge different authors', () => {
  const input = [book('first',1,{publishedYear:2024}),book('third',3,{publishedYear:2026}),book('other',2,{authors:['Other']}),book('second',2,{publishedYear:2025}),book('solo',0,{series:undefined})]
  const snapshot = structuredClone(input)
  assert.deepEqual(bookCollections(input).map(group=>group.map(item=>item.id)),[['third','second','first'],['other'],['solo']])
  assert.deepEqual(input,snapshot)
  assert.deepEqual(bookCollections([book('one',1),book('two',2)]).map(group=>group.map(item=>item.id)),[['two','one']])
})
test('filtered series contain only the matching shelf books supplied, not missing installments', () => {
  const books=[book('first',1,{shelves:{nern:'reading'}}),book('last',3,{shelves:{nern:'paused'}}),book('friend',4,{shelves:{jern:'reading'}})]
  assert.deepEqual(bookCollections(books.filter(book=>book.shelves.nern==='reading')).flat().map(book=>book.id),['first'])
})
test('artist stacks include albums and EPs, newest release first; songs and separate credits stay separate', () => {
  const input=[album('old','2020'),album('new','2026-02-01',{kind:'ep'}),album('song','2026',{kind:'song'}),album('collab','2027',{artists:['Artist','Guest']}),album('unknown',undefined)]
  const snapshot=structuredClone(input)
  assert.deepEqual(artistCollections(input).map(group=>group.map(item=>item.id)),[['new','old','unknown'],['song'],['collab']])
  assert.deepEqual(input,snapshot)
})
test('artist identities prevent same-name collisions; legacy name-only releases still group', () => {
  assert.equal(artistCollections([album('a','2024',{artistIds:['one']}),album('b','2025',{artistIds:['two']})]).length,2)
  assert.equal(artistCollections([album('a','2024'),album('b','2025',{artists:[' ARTIST ']})]).length,1)
  assert.equal(artistCollections([album('a','2024',{artists:[]}),album('b','2025',{artists:[]})]).length,2)
})
