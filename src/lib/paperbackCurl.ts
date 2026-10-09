export const CURL_WIDTH = 220
export const CURL_HEIGHT = 328
export const CURL_PADDING = 32
export const CURL_DURATION = 2100
export const CURL_PAGE_COUNT = 20

// Roll the entire outer 40% around a cylinder, including both right corners.
export function curlVertex(u: number, v: number, amount: number, layer = 0) {
  let x = u * CURL_WIDTH, z = 0, angle = 0
  const span = 88, distance = x - (CURL_WIDTH - span)
  if (distance > 0 && amount > .0001) {
    const radius = span / ((2.48 + .25 * Math.sin(Math.PI * v)) * amount)
    angle = distance / radius
    x += radius * Math.sin(angle) - distance
    z = radius * (1 - Math.cos(angle))
  }
  return { x: x - z * .28 + layer * .23, y: v * CURL_HEIGHT - z * .29 + layer * .17, z, angle, u, v }
}
export function curlPulse(t: number, a: number, b: number, c: number, d: number) {
  const smooth = (value: number) => { const x = Math.max(0, Math.min(1, value)); return x * x * (3 - 2 * x) }
  return t < a || t > d ? 0 : t < b ? smooth((t - a) / (b - a)) : t < c ? 1 : 1 - smooth((t - c) / (d - c))
}
type Vertex = ReturnType<typeof curlVertex>

// Draw the already-loaded cover; no extra fetch or CORS-dependent pixel readback.
export function createPaperbackCurl(canvas: HTMLCanvasElement, image: HTMLImageElement, width: number, height: number) {
  const context = canvas.getContext('2d')
  if (!context || !image.complete || !image.naturalWidth || width <= 0 || height <= 0) return null
  const ctx = context, dpr = Math.min(3, window.devicePixelRatio || 1)
  canvas.width = Math.ceil(width * (1 + 2 * CURL_PADDING / CURL_WIDTH) * dpr)
  canvas.height = Math.ceil(height * (1 + 2 * CURL_PADDING / CURL_HEIGHT) * dpr)
  const texture = document.createElement('canvas')
  texture.width = Math.ceil(width * dpr); texture.height = Math.ceil(height * dpr)
  const tc = texture.getContext('2d')
  if (!tc) return null
  const scale = Math.max(texture.width / image.naturalWidth, texture.height / image.naturalHeight)
  tc.drawImage(image, (texture.width - image.naturalWidth * scale) / 2, (texture.height - image.naturalHeight * scale) / 2, image.naturalWidth * scale, image.naturalHeight * scale)
  const spine = tc.createLinearGradient(0, 0, texture.width * .08, 0)
  spine.addColorStop(0, '#0006'); spine.addColorStop(.5, '#0000'); spine.addColorStop(.625, '#fff3'); spine.addColorStop(1, '#0000')
  tc.fillStyle = spine; tc.fillRect(0, 0, texture.width * .08, texture.height)
  tc.strokeStyle = '#e8dac15c'; tc.lineWidth = Math.max(1, dpr); tc.strokeRect(0, 0, texture.width, texture.height)
  function path(points: Vertex[]) {
    ctx.beginPath()
    points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))
    ctx.closePath()
  }
  function expand(points: Vertex[]) {
    const x = points.reduce((s, p) => s + p.x, 0) / points.length, y = points.reduce((s, p) => s + p.y, 0) / points.length
    return points.map(p => { const d = Math.hypot(p.x - x, p.y - y) || 1; return { ...p, x: p.x + (p.x - x) / d * .28, y: p.y + (p.y - y) / d * .28 } })
  }
  function triangle(points: Vertex[]) {
    const [a, b, c] = points.map(p => [p.u * texture.width, p.v * texture.height])
    const det = a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])
    const transform = (q: number[]) => [
      (q[0] * (b[1] - c[1]) + q[1] * (c[1] - a[1]) + q[2] * (a[1] - b[1])) / det,
      (q[0] * (c[0] - b[0]) + q[1] * (a[0] - c[0]) + q[2] * (b[0] - a[0])) / det,
      (q[0] * (b[0] * c[1] - c[0] * b[1]) + q[1] * (c[0] * a[1] - a[0] * c[1]) + q[2] * (a[0] * b[1] - b[0] * a[1])) / det,
    ]
    const x = transform(points.map(p => p.x)), y = transform(points.map(p => p.y))
    ctx.save(); path(expand(points)); ctx.clip()
    ctx.transform(x[0], y[0], x[1], y[1], x[2], y[2]); ctx.drawImage(texture, 0, 0); ctx.restore()
  }
  function sheet(amount: number, layer: number, cover = false) {
    const cols = cover ? 32 : 12, rows = cover ? 16 : 8, cells = []
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const p = [curlVertex(x / cols, y / rows, amount, layer), curlVertex((x + 1) / cols, y / rows, amount, layer), curlVertex((x + 1) / cols, (y + 1) / rows, amount, layer), curlVertex(x / cols, (y + 1) / rows, amount, layer)]
      cells.push({ p, z: p.reduce((s, a) => s + a.z, 0) / 4, angle: p.reduce((s, a) => s + a.angle, 0) / 4 })
    }
    cells.sort((a, b) => a.z - b.z)
    for (const { p, angle } of cells) {
      const front = (p[1].x - p[0].x) * (p[3].y - p[0].y) - (p[1].y - p[0].y) * (p[3].x - p[0].x) > 0
      if (cover && front) { triangle([p[0], p[1], p[2]]); triangle([p[0], p[2], p[3]]) }
      else {
        const light = Math.round(cover ? 222 + 13 * Math.sin(angle) : 210 + 19 * Math.cos(angle * .65))
        path(expand(p)); ctx.fillStyle = 'rgb(' + light + ',' + (light - 9) + ',' + (light - 27) + ')'; ctx.fill()
      }
    }
    if (!cover) {
      ctx.beginPath()
      for (let i = 0; i <= 40; i++) { const p = curlVertex(1, i / 40, amount, layer); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y) }
      for (let i = 39; i >= 0; i--) { const p = curlVertex(i / 40, 1, amount, layer); ctx.lineTo(p.x, p.y) }
      ctx.lineWidth = .4; ctx.strokeStyle = 'rgba(116,102,77,.4)'; ctx.stroke()
    }
  }
  return (elapsed: number) => {
    ctx.setTransform(canvas.width / (CURL_WIDTH + 2 * CURL_PADDING), 0, 0, canvas.height / (CURL_HEIGHT + 2 * CURL_PADDING), 0, 0)
    ctx.clearRect(0, 0, CURL_WIDTH + 2 * CURL_PADDING, CURL_HEIGHT + 2 * CURL_PADDING)
    ctx.translate(CURL_PADDING, CURL_PADDING)
    ctx.fillStyle = '#e7ddc5'; ctx.fillRect(0, 0, CURL_WIDTH, CURL_HEIGHT)
    const t = elapsed / 1000
    for (let i = CURL_PAGE_COUNT; i >= 1; i--) {
      const stagger = (CURL_PAGE_COUNT - i) * .025
      sheet(curlPulse(t, .1 + stagger * .4, .43 + stagger * .3, .65 + stagger, 1.19 + stagger) * (.69 + (CURL_PAGE_COUNT - i) * .011), i)
    }
    sheet(curlPulse(t, 0, .42, 1.18, 2.05), 0, true)
  }
}
