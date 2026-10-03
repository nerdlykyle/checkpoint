// Local-only fixture; no account or production data is written.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArtistSection } from '../src/FavoriteArtists'
import { makeFavoriteArtist, type MusicArtist } from '../src/lib/musicArtists'
import type { musicRequest } from '../src/lib/musicSearch'
import '../src/index.css'
import '../src/App.css'
import '../src/MusicMode.css'
const artist={id:'b7ffd2af-418f-4be2-bdd1-22f8b48613da',name:'Nine Inch Nails',description:'Group · US',imageUrl:'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1c/NIN_Munich_2007.jpg/330px-NIN_Munich_2007.jpg',imageSource:'https://commons.wikimedia.org/wiki/File:NIN_Munich_2007.jpg',imageCredit:"Luca De Santis from Orzignano (PI), Italy (Author's website)",imageLicense:'CC BY 2.0',imageLicenseUrl:'https://creativecommons.org/licenses/by/2.0',spotify:'https://open.spotify.com/artist/0X380XXQSNBYuleKzav5UO',youtube:'https://music.youtube.com/channel/UC8txE2ZyN2Sh8XxH5OkHLSw'}
const request:typeof musicRequest=async<T,>(_board:string,params:Record<string,string>)=>(params.action==='artist-search'?{items:[artist]}:artist) as T
function Fixture(){
 const [items,setItems]=useState<MusicArtist[]>([makeFavoriteArtist({id:'fallback',name:'No Photo Artist'})]),[mine,setMine]=useState(true)
 return <main className="music-page" style={{padding:20,maxWidth:900,margin:'auto'}}><p>Isolated artist QA · no cloud writes</p><button onClick={()=>setMine(!mine)}>View {mine?'friend':'my'} collection</button><ArtistSection boardId="qa" title={mine?'Favorite artists':'Jern’s favorite artists'} mine={mine} request={request} store={{items,ready:true,error:'',retry:()=>{},save:async(data,active=true)=>{const saved=makeFavoriteArtist(data,active);setItems(old=>[...old.filter(item=>item.id!==saved.id),saved])}}}/></main>
}
createRoot(document.getElementById('root')!).render(<Fixture/> )
