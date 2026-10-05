import { Children, isValidElement, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import './StyledSelect.css'

type Option = { value?: string; children?: ReactNode; disabled?: boolean }
type Props = { value: string; onValueChange: (value: string) => void; children: ReactNode; disabled?: boolean; 'aria-label'?: string }

/** Select-only combobox: consistent dark menus on phones and desktops. */
export default function StyledSelect({ value, onValueChange, children, disabled, 'aria-label': label }: Props) {
  const options = Children.toArray(children).flatMap(child => isValidElement<Option>(child)
    ? [{ value: String(child.props.value ?? child.props.children ?? ''), label: String(child.props.children ?? ''), disabled: child.props.disabled }]
    : [])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [position, setPosition] = useState({ left: 0, top: 0, width: 180, maxHeight: 280 })
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const search = useRef({ text: '', time: 0 })
  const id = useId()
  const selected = options.findIndex(option => option.value === value)
  const enabled = options.map((option, index) => !option.disabled ? index : -1).filter(index => index >= 0)
  const show = () => { if (!disabled && enabled.length) { setActive(enabled.includes(selected) ? selected : enabled[0]); setOpen(true) } }
  const choose = (index: number) => {
    const option = options[index]
    if (!option || option.disabled) return
    setOpen(false)
    if (option.value !== value) onValueChange(option.value)
    trigger.current?.focus()
  }
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect()
      if (!anchor) return
      const width = Math.min(Math.max(anchor.width, 190), window.innerWidth - 24)
      const below = window.innerHeight - anchor.bottom - 12
      const above = anchor.top - 12
      const upward = below < Math.min(240, options.length * 44 + 12) && above > below
      const maxHeight = Math.max(44, Math.min(280, upward ? above - 6 : below - 6))
      const height = Math.min(panel.current?.scrollHeight ?? maxHeight, maxHeight)
      setPosition({ left: Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12)), top: upward ? anchor.top - height - 6 : anchor.bottom + 6, width, maxHeight })
    }
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false)
    }
    const scroll = (event: Event) => { if (!panel.current?.contains(event.target as Node)) place() }
    place()
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', scroll, true)
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', place); window.removeEventListener('scroll', scroll, true) }
  }, [open, options.length])
  useLayoutEffect(() => {
    if (!open) return
    const option = panel.current?.children[active] as HTMLElement | undefined
    if (option && panel.current) {
      if (option.offsetTop < panel.current.scrollTop) panel.current.scrollTop = option.offsetTop
      else if (option.offsetTop + option.offsetHeight > panel.current.scrollTop + panel.current.clientHeight) panel.current.scrollTop = option.offsetTop + option.offsetHeight - panel.current.clientHeight
    }
  }, [active, open])
  return <>
    <button ref={trigger} type="button" className="styled-select" role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined} aria-activedescendant={open ? `${id}-${active}` : undefined} disabled={disabled}
      onClick={event => { event.stopPropagation(); if (open) setOpen(false); else show() }}
      onBlur={event => { if (!panel.current?.contains(event.relatedTarget as Node)) setOpen(false) }}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); return }
        if (event.key === 'Tab') { setOpen(false); return }
        if (['Enter', ' '].includes(event.key)) { event.preventDefault(); if (open) choose(active); else show(); return }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault()
          if (!open) { show(); return }
          const index = enabled.indexOf(active)
          setActive(event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled.at(-1)! : enabled[(index + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length])
        } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault()
          const now = Date.now()
          search.current = { text: (now - search.current.time < 700 ? search.current.text : '') + event.key.toLowerCase(), time: now }
          const index = options.findIndex(option => !option.disabled && option.label.toLowerCase().startsWith(search.current.text))
          if (index >= 0) { setActive(index); setOpen(true) }
        }
      }}><span>{options[selected]?.label ?? 'Choose…'}</span><ChevronDown size={15} aria-hidden="true" /></button>
    {open && createPortal(<div ref={panel} id={id} role="listbox" aria-label={label ?? 'Options'} className="styled-select-menu" style={position} onClick={event => { event.preventDefault(); event.stopPropagation() }} onMouseDown={event => event.preventDefault()}>
      {options.map((option, index) => <div key={option.value} id={`${id}-${index}`} role="option" aria-selected={option.value === value} aria-disabled={option.disabled || undefined} className={`styled-select-option${index === active ? ' is-highlighted' : ''}`} onPointerMove={() => { if (!option.disabled) setActive(index) }} onClick={() => choose(index)}>
        <span>{option.label}</span>{option.value === value && <Check size={16} aria-hidden="true" />}
      </div>)}
    </div>, document.body)}
  </>
}
