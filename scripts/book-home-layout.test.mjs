import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')
test('logo hover area has balanced padding and external navigation spacing', () => {
  const brand = css.match(/^\.brand \{([^}]+)\}/m)[1]
  assert.match(brand, /padding: 6px 8px;/)
  assert.match(brand, /margin-bottom: 13px;/)
  assert.match(css, /\.sidebar \.brand \{ padding: 6px; \}/)
})

test('home club read matches the campaign column and collapses on smaller screens', () => {
  const columns = selector => css.match(new RegExp('\\.' + selector + ' \\{[^}]*grid-template-columns: ([^;]+)'))[1]
  assert.equal(columns('book-home-current'), columns('dashboard-grid'))
  assert.match(css, /@media \(max-width: 1180px\) \{ \.book-home-current \{ grid-template-columns: minmax\(0, 1fr\);/)
  const source = readFileSync(new URL('../src/BookClub.tsx', import.meta.url), 'utf8')
  assert.ok(source.includes("section === 'home' ? ' book-home-current' : ''"))
})
