import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('desktop and mobile profile avatars open personal settings and close the mobile drawer', () => {
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
  const rows=[...app.matchAll(/<div className="profile-row">(.*?)<\/div><\/div>/g)].map(match=>match[1])
  assert.equal(rows.length,2)
  for(const row of rows) {
    assert.match(row,/className="profile-settings-button" type="button"/)
    assert.match(row,/aria-label="Open your profile settings"/)
    assert.match(row,/aria-haspopup="dialog"/)
    assert.match(row,/setShowCrew\(true\); setMobileMenuOpen\(false\)/)
    assert.match(row,/<Avatar id={currentUser} \/><\/button>/)
    assert.doesNotMatch(row,/MoreHorizontal/)
  }
})

test('profile avatar has a touch-sized target and visible keyboard focus', () => {
  const css=readFileSync(new URL('../src/App.css',import.meta.url),'utf8')
  assert.match(css,/\.profile-row \.profile-settings-button \{[^}]*width:44px; height:44px/)
  assert.match(css,/\.profile-settings-button:focus-visible \{ outline:2px/)
})
