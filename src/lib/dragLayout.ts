export type DragRect = { top: number; height: number }

export function dragDestination(rects: DragRect[], source: number, center: number) {
  let target = source
  while (target > 0 && center < rects[target - 1].top + rects[target - 1].height / 2) target--
  while (target < rects.length - 1 && center > rects[target + 1].top + rects[target + 1].height / 2) target++
  return target
}

// Reflow variable-height cards into a preview without changing the saved order.
export function dragOffsets(rects: DragRect[], source: number, target: number) {
  const order = rects.map((_, index) => index)
  order.splice(target, 0, order.splice(source, 1)[0])
  const offsets = rects.map(() => 0)
  let top = rects[0]?.top || 0
  order.forEach((index, slot) => {
    offsets[index] = top - rects[index].top
    const gap = slot < rects.length - 1 ? rects[slot + 1].top - rects[slot].top - rects[slot].height : 0
    top += rects[index].height + gap
  })
  return offsets
}

export function dragScrollSpeed(y: number, top: number, bottom: number) {
  const edge = Math.min(80, (bottom - top) / 4)
  if (y < top + edge) return -18 * Math.max(0, Math.min(1, (top + edge - y) / edge))
  if (y > bottom - edge) return 18 * Math.max(0, Math.min(1, (y - bottom + edge) / edge))
  return 0
}
