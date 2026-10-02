import test from 'node:test'
import assert from 'node:assert/strict'
import { findBookEdition, sameBookWork, saveBookEdition } from '../src/lib/bookEditions.ts'
import { lookupBookMetadata } from '../src/lib/bookSearch.ts'

const result = { catalogId:'google:print',source:'google-books',googleBooksId:'print',title:'Off to Be the Wizard',authors:['Scott Meyer'],description:'Print edition',coverUrl:'https://example.test/print.jpg',isbn13:'9780000000001' }
const original = () => ({ ...result,id:'old',googleBooksId:'audio',coverUrl:'https://example.test/audio.jpg',addedBy:'nern',createdAt:'2026-01-01',shelves:{nern:'reading',jern:'read'},progress:{nern:{lastChapter:12},jern:{lastChapter:30}},ratings:{nern:{stars:4,review:'Fun!'}},readerOrganization:{nern:{order:2,tags:['Magic']}},comments:[{text:'Keep discussion'}],club:{status:'reading'},upvotes:[],downvotes:[] })

test('selected catalog identity outranks title, author and even shared ISBN', () => {
  assert.equal(findBookEdition([original()],result),undefined)
  assert.equal(sameBookWork(original(),result),true)
  assert.equal(sameBookWork(original(),{...result,authors:['Someone Else']}),false)
})
test('remove then re-add another edition keeps the selected cover and personal history', () => {
  const old=original();delete old.shelves.nern
  const before=structuredClone(old)
  const saved=saveBookEdition([old],result,'nern','to-read')
  const added=saved.books.find(book=>book.id===saved.id)
  assert.equal(added.googleBooksId,'print');assert.equal(added.coverUrl,result.coverUrl)
  assert.deepEqual(added.progress.nern,old.progress.nern)
  assert.deepEqual(added.ratings.nern,old.ratings.nern)
  assert.deepEqual(added.readerOrganization.nern.tags,['Magic'])
  assert.equal(added.privateNoteIds.nern,'old')
  assert.equal(added.progress.jern,undefined)
  assert.deepEqual(saved.books.find(book=>book.id==='old'),before)
  assert.deepEqual(old,before)
})
test('Change book keeps other readers and club data intact, and repeat selection is idempotent', () => {
  const old=original(), saved=saveBookEdition([old],result,'nern','reading','old')
  const retained=saved.books.find(book=>book.id==='old')
  assert.equal(retained.shelves.nern,undefined);assert.equal(retained.shelves.jern,'read')
  assert.deepEqual(retained.comments,old.comments);assert.deepEqual(retained.club,old.club)
  const again=saveBookEdition(saved.books,result,'nern','reading')
  assert.equal(again.books.length,2);assert.equal(again.id,saved.id)
  assert.equal(again.books.find(book=>book.id===saved.id).privateNoteIds.nern,'old')
})
test('an existing exact edition is reused without overwriting its reader history', () => {
  const target={...original(),...result,id:'print-id',progress:{nern:{lastChapter:25}},privateNoteIds:{nern:'private-original'}}
  const saved=saveBookEdition([original(),target],result,'nern','read','old')
  assert.equal(saved.books.length,2);assert.equal(saved.id,'print-id')
  assert.equal(saved.books.find(book=>book.id==='print-id').progress.nern.lastChapter,25)
  assert.equal(saved.books.find(book=>book.id==='print-id').privateNoteIds.nern,'private-original')
})
test('same title by another author does not transfer personal data', () => {
  const saved=saveBookEdition([original()],{...result,authors:['Other Author']},'nern','to-read')
  assert.deepEqual(saved.books.find(book=>book.id===saved.id).progress,{})
  assert.equal(saved.books.find(book=>book.id==='old').shelves.nern,'reading')
})
test('switching to another reader’s edition preserves the original private-note key through later switches', () => {
  const old=original()
  const other={...original(),...result,id:'jern-print',addedBy:'jern',shelves:{jern:'read'},progress:{jern:{lastChapter:30}},ratings:{},readerOrganization:{}}
  const saved=saveBookEdition([old,other],result,'nern','reading','old')
  const selected=saved.books.find(book=>book.id===saved.id)
  assert.equal(selected.privateNoteIds.nern,'old')
  assert.equal(selected.shelves.jern,'read')
  const third=saveBookEdition(saved.books,{...result,googleBooksId:'third'},'nern','reading',saved.id)
  assert.equal(third.books.find(book=>book.id===third.id).privateNoteIds.nern,'old')
})
test('manual ISBNs and Open Library keys only reuse the exact selected record', () => {
  const old=original()
  assert.equal(findBookEdition([old],{...result,googleBooksId:undefined}),old)
  assert.equal(findBookEdition([old],{...result,googleBooksId:undefined,openLibraryKey:'/works/OL123W'}),undefined)
  assert.equal(findBookEdition([old],{...result,googleBooksId:undefined,isbn13:undefined}),undefined)
})
test('series can come from a verified sibling edition without replacing selected cover', async () => {
  const calls=[]
  const realFetch=globalThis.fetch
  globalThis.fetch=async url=>{
    calls.push(String(url))
    if(String(url).includes('googleapis'))return Response.json({items:[{id:'print',volumeInfo:{title:result.title,authors:result.authors}}]})
    if(String(url).includes('/isbn/'))return Response.json({title:result.title})
    if(String(url).includes('/search.json'))return Response.json({docs:[{key:'/works/OL123W',title:result.title,author_name:result.authors}]})
    return Response.json({entries:[{title:result.title},{title:result.title,series:['Magic 2.0']}]})
  }
  try {
    const metadata=await lookupBookMetadata(original())
    assert.deepEqual(metadata.series,{name:'Magic 2.0'})
    assert.equal(metadata.coverUrl,undefined)
    assert.ok(calls.some(url=>url.includes('/works/OL123W/editions.json?limit=10')))
  }finally{globalThis.fetch=realFetch}
})
test('series lookup rejects a title match by a different author', async () => {
  const realFetch=globalThis.fetch
  globalThis.fetch=async url=>{
    if(String(url).includes('googleapis'))return Response.json({items:[{id:'print',volumeInfo:{title:result.title,authors:result.authors}}]})
    if(String(url).includes('/isbn/'))return Response.json({title:result.title})
    if(String(url).includes('/search.json'))return Response.json({docs:[{key:'/works/OL123W',title:result.title,author_name:['Other Author']}]})
    throw Error('Should never fetch unrelated editions')
  }
  try {assert.equal((await lookupBookMetadata(original())).series,undefined)}finally{globalThis.fetch=realFetch}
})
