import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {guideMissions,isFarFarWest,readGuideRun,updateGuideRun,readGuideUnlocks,updateGuideUnlocks} from '../src/lib/farFarWestGuide.ts'

test('field guide appears only for the exact game or its Steam ID',()=>{
  assert.equal(isFarFarWest({title:' FAR  FAR WEST '}),true)
  assert.equal(isFarFarWest({title:'Renamed',steamAppId:'3124540'}),true)
  for(const game of [undefined,{title:'West'},{title:'Far Far West 2'},{title:'Other',steamAppId:'12'}])assert.equal(isFarFarWest(game),false)
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
  assert.match(app,/isFarFarWest\(game\) && <FarFarWestFieldGuide/)
})
test('all twelve reference images exist locally and map labels match their actual contents',()=>{
  const images=guideMissions.flatMap(m=>[m.overview,...m.steps.flatMap(s=>s.image?[s.image]:[])])
  assert.equal(new Set(images.map(i=>i.file)).size,12)
  for(const image of images){
    const file=new URL(`../public/guides/far-far-west/${image.file}.jpg`,import.meta.url)
    assert.ok(existsSync(file));assert.equal(readFileSync(file).readUInt16BE(0),0xffd8)
  }
  assert.match(guideMissions.find(m=>m.id==='desert').overview.label,/reference/)
  assert.match(guideMissions.find(m=>m.id==='woodlands').overview.label,/unmarked/)
})
test('step edits merge with other crew edits and can be undone without touching rewards',()=>{
  let state=updateGuideRun(undefined,'canyon',1,'sheriff',true)
  state=updateGuideRun(state,'canyon',1,'digging',true)
  assert.deepEqual(state.checked,['sheriff','digging'])
  assert.deepEqual(updateGuideRun(state,'canyon',1,'digging',true),state)
  assert.deepEqual(updateGuideRun(state,'canyon',1,'sheriff',false).checked,['digging'])
  assert.deepEqual(state.checked,['sheriff','digging'])
  assert.throws(()=>updateGuideRun(state,'canyon',1,'invalid',true))
  assert.throws(()=>readGuideRun({},'unknown'))
})
test('new attempt is explicit, map-scoped and rejects stale in-flight edits',()=>{
  const saved={canyon:{checked:['sheriff'],attempt:1},north:{checked:['head'],attempt:3}}
  const unlocks={checked:['canyon']}
  const next={...saved,canyon:updateGuideRun(saved.canyon,'canyon',1,null,false)}
  assert.deepEqual(next.canyon,{checked:[],attempt:2});assert.deepEqual(next.north,saved.north)
  assert.deepEqual(unlocks,{checked:['canyon']})
  assert.throws(()=>updateGuideRun(next.canyon,'canyon',1,'digging',true),/new attempt/)
  assert.throws(()=>updateGuideRun(next.canyon,'canyon',1,null,false),/new attempt/)
})
test('saved progress is sanitized and personal unlocks stay independent and reversible',()=>{
  assert.deepEqual(readGuideRun({checked:['head','head','sheriff',12],attempt:2},'north'),{checked:['head'],attempt:2})
  assert.deepEqual(readGuideRun(null,'north'),{checked:[],attempt:1})
  assert.deepEqual(readGuideUnlocks({checked:['canyon','canyon',42,'unknown']}),['canyon'])
  const data={checked:['canyon']}
  assert.deepEqual(updateGuideUnlocks(data,'north',true),['canyon','north'])
  assert.deepEqual(updateGuideUnlocks(data,'canyon',false),[])
  assert.deepEqual(data,{checked:['canyon']})
})
