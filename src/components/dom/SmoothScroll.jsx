import { useEffect } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

const isTouch = () =>
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0)

export const SmoothScroll = ({ children }) => {
  useEffect(() => {
    const touch = isTouch()

    const lenis = new Lenis({
      duration: touch ? 0 : 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: !touch,
      // On touch devices Lenis acts as a thin scroll proxy so GSAP
      // ScrollTrigger stays in sync without fighting the native momentum.
      smoothTouch: false,
    })

    const onScroll = () => ScrollTrigger.update()
    lenis.on('scroll', onScroll)

    const raf = (time) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    return () => {
      lenis.off('scroll', onScroll)
      gsap.ticker.remove(raf)
      lenis.destroy()
    }
  }, [])

  return children
}
