import { BookOpen, Gamepad2, Headphones } from 'lucide-react'
import type { AppMode } from './types'

export default function ModeSwitcher({ mode, onChange, mobile = false }: { mode: AppMode; onChange: (mode: AppMode) => void; mobile?: boolean }) {
  return <div className={`mode-switcher${mobile ? ' mobile-mode-switcher' : ''}`} role="group" aria-label="Checkpoint mode">
    {([{ value: 'games', label: 'Games', Icon: Gamepad2 }, { value: 'books', label: 'Books', Icon: BookOpen }, { value: 'music', label: 'Music', Icon: Headphones }] as const).map(({ value, label, Icon }) => <button key={value} type="button" className={mode === value ? 'active' : ''} aria-pressed={mode === value} aria-label={label} title={label} onClick={() => onChange(value)}><Icon size={21} /></button>)}
  </div>
}
