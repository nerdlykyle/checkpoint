// Public catalog metadata only. Never accepts an arbitrary fetch destination.
const MBID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const cache = new Map()
let lastRequest = 0
let pending = Promise.resolve()
function mb(path) {
  const next = pending.then(() => loadMusicBrainz(path))
  pending = next.catch(() => {})
  return next
}
async function loadMusicBrainz(path) {
  const saved=cache.get(path)
  if(saved && saved.until>Date.now()) return saved.data
  const delay=Math.max(0,1100-(Date.now()-lastRequest))
  if(delay) await new Promise(resolve=>setTimeout(resolve,delay))
  lastRequest=Date.now()
  const response=await fetch(`https://musicbrainz.org/ws/2/${path}${path.includes('?')?'&':'?'}fmt=json`,{headers:{'User-Agent':'CheckpointMusic/1.0 (https://nerdlykyle.github.io/checkpoint/)','Accept':'application/json'},signal:AbortSignal.timeout(12000),cf:{cacheTtl:900,cacheEverything:true}})
  if(!response.ok) throw new Error('Music catalog is busy. Try again shortly or add the music manually.')
  const data=await response.json()
  if(cache.size>=128) cache.delete(cache.keys().next().value)
  cache.set(path,{data,until:Date.now()+15*60*1000});return data
}
function credits(value) {return (value||[]).filter(item=>typeof item==='object').map(item=>item.artist?.name||item.name).filter(Boolean)}
function links(relations=[]) {
  const result={}
  for(const relation of relations) {
    const value=relation.url?.resource
    if(!value) continue
    const parsed=parseMusicLink(value)
    if(parsed?.service==='spotify') result.spotify=parsed.url
    if(parsed?.service==='youtube') result.youtube=parsed.url
  }
  return result
}
function parseMusicLink(value) {
  try {
    const url=new URL(value)
    if(url.protocol!=='https:' || url.username || url.password) return null
    if(url.hostname==='open.spotify.com') {
      const match=url.pathname.match(/^\/(?:intl-[a-z]+\/)?(album|track)\/([A-Za-z0-9]{22})\/?$/)
      return match?{service:'spotify',kind:match[1]==='track'?'song':'album',url:`https://open.spotify.com/${match[1]}/${match[2]}`}:null
    }
    if(['music.youtube.com','www.youtube.com','youtube.com','youtu.be'].includes(url.hostname)) {
      const video=url.hostname==='youtu.be'?url.pathname.slice(1):url.pathname==='/watch'?url.searchParams.get('v'):null
      if(video && /^[\w-]{11}$/.test(video)) return {service:'youtube',kind:'song',url:`https://music.youtube.com/watch?v=${video}`,video}
      const list=url.pathname==='/playlist'?url.searchParams.get('list'):null
      if(list && /^[\w-]{10,200}$/.test(list)) return {service:'youtube',kind:'album',url:`https://music.youtube.com/playlist?list=${list}`}
    }
  }catch { /* Unsupported URL. */ }
  return null
}
function catalogItem(item,kind) {
  return {id:`mb-${kind==='song'?'recording':'release-group'}-${item.id}`,mbid:item.id,kind:kind==='song'?'song':item['primary-type']==='EP'?'ep':'album',title:item.title,artists:credits(item['artist-credit']),artistIds:(item['artist-credit']||[]).map(credit=>credit.artist?.id).filter(Boolean),year:(item['first-release-date']||'').slice(0,4),description:'',genres:(item.genres||item.tags||[]).slice(0,12).map(tag=>tag.name),tracks:[],links:links(item.relations),...(kind==='song'?{}:{coverUrl:`https://coverartarchive.org/release-group/${item.id}/front-250`})}
}
async function musicCatalog(query) {
  const action=String(query.action||'search')
  if(action==='artist-search') {
    const text=String(query.q||'').trim().slice(0,180).replace(/[+\-!(){}[\]^"~*?:\\/|&]/g,' ')
    if(text.trim().length<2)return {items:[]}
    const data=await mb(`artist?query=${encodeURIComponent(text)}&limit=20`)
    return {items:(data.artists||[]).map(artist=>({id:artist.id,name:artist.name,description:[artist.disambiguation,artist.type,artist.country].filter(Boolean).join(' · ')}))}
  }
  if(action==='artist-detail')return artistDetail(String(query.id||''),query.refresh==='1')
  if(action==='resolve') {
    const parsed=parseMusicLink(String(query.url||''))
    if(!parsed) throw new Error('Use a Spotify album/track or YouTube Music watch/playlist link. Shortened links can be added as custom links after adding the title.')
    let title='',art='',artist=''
    const endpoint=parsed.service==='spotify'?`https://open.spotify.com/oembed?url=${encodeURIComponent(parsed.url)}`:parsed.video?`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${parsed.video}`)}&format=json`:null
    if(endpoint) {
      try {const response=await fetch(endpoint,{signal:AbortSignal.timeout(10000)});if(response.ok){const data=await response.json();title=String(data.title||'').slice(0,250);art=String(data.thumbnail_url||'');artist=parsed.service==='youtube'?String(data.author_name||'').replace(/ - Topic$/,''):''}}catch { /* Keep the supplied link; manual metadata is available. */ }
    }
    return {kind:parsed.kind,title,artists:artist?[artist]:[],coverUrl:art,links:{[parsed.service]:parsed.url},needsConfirmation:true}
  }
  const kind=query.kind==='song'?'song':'album'
  if(action==='detail') {
    const id=String(query.id||'')
    if(!MBID.test(id)) throw new Error('Invalid music catalog ID.')
    if(kind==='song') return catalogItem(await mb(`recording/${id}?inc=artist-credits+genres+url-rels`),'song')
    const group=await mb(`release-group/${id}?inc=artist-credits+genres+url-rels+releases`)
    const result=catalogItem(group,'album')
    const edition=(group.releases||[]).find(release=>release.status==='Official') || group.releases?.[0]
    if(edition?.id && MBID.test(edition.id)) {
      const release=await mb(`release/${edition.id}?inc=recordings+artist-credits+url-rels`)
      result.releaseId=edition.id
      result.tracks=(release.media||[]).flatMap((medium,disc)=>(medium.tracks||[]).map((track,index)=>({id:track.recording?.id||track.id,title:track.title||track.recording?.title||'Untitled',number:`${disc+1}.${index+1}`,...(track.length?{duration:track.length}:{})}))).slice(0,150)
      result.links={...result.links,...links(release.relations)}
    }
    return result
  }
  if(action!=='search') throw new Error('Unknown catalog action.')
  const text=String(query.q||'').trim().slice(0,180)
  if(text.length<2) return {items:[]}
  // Escape Lucene syntax: user text is a search phrase, not a query program.
  const escaped=text.replace(/[+\-!(){}[\]^"~*?:\\/|&]/g,' ')
  const path=kind==='song'?'recording':'release-group'
  const data=await mb(`${path}?query=${encodeURIComponent(escaped+(kind==='song'?'':' AND (primarytype:album OR primarytype:ep)'))}&limit=20`)
  return {items:(data[kind==='song'?'recordings':'release-groups']||[]).map(item=>catalogItem(item,kind))}
}
export {musicCatalog,parseMusicLink,catalogItem}

const artistCache=new Map()
function httpsUrl(value) {try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:''}catch{return ''}}
async function artistDetail(id,refresh=false) {
  if(!MBID.test(id))throw new Error('Invalid artist catalog ID.')
  const saved=artistCache.get(id)
  if(!refresh&&saved&&saved.until>Date.now())return saved.value
  const artist=await mb(`artist/${id}?inc=url-rels`)
  const result={id,name:artist.name,description:[artist.disambiguation,artist.type,artist.country].filter(Boolean).join(' · '),imageUrl:'',imageSource:'',imageCredit:'',imageLicense:'',imageLicenseUrl:'',spotify:'',youtube:''}
  let wikidata=''
  for(const relation of artist.relations||[]) {
    try {
      const url=new URL(relation.url?.resource)
      if(url.username||url.password||!['http:','https:'].includes(url.protocol))continue
      if(url.hostname==='open.spotify.com'&&/^\/artist\/[A-Za-z0-9]{22}\/?$/.test(url.pathname))result.spotify=`https://open.spotify.com${url.pathname}`
      if(['www.youtube.com','youtube.com','music.youtube.com'].includes(url.hostname)&&/^\/channel\/UC[\w-]{22}\/?$/.test(url.pathname))result.youtube=`https://music.youtube.com${url.pathname}`
      if(['wikidata.org','www.wikidata.org'].includes(url.hostname)&&/^\/wiki\/Q\d+$/.test(url.pathname))wikidata=url.pathname.split('/').pop()
    }catch{ /* Ignore unsupported catalog relationships. */ }
  }
  if(wikidata)try {
    const response=await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${wikidata}.json`,{signal:AbortSignal.timeout(8000),headers:{'User-Agent':'CheckpointMusic/1.0 (https://nerdlykyle.github.io/checkpoint/)'},cf:{cacheTtl:86400}})
    if(response.ok) {
      const data=await response.json()
      const file=data.entities?.[wikidata]?.claims?.P18?.find(claim=>claim.rank!=='deprecated'&&typeof claim.mainsnak?.datavalue?.value==='string')?.mainsnak?.datavalue?.value
      if(file) {
        const params=new URLSearchParams({action:'query',format:'json',titles:`File:${file}`,prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'320'})
        const picture=await fetch(`https://commons.wikimedia.org/w/api.php?${params}`,{signal:AbortSignal.timeout(8000),headers:{'User-Agent':'CheckpointMusic/1.0 (https://nerdlykyle.github.io/checkpoint/)'},cf:{cacheTtl:86400}})
        if(picture.ok) {
          const page=Object.values((await picture.json()).query?.pages||{})[0]
          const info=page?.imageinfo?.[0],meta=info?.extmetadata||{}
          const clean=value=>String(value||'').replace(/<[^>]*>/g,'').slice(0,600)
          const image=httpsUrl(info?.thumburl||info?.url)
          if(image&&['upload.wikimedia.org','thumb.wikimedia.org'].includes(new URL(image).hostname)) {
            result.imageUrl=image;result.imageSource=`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`
            result.imageCredit=clean(meta.Artist?.value);result.imageLicense=clean(meta.LicenseShortName?.value)
            result.imageLicenseUrl=httpsUrl(meta.LicenseUrl?.value)
          }
        }
      }
    }
  }catch{ /* Missing photos never block adding an artist. */ }
  if(artistCache.size>=128)artistCache.delete(artistCache.keys().next().value)
  artistCache.set(id,{value:result,until:Date.now()+15*60000})
  return result
}
