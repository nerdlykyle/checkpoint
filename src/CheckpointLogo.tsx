import { useEffect, useRef } from 'react'
import { mountCheckpointLogo } from './lib/checkpointLogoMotion'
import './CheckpointLogo.css'

type CheckpointLogoProps = {
  /** extra classes; pass "brand-mark" to pick up the existing sizes */
  className?: string
  /** 'intro' builds the mark first, 'loop' starts waving straight away */
  start?: 'intro' | 'loop'
  /** accessible name; leave empty when the logo sits next to the "checkpoint" wordmark */
  label?: string
}

/** Animated Checkpoint mark. Tap it to send the flag off and play the intro again. */
export function CheckpointLogo({ className = '', start = 'intro', label }: CheckpointLogoProps) {
  const host = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!host.current) return
    const logo = mountCheckpointLogo(host.current, { start, label })
    return () => logo.destroy()
  }, [start, label])

  return <span ref={host} className={`cp-logo ${className}`.trim()} />
}
