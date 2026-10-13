import test from 'node:test'
import assert from 'node:assert/strict'
import {emptyFavorites, readFavorites, setPersonalFavorite} from '../src/lib/personalFavorites.ts'
import {makeMovie, moviesOnShelf} from '../src/lib/movies.ts'

test('favorites are independent, immutable, reversible and deduplicated', () => {
  const original = {games:['game'], books:['book'], movies:[]}
  const added = setPersonalFavorite(original,'movies','movie',true)
  assert.deepEqual(original,{games:['game'], books:['book'], movies:[]})
  assert.deepEqual(setPersonalFavorite(added,'movies','movie',true),added)
  assert.deepEqual(setPersonalFavorite(added,'movies','movie',false),original)
  assert.deepEqual(readFavorites({games:['game','game',42],books:null}),{games:['game'],books:[],movies:[]})
  assert.deepEqual(readFavorites(undefined),emptyFavorites())
  assert.throws(()=>setPersonalFavorite(original,'books','',true))
  assert.throws(()=>setPersonalFavorite({...original,games:Array.from({length:2000},(_,i)=>String(i))},'games','overflow',true))
})

test('movie favorites use the selected member without changing seen or saved state', () => {
  const draft={year:'',posterUrl:'',description:''}
  const one=makeMovie('one',{...draft,title:'One'},'owner'),two=makeMovie('two',{...draft,title:'Two'},'friend')
  const items=[one,two], before=JSON.stringify(items)
  assert.deepEqual(moviesOnShelf(items,'owner','favorites',['two']).map(item=>item.id),['two'])
  assert.deepEqual(moviesOnShelf(items,'friend','favorites',['one']).map(item=>item.id),['one'])
  assert.deepEqual(moviesOnShelf(items,'owner','favorites'),[])
  assert.equal(JSON.stringify(items),before)
})
