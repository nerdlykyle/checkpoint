import { createContext } from 'react'

export const CollectionActionContext = createContext<{
  label: string
  controlsId: string
  onOpen: () => void
} | null>(null)
