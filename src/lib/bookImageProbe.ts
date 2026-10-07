export function probeBookCover(url: string, signal: AbortSignal): Promise<boolean> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const image = new Image()
    let settled = false
    const finish = (ok: boolean, aborted = false) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      image.onload = null; image.onerror = null
      if (!ok) image.src = ''
      if (aborted) reject(signal.reason)
      else resolve(ok)
    }
    const abort = () => finish(false, true)
    const timer = setTimeout(() => finish(false), 8000)
    image.referrerPolicy = 'no-referrer'
    image.onload = () => finish(image.naturalWidth > 1 && image.naturalHeight > 1)
    image.onerror = () => finish(false)
    signal.addEventListener('abort', abort, { once: true })
    image.src = url
  })
}
