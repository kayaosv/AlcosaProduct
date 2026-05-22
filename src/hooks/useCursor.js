import { useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore.js'

export const useCursor = (variant) => {
  const setCursorVariant = useAppStore((s) => s.setCursorVariant)

  useEffect(() => {
    return () => setCursorVariant('default')
  }, [setCursorVariant])

  return {
    onMouseEnter: () => setCursorVariant(variant),
    onMouseLeave: () => setCursorVariant('default'),
  }
}
