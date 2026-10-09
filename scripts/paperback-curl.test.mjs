import test from 'node:test'
import assert from 'node:assert/strict'
import { curlVertex, curlPulse, CURL_DURATION, CURL_PAGE_COUNT } from '../src/lib/paperbackCurl.ts'

test('full-edge curl rolls both right corners back and exposes the underside', () => {
  for (const v of [0, .5, 1]) {
    const flat = curlVertex(1, v, 0), rolled = curlVertex(1, v, 1)
    assert.ok(rolled.x < flat.x - 75)
    assert.ok(rolled.y < flat.y)
    assert.ok(rolled.z > 50)
    assert.ok(rolled.angle > Math.PI / 2)
    assert.deepEqual(curlVertex(0, v, 1), curlVertex(0, v, 0))
  }
})
test('twenty staggered sheets and cover settle completely before the animation ends', () => {
  assert.equal(CURL_PAGE_COUNT, 20)
  for (const t of [0, CURL_DURATION / 1000]) {
    assert.equal(curlPulse(t, 0, .42, 1.18, 2.05), 0)
    for (let i = 20; i >= 1; i--) {
      const s = (20 - i) * .025
      assert.equal(curlPulse(t, .1 + s * .4, .43 + s * .3, .65 + s, 1.19 + s), 0)
    }
  }
  assert.equal(curlPulse(.8, 0, .42, 1.18, 2.05), 1)
})
test('curl geometry remains finite throughout the animation and flat at rest', () => {
  for (let t = 0; t <= 1; t += .05) for (let u = 0; u <= 1; u += .1) for (const v of [0, .5, 1]) {
    const p = curlVertex(u, v, t)
    assert.ok(Object.values(p).every(Number.isFinite))
  }
  assert.equal(curlVertex(1, 1, 0).x, 220)
  assert.equal(curlVertex(1, 1, 0).y, 328)
})
