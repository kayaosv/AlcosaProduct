import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

// High-frequency hover interaction for primary CTAs.
// Returns a ref for the button and onMouseEnter/onMouseLeave handlers that
// lift the button slightly and shift the inner [data-cta-arrow] glyph.
export const useCTAHover = () => {
  const ref = useRef(null)
  const yTo = useRef(null)
  const arrowTo = useRef(null)

  useGSAP(
    () => {
      if (!ref.current) return
      yTo.current = gsap.quickTo(ref.current, 'y', { duration: 0.35, ease: 'power3.out' })
      const arrow = ref.current.querySelector('[data-cta-arrow]')
      if (arrow) {
        arrowTo.current = gsap.quickTo(arrow, 'x', { duration: 0.4, ease: 'power3.out' })
      }
    },
    { scope: ref },
  )

  const onMouseEnter = () => {
    yTo.current?.(-3)
    arrowTo.current?.(6)
  }
  const onMouseLeave = () => {
    yTo.current?.(0)
    arrowTo.current?.(0)
  }

  return { ref, onMouseEnter, onMouseLeave }
}
