import { useEffect, useState } from 'react'
import { Share2 } from 'lucide-react'
import './NavigationSync.css'

export type ConnectionState = 'local' | 'connecting' | 'live' | 'error'
export function musicConnectionState(status: string, error: string): ConnectionState {
  if (error || status.includes('attention')) return 'error'
  if (status.includes('shared live')) return 'live'
  if (status.includes('saved on this device')) return 'local'
  return 'connecting'
}

export default function NavigationSync({ state, label, onShare }: { state: ConnectionState; label: string; onShare?: () => void }) {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update); window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  const shown = !online && state !== 'local' && state !== 'error' ? 'connecting' : state
  const text = shown === 'live' ? 'Shared live' : shown === 'connecting' ? 'Reconnecting…' : shown === 'error' ? 'Sync needs attention' : 'Saved on this device'
  return <div className={`navigation-sync sync-${shown}`} role="status" title={`${label}: ${text}`}><i aria-hidden="true" /><span>{text}</span>{onShare && <button type="button" onClick={onShare} aria-label="Copy board link" title="Copy board link"><Share2 size={14} /></button>}</div>
}
