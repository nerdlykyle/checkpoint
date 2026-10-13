import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = file => readFileSync(new URL('../src/'+file,import.meta.url),'utf8')
test('radar add keeps its action and excludes the tile from global accent fills',()=>{
  assert.match(read('App.tsx'), /<RadarAddButton onClick={\(\) => openAddGame\(\)} \/>/)
  assert.match(read('RadarAddButton.tsx'), /type="button" onClick={onClick}/)
  assert.equal((read('VisualControls.css').match(/:not\(\.radar-add\)/g)||[]).length,2)
  assert.match(read('RadarAddButton.css'), /background:transparent !important/)
})
test('only the plus square lifts and fills while its icon makes one turn',()=>{
  const css=read('RadarAddButton.css')
  assert.match(css,/\.radar-add:hover > span \{[^}]*background:var\(--button-accent\)[^}]*color:#fff[^}]*translateY\(-4px\)/)
  assert.match(css,/\.radar-add:hover > span > svg \{ transform:rotate\(360deg\)/)
  assert.match(css,/prefers-reduced-motion:reduce[\s\S]*transform:none !important/)
  assert.match(css,/:focus-visible > span/)
})
