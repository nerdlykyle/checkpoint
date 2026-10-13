// In-memory only: never uses production data or cloud writes.
import {useState, type ReactNode} from 'react'
import {PersonalFavoritesContext} from '../src/PersonalFavorites'
import {emptyFavorites,setPersonalFavorite,type PersonalFavorites} from '../src/lib/personalFavorites'
export default function FavoritesFixture({user,initial={},children}:{user:string;initial?:Record<string,PersonalFavorites>;children:ReactNode}) {
  const [members,setMembers]=useState(initial)
  return <PersonalFavoritesContext.Provider value={{user,members,ready:true,error:'',retry:()=>{},save:async(kind,id,active)=>setMembers(old=>({...old,[user]:setPersonalFavorite(old[user]||emptyFavorites(),kind,id,active)}))}}>{children}</PersonalFavoritesContext.Provider>
}
