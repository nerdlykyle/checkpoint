import test from 'node:test'
import assert from 'node:assert/strict'
import { dragDestination, dragOffsets, dragScrollSpeed } from '../src/lib/dragLayout.ts'

const cards = [{top:100,height:100},{top:212,height:200},{top:424,height:80}]
test('pointer positions cross neighboring card centers, including variable mobile heights', () => {
  assert.equal(dragDestination(cards,0,311),0)
  assert.equal(dragDestination(cards,0,313),1)
  assert.equal(dragDestination(cards,0,465),2)
  assert.equal(dragDestination(cards,2,149),0)
  assert.equal(dragDestination(cards,1,-100),0)
  assert.equal(dragDestination(cards,1,10000),2)
})
test('preview makes exactly enough room for the card and preserves spacing', () => {
  assert.deepEqual(dragOffsets(cards,0,2),[304,-112,-112])
  assert.deepEqual(dragOffsets(cards,2,0),[92,92,-324])
  assert.deepEqual(dragOffsets(cards,1,1),[0,0,0])
  assert.deepEqual(dragOffsets([{top:0,height:75},{top:75,height:75}],0,1),[75,-75])
})
test('scrolling shifts hit targets consistently and edge speed remains bounded', () => {
  const scrolled = cards.map(card=>({...card,top:card.top-90}))
  assert.equal(dragDestination(scrolled,0,223),1)
  assert.equal(dragScrollSpeed(400,0,800),0)
  assert.equal(dragScrollSpeed(0,0,800),-18)
  assert.equal(dragScrollSpeed(800,0,800),18)
  assert.equal(dragScrollSpeed(9999,0,800),18)
  assert.ok(dragScrollSpeed(40,0,800)<0)
})
