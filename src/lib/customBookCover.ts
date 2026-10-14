export const MAX_COVER_FILE = 8 * 1024 * 1024
export const MAX_COVER_DATA = 180000
export type CustomBookCover = { kind: 'image' | 'catalog'; image: string; updatedAt: string }
export type CoverCrop = { zoom: number; x: number; y: number }

export function coverImportUrl(value: string) {
  const url = new URL(value.trim())
  const host = url.hostname.toLowerCase()
  // Browser-only, credentialless CORS imports. Never proxy arbitrary URLs on
  // the server or allow local-network targets, credentials or non-HTTPS URLs.
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.href.length > 2000 ||
    !host.includes('.') || /[[\]:]/.test(host) || /^[\d.]+$/.test(host) ||
    /(^|\.)(localhost|local|internal|test|invalid|lan|home|arpa)$/.test(host)) throw new Error('Use a public HTTPS image URL, without a login or custom port.')
  return url.href
}
export function catalogCoverUrl(value: string) {
  const url = new URL(coverImportUrl(value))
  if (!['books.google.com','books.googleusercontent.com','covers.openlibrary.org'].includes(url.hostname)) throw new Error('This is not a supported catalog cover.')
  return url.href
}
export function validCustomCover(value: unknown): value is CustomBookCover {
  if (!value || typeof value !== 'object') return false
  const cover = value as CustomBookCover
  if (typeof cover.updatedAt !== 'string' || cover.updatedAt.length > 40 || typeof cover.image !== 'string') return false
  if (cover.kind === 'image') return cover.image.length <= MAX_COVER_DATA && /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(cover.image)
  if (cover.kind === 'catalog') { try { return catalogCoverUrl(cover.image) === cover.image } catch { return false } }
  return false
}
export function coverCropRect(width: number, height: number, crop: CoverCrop) {
  if (![width,height,crop.zoom,crop.x,crop.y].every(Number.isFinite) || width <= 0 || height <= 0) throw new Error('Invalid image crop.')
  const zoom = Math.max(1,Math.min(3,crop.zoom))
  const w = Math.min(width,height * 2 / 3) / zoom, h = w * 1.5
  return {x:(width-w)*Math.max(0,Math.min(1,crop.x)),y:(height-h)*Math.max(0,Math.min(1,crop.y)),width:w,height:h}
}
export function coverFileType(bytes: Uint8Array) {
  if (bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return 'image/jpeg'
  if ([137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b)) return 'image/png'
  const ascii=(start:number,end:number)=>String.fromCharCode(...bytes.slice(start,end))
  if (ascii(0,4)==='RIFF' && ascii(8,12)==='WEBP') return 'image/webp'
  throw new Error('Choose a JPEG, PNG or WebP image. SVG, GIF and other files are not supported.')
}
export async function prepareCover(blob: Blob): Promise<ImageBitmap> {
  if (!blob.size || blob.size > MAX_COVER_FILE) throw new Error('Choose an image under 8 MB.')
  const type = coverFileType(new Uint8Array(await blob.slice(0,12).arrayBuffer()))
  const image = await createImageBitmap(new Blob([blob],{type}))
  if (image.width < 100 || image.height < 100 || image.width * image.height > 24_000_000) {
    image.close(); throw new Error('Use an image at least 100 × 100 pixels and no larger than 24 megapixels.')
  }
  return image
}
export function drawCover(canvas: HTMLCanvasElement, image: ImageBitmap, crop: CoverCrop) {
  canvas.width=512; canvas.height=768
  const context=canvas.getContext('2d')!
  const rect=coverCropRect(image.width,image.height,crop)
  context.fillStyle='#fff';context.fillRect(0,0,512,768)
  context.drawImage(image,rect.x,rect.y,rect.width,rect.height,0,0,512,768)
}
export function encodeCover(canvas: HTMLCanvasElement) {
  // Re-encoding to JPEG strips EXIF/GPS and avoids storing original files.
  for (const quality of [.9,.82,.74,.66,.58,.5]) {
    const image=canvas.toDataURL('image/jpeg',quality)
    if (image.length <= MAX_COVER_DATA) return image
  }
  throw new Error('This image is too detailed to fit. Try a smaller or simpler cover.')
}
export async function importCover(value: string, signal: AbortSignal) {
  const url=coverImportUrl(value)
  const response=await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(12000)]),mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error'})
  if (!response.ok || !response.body || Number(response.headers.get('Content-Length')) > MAX_COVER_FILE || !/^image\/(jpeg|png|webp)(;|$)/i.test(response.headers.get('Content-Type') || '')) throw new Error('The URL must point directly to a JPEG, PNG or WebP image under 8 MB.')
  const reader=response.body.getReader(),chunks:Uint8Array<ArrayBuffer>[]= [];let size=0
  for (;;) {
    const {done,value:chunk}=await reader.read();if(done) break
    size+=chunk.byteLength
    if (size>MAX_COVER_FILE) {await reader.cancel();throw new Error('Choose an image under 8 MB.')}
    chunks.push(new Uint8Array(chunk))
  }
  return prepareCover(new Blob(chunks))
}
