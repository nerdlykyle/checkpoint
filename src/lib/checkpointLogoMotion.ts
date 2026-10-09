/**
 * Checkpoint logo motion. 12fps, procedural, no dependencies.
 *
 * Intro: the purple shape unfolds from its sharp bottom-left corner, the flag
 * swings in from the left, winds up and gets planted, then the cloth ripples forever.
 * replay(): the flag gets yanked out, the purple folds back into its corner,
 * then the intro plays again. The purple shape is the flag's matte throughout.
 *
 * Coordinates match checkpoint_logo.svg: viewBox -1 -1 35 35, the mark rotated
 * -2deg, flag drawn in Lucide's 24-unit space at translate(6 6) scale(0.875).
 */

const FPS = 12
const CYCLE = 12 // frames per wave (1s)
const PURPLE = '#7869e8'
const LOOP_AMP = 1.3 // wave height, flag units
const WAVES = 0.9 // waves along the cloth
const POLE_X = 4
const BASE_Y = 22
const TOP_Y = 3.2
const CLOTH_H = 12
const CLOTH_L = 16
const MID = TOP_Y + CLOTH_H / 2
const RADII = [11, 11, 11, 4] // top-left, top-right, bottom-right, bottom-left
const TAU = Math.PI * 2

export const STATIC_BG = 'M11 0H22A11 11 0 0 1 33 11V22A11 11 0 0 1 22 33H4A4 4 0 0 1 0 29V11A11 11 0 0 1 11 0Z'
export const STATIC_FLAG = 'M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528'

type Box = { x0: number; y0: number; x1: number; y1: number }
type Pt = [number, number]
/** dx/dy offset (flag units), rot degrees about the pole base, sx/sy smear about the base (or pole top),
 *  droop sags the tip (+ is down), amp scales the wave. */
type Pose = { dx?: number; dy?: number; rot?: number; sx?: number; sy?: number; top?: boolean; droop?: number; amp?: number }
export type Phase = 'intro' | 'loop' | 'outro'
export type Drawing = { bg: string; cloth: string; pole: string; marks: string }

const REST: Box = { x0: 0, y0: 0, x1: 33, y1: 33 }

/* ---------- timeline, one entry per 12fps frame ---------- */

// purple [width, height], growing out of the bottom-left corner
const UNFOLD: Pt[] = [[0, 0], [6, 5], [17, 11], [30, 22], [35, 31], [32.2, 35], [33.4, 32.4], [32.9, 33.3], [33, 33]]
const FOLD_FROM = 4 // the fold-away replays the unfold backwards from this frame
const unfoldBox = ([w, h]: Pt): Box => ({ x0: 0, x1: w, y0: 33 - h, y1: 33 })

// flag swings in from the left, cocks back, drives down and plants, wobbles, settles into the loop
const PLANT: Pose[] = [
  { dx: -11, dy: -3, rot: -34, droop: 1.2, amp: 0.4 },
  { dx: -4, dy: -2.6, rot: -29, droop: 1.4, amp: 0.4 },
  { dx: 1, dy: -2.2, rot: -22, droop: 1.6, amp: 0.45 },
  { dx: 2, dy: -2.6, rot: -26, droop: 1.8, amp: 0.45 }, // wind up
  { dx: 2, dy: -2.8, rot: -27, droop: 1.9, amp: 0.5 }, // hold
  { dx: 0.8, dy: -1, rot: -8, sy: 1.12, droop: -2, amp: 0.4 }, // thrust
  { dy: 0.9, rot: 9, sy: 0.9, sx: 1.05, droop: 2.6, amp: 0.5 }, // impact
  { dy: -0.3, rot: -6, droop: 3.2, amp: 0.7 },
  { rot: 3.5, droop: 1.2, amp: 0.95 },
  { rot: -1.8, droop: -1, amp: 1.18 },
  { rot: 0.8, droop: -0.8, amp: 1.22 },
  { rot: -0.3, droop: 0.2, amp: 1.12 },
  { droop: 0.3, amp: 1.05 },
  { amp: 1 },
]
const IMPACT = 6
const IMPACT_SQUASH: Pt[] = [[1.025, 0.94], [0.99, 1.02]]

// tap: flag dips, gets yanked up and out through the top edge, then the purple folds away
const YANK: Pose[] = [
  { dy: 0.8, rot: 4, sy: 0.92, sx: 1.03, droop: 0.4 },
  { dy: -9, rot: -7, sy: 1.35, sx: 0.95, top: true, droop: 2.4 },
  { dy: -21, rot: -11, sy: 1.5, sx: 0.92, top: true, droop: 3 },
]
const YANK_SQUASH: Pt = [1.02, 0.96]

const FLAG_START = UNFOLD.length - 1 // flag waits until the purple has landed
export const TIMING = {
  fps: FPS,
  cycle: CYCLE,
  flagStart: FLAG_START,
  impactAt: FLAG_START + IMPACT,
  introLen: FLAG_START + PLANT.length,
  outroLen: YANK.length + FOLD_FROM,
} as const

/* ---------- geometry ---------- */

const r2 = (n: number) => Math.round(n * 100) / 100

function squash(b: Box, [mx, my]: Pt): Box {
  const cx = (b.x0 + b.x1) / 2
  const w = (b.x1 - b.x0) * mx
  const h = (b.y1 - b.y0) * my
  return { x0: cx - w / 2, x1: cx + w / 2, y0: b.y1 - h, y1: b.y1 }
}

function bgPath(b: Box): string {
  const w = b.x1 - b.x0
  const h = b.y1 - b.y0
  if (w < 0.05 || h < 0.05) return ''
  const m = Math.min(w, h) / 2
  const [tl, tr, br, bl] = RADII.map((r) => Math.min(r, m))
  const { x0, y0, x1, y1 } = b
  return `M${r2(x0 + tl)} ${r2(y0)}H${r2(x1 - tr)}A${r2(tr)} ${r2(tr)} 0 0 1 ${r2(x1)} ${r2(y0 + tr)}`
    + `V${r2(y1 - br)}A${r2(br)} ${r2(br)} 0 0 1 ${r2(x1 - br)} ${r2(y1)}`
    + `H${r2(x0 + bl)}A${r2(bl)} ${r2(bl)} 0 0 1 ${r2(x0)} ${r2(y1 - bl)}`
    + `V${r2(y0 + tl)}A${r2(tl)} ${r2(tl)} 0 0 1 ${r2(x0 + tl)} ${r2(y0)}Z`
}

// Catmull-Rom through the points, as cubic segments (no leading M)
function spline(pts: Pt[]): string {
  const n = pts.length
  const g = (i: number) => pts[Math.max(0, Math.min(n - 1, i))]
  let d = ''
  for (let i = 0; i < n - 1; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2)
    d += `C${r2(p1[0] + (p2[0] - p0[0]) / 6)} ${r2(p1[1] + (p2[1] - p0[1]) / 6)} `
      + `${r2(p2[0] - (p3[0] - p1[0]) / 6)} ${r2(p2[1] - (p3[1] - p1[1]) / 6)} ${r2(p2[0])} ${r2(p2[1])}`
  }
  return d
}

function place(p: Pt, t: Pose): Pt {
  const ay = t.top ? TOP_Y - BASE_Y : 0
  const x = (p[0] - POLE_X) * (t.sx ?? 1)
  const y = ay + (p[1] - BASE_Y - ay) * (t.sy ?? 1)
  const a = ((t.rot ?? 0) * Math.PI) / 180
  const c = Math.cos(a), s = Math.sin(a)
  return [POLE_X + x * c - y * s + (t.dx ?? 0), BASE_Y + x * s + y * c + (t.dy ?? 0)]
}

function flagPaths(t: Pose, tau: number): { cloth: string; pole: string } {
  const N = 14
  const amp = LOOP_AMP * (t.amp ?? 1)
  const droop = t.droop ?? 0
  const top: Pt[] = []
  const bot: Pt[] = []
  for (let i = 0; i <= N; i++) {
    const u = i / N
    const ph = TAU * (WAVES * u - tau)
    const env = Math.pow(u, 0.85)
    const dy = amp * env * Math.sin(ph) + 0.16 * amp * u * u * Math.sin(2 * ph + 0.7) + droop * u * u
    const x = POLE_X + CLOTH_L * u * (1 - 0.012 * droop * droop * u) - 0.7 * amp * Math.pow(u, 1.5) * (0.5 + 0.5 * Math.cos(ph))
    const h = CLOTH_H * (1 - 0.07 * amp * env * Math.cos(ph + 0.6))
    const shear = 0.35 * amp * u * Math.sin(ph + 1.2)
    top.push(place([x - shear / 2, MID - h / 2 + dy], t))
    bot.push(place([x + shear / 2, MID + h / 2 + dy], t))
  }
  bot.reverse()
  const base = place([POLE_X, BASE_Y], t)
  return {
    cloth: `M${r2(top[0][0])} ${r2(top[0][1])}${spline(top)}L${r2(bot[0][0])} ${r2(bot[0][1])}${spline(bot)}Z`,
    pole: `M${r2(base[0])} ${r2(base[1])}L${r2(top[0][0])} ${r2(top[0][1])}`,
  }
}

// little "thunk" marks either side of the pole base, logo units
function marks(stage: number): string {
  const bx = 9.5, by = 25.3
  const set = stage === 0
    ? [[-2.4, -0.6, -4.2, -2.1], [2.4, -0.6, 4.2, -2.1], [-2.6, 0.5, -4.6, 0.7], [2.6, 0.5, 4.6, 0.7]]
    : [[-4.0, -1.6, -5.1, -2.6], [4.0, -1.6, 5.1, -2.6], [-4.4, 0.7, -5.6, 0.8], [4.4, 0.7, 5.6, 0.8]]
  return set.map(([a, b, c, d]) => `M${r2(bx + a)} ${r2(by + b)}L${r2(bx + c)} ${r2(by + d)}`).join('')
}

/** The drawing for frame k of a phase. wf counts frames since the flag hit the ground. */
export function frameAt(phase: Phase, k: number, wf: number): Drawing {
  let bg: Box = REST
  let pose: Pose | null = {}
  let mark = -1
  if (phase === 'intro') {
    bg = k < UNFOLD.length ? unfoldBox(UNFOLD[k]) : REST
    const si = k - TIMING.impactAt
    if (si >= 0 && si < IMPACT_SQUASH.length) bg = squash(bg, IMPACT_SQUASH[si])
    pose = k >= FLAG_START ? PLANT[k - FLAG_START] : null
    if (si === 0 || si === 1) mark = si
  } else if (phase === 'outro') {
    if (k < YANK.length) {
      pose = YANK[k]
      if (k === 0) bg = squash(REST, YANK_SQUASH)
    } else {
      pose = null
      bg = unfoldBox(UNFOLD[Math.max(0, FOLD_FROM - (k - YANK.length))])
    }
  }
  const out: Drawing = { bg: bgPath(bg), cloth: '', pole: '', marks: mark >= 0 ? marks(mark) : '' }
  return pose ? { ...out, ...flagPaths(pose, wf / CYCLE) } : out
}

/* ---------- DOM ---------- */

const NS = 'http://www.w3.org/2000/svg'
let uid = 0

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag)
  for (const key in attrs) node.setAttribute(key, String(attrs[key]))
  parent?.appendChild(node)
  return node
}

export type LogoParts = {
  svg: SVGSVGElement
  bg: SVGPathElement
  matte: SVGPathElement
  pole: SVGPathElement
  cloth: SVGPathElement
  marks: SVGPathElement
}

export function createLogoSVG(label?: string): LogoParts {
  const id = `cp-logo-matte-${++uid}`
  const svg = el('svg', { viewBox: '-1 -1 35 35', overflow: 'visible', focusable: 'false' })
  if (label) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label) } else svg.setAttribute('aria-hidden', 'true')
  const clip = el('clipPath', { id }, el('defs', {}, svg))
  const matte = el('path', {}, clip)
  const mark = el('g', { transform: 'rotate(-2 16.5 16.5)' }, svg)
  const bg = el('path', { fill: PURPLE }, mark)
  const matted = el('g', { 'clip-path': `url(#${id})` }, mark)
  const flag = el('g', { transform: 'translate(6 6) scale(0.875)', fill: '#fff', stroke: '#fff', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, matted)
  const pole = el('path', { fill: 'none' }, flag)
  const cloth = el('path', {}, flag)
  const marksPath = el('path', { fill: 'none', stroke: '#fff', 'stroke-width': 1.1, 'stroke-linecap': 'round' }, matted)
  return { svg, bg, matte, pole, cloth, marks: marksPath }
}

export function paint(parts: LogoParts, d: Drawing): void {
  parts.bg.setAttribute('d', d.bg)
  parts.matte.setAttribute('d', d.bg)
  parts.pole.setAttribute('d', d.pole)
  parts.cloth.setAttribute('d', d.cloth)
  parts.marks.setAttribute('d', d.marks)
}

export function paintStatic(parts: LogoParts): void {
  paint(parts, { bg: STATIC_BG, pole: '', cloth: STATIC_FLAG, marks: '' })
}

/* one shared 12fps clock keeps every logo on the same beat */
const steppers = new Set<() => void>()
let last = 0
let rafId = 0

function tick(now: number) {
  const step = 1000 / FPS
  if (!last) last = now
  let n = Math.floor((now - last) / step)
  if (n > 0) {
    last += n * step
    if (n > 3) n = 1 // tab was hidden: don't fast-forward
    steppers.forEach((s) => { for (let i = 0; i < n; i++) s() })
  }
  if (steppers.size) rafId = requestAnimationFrame(tick)
  else { rafId = 0; last = 0 }
}

export type LogoOptions = {
  /** 'intro' (default) plays the build, 'loop' starts waving straight away */
  start?: 'intro' | 'loop'
  /** clicking the host replays the animation (default true) */
  interactive?: boolean
  /** 'auto' (default) follows prefers-reduced-motion; true always shows the still logo */
  reducedMotion?: boolean | 'auto'
  label?: string
  onFrame?: (phase: Phase, k: number) => void
}

export type LogoController = {
  replay(): void
  restart(): void
  pause(paused: boolean): void
  setReducedMotion(value: boolean | 'auto'): void
  destroy(): void
}

export function mountCheckpointLogo(host: HTMLElement, options: LogoOptions = {}): LogoController {
  const opts: LogoOptions = { start: 'intro', interactive: true, reducedMotion: 'auto', ...options }
  const parts = createLogoSVG(opts.label)
  host.appendChild(parts.svg)
  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
  const still = () => opts.reducedMotion === true || (opts.reducedMotion === 'auto' && !!mq?.matches)
  let phase: Phase = 'intro'
  let k = 0
  let wf = 0
  let paused = false
  let queued = false

  const reset = () => {
    queued = false
    k = 0
    if (opts.start === 'loop') { phase = 'loop'; wf = 0 } else { phase = 'intro'; wf = -TIMING.impactAt }
  }
  const render = () => {
    if (still()) paintStatic(parts)
    else paint(parts, frameAt(phase, k, wf))
    opts.onFrame?.(phase, k)
  }
  const step = () => {
    if (paused || still()) return
    k++
    wf++
    if (phase === 'intro' && k >= TIMING.introLen) {
      phase = queued ? 'outro' : 'loop'
      k = 0
      queued = false
    } else if (phase === 'outro' && k >= TIMING.outroLen) {
      phase = 'intro'
      k = 0
      wf = -TIMING.impactAt
    }
    render()
  }
  // animate off, then start over. A tap mid-intro waits for the intro to finish.
  const replay = () => {
    if (still()) return
    if (phase === 'loop') { phase = 'outro'; k = 0 } else if (phase === 'intro') queued = true
  }
  const onMotionPref = () => { reset(); render() }

  mq?.addEventListener('change', onMotionPref)
  if (opts.interactive) host.addEventListener('click', replay)
  reset()
  render()
  steppers.add(step)
  if (!rafId) rafId = requestAnimationFrame(tick)

  return {
    replay,
    restart() { reset(); render() },
    pause(p) { paused = p },
    setReducedMotion(value) { opts.reducedMotion = value; reset(); render() },
    destroy() {
      steppers.delete(step)
      mq?.removeEventListener('change', onMotionPref)
      host.removeEventListener('click', replay)
      parts.svg.remove()
    },
  }
}
