import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

test('music resubscription receives cache-to-server metadata and releases both listeners', async () => {
  const source=readFileSync(new URL('../src/lib/musicStore.ts',import.meta.url),'utf8')
  const statuses=[], listeners=[]; let stopCount=0
  const hooks={ useRef:value=>({current:value}),useState:value=>[value,next=>{if(typeof next==='string')statuses.push(next)}],useEffect:effect=>{hooks.cleanup=effect()} }
  const firestore={collection:()=>({type:'collection'}),doc:()=>({type:'doc'}),onSnapshot:(ref,options,callback)=>{
    if(ref.type==='collection') listeners.push({options,callback})
    return ()=>stopCount++
  },runTransaction:()=>{},setDoc:()=>{}}
  let code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
  code=code.replace(/^import .* from .*;$/gm,'').replace('export function useMusicStore','function useMusicStore')
  const build=new Function('hooks','firestore',`const {useEffect,useRef,useState}=hooks; const {collection,doc,onSnapshot,runTransaction,setDoc}=firestore; const firebaseConfigured=true,database={},auth={currentUser:{uid:'reader'}}; ${code}; return useMusicStore;`)
  const store=build(hooks,firestore)
  for(let mount=0;mount<2;mount++){
    store('board','reader',true)
    const listener=listeners.at(-1)
    assert.equal(listener.options.includeMetadataChanges,true)
    listener.callback({docs:[],metadata:{fromCache:true}})
    listener.callback({docs:[],metadata:{fromCache:false}})
    assert.deepEqual(statuses.slice(-4).filter(s=>s.startsWith('Music')),['Music cached · reconnecting…','Music shared live'])
    hooks.cleanup()
  }
  assert.equal(stopCount,4)
})
