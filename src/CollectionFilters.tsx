import type { ReactNode } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import './CollectionFilters.css'

// Native disclosure stays keyboard accessible and starts closed on each visit.
// Hiding the controls preserves the user's current filters.
export default function CollectionFilters({ children, activeCount = 0, groupedBy }: { children: ReactNode; activeCount?: number; groupedBy?: string }) {
  return <details className="collection-filters">
    <summary><SlidersHorizontal size={17} aria-hidden="true" /><span className="collection-filters-label">Search & filters{(activeCount > 0 || groupedBy) && <small>{[activeCount > 0 ? `${activeCount} active` : '', groupedBy ? `Grouped by ${groupedBy}` : ''].filter(Boolean).join(' · ')}</small>}</span><ChevronDown className="collection-filters-chevron" size={18} aria-hidden="true" /></summary>
    <div className="collection-filters-content">{children}</div>
  </details>
}
