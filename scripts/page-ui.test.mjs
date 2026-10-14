import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const source = file => readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8')

test('media headers omit redundant copy and book home counts',()=>{
  const app=source('App.tsx'),books=source('BookClub.tsx'),music=source('MusicMode.tsx'),movies=source('MovieMode.tsx')
  assert.doesNotMatch(app,/todayLabel|dashboardSummary|Your current campaign and the crew/)
  assert.doesNotMatch(source('CampaignCard.tsx'),/Continue playing/)
  assert.doesNotMatch(books,/Checkpoint Book Club|Personal reading progress with|Your books, your order|Reading together|Pick up where you left off|The club shelf|book-section-count/)
  assert.doesNotMatch(music,/Checkpoint Music|Your music, with a shared place/)
  assert.doesNotMatch(movies,/Checkpoint Movies|Movie night together|>View all<|>Browse library</)
})

test('collection names match page and desktop/mobile navigation without changing route keys',()=>{
  assert.match(source('App.tsx'),/<span>Bookshelf<\/span>/)
  assert.match(source('App.tsx'),/<strong>Bookshelf<\/strong>/)
  assert.match(source('BookClub.tsx'),/section === 'library' \? 'Bookshelf'/)
  assert.match(source('lib/music.ts'),/library:'Catalogue'/)
  assert.match(source('lib/movies.ts'),/library: 'Vault'/)
  assert.match(source('MemberShelfPicker.tsx'),/books:'Bookshelf',music:'Catalogue',movies:'Vault'/)
})

test('adding stays in the context-sensitive top bar, not duplicate page controls',()=>{
  for(const file of ['BookClub.tsx','MusicMode.tsx','MovieMode.tsx']){
    assert.doesNotMatch(source(file),/onOpenAdd|book-library-actions|music-page-actions/)
    assert.match(source(file),/showAdd &&|showAdd&&/)
  }
  const app=source('App.tsx')
  assert.match(app,/mode === 'games' \? openAddGame\(\) : mode === 'movies' \? setShowAddMovie\(true\) : mode === 'music' \? setShowAddMusic\(true\) : setShowAddBook\(true\)/)
  assert.match(app,/aria-label=\{mode === 'games' \? 'Add game' : mode === 'movies' \? 'Add movie' : mode === 'music' \? 'Add music' : 'Add book'\}/)
})

test('all four home headers share alignment without a book-only offset',()=>{
  const css=source('App.css')
  assert.doesNotMatch(css,/book-page-title|book-library-actions/)
  assert.doesNotMatch(css,/\.book-club-page\s*\{[^}]*max-width/)
  assert.match(css,/\.dashboard-page > \.page-title-row,\.book-club-page > \.page-title-row,\.music-page > \.page-title-row,\.movie-page > \.page-title-row \{ min-height: 0; align-items: flex-start; \}/)
})
