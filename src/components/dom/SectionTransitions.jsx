import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export const SectionTransitions = () => {
  const plane1Ref = useRef()
  const plane2Ref = useRef()
  const flashRef = useRef()
  const circleRef = useRef()

  useGSAP(() => {
    gsap.set([plane1Ref.current, plane2Ref.current], {
      scaleY: 0,
      transformOrigin: 'bottom center',
    })
    gsap.set(flashRef.current, { opacity: 0 })
    gsap.set(circleRef.current, { scale: 0, transformOrigin: 'center center' })

    const sections = document.querySelectorAll('[data-section]')

    sections.forEach((section, i) => {
      const next = sections[i + 1]
      if (!next) return

      const type = section.dataset.transitionType || 'double-plane'
      if (type === 'none') return

      if (type === 'double-plane') {
        const darkColor = section.dataset.transitionColor || '#0D0D0D'
        gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: 'bottom 75%',
            end: 'bottom top',
            scrub: 0.6,
          },
        })
          .set(plane1Ref.current, { backgroundColor: darkColor, transformOrigin: 'bottom center' })
          .set(plane2Ref.current, { transformOrigin: 'bottom center' })
          .to(plane1Ref.current, { scaleY: 1, ease: 'none', duration: 0.35 }, 0)
          .to(plane2Ref.current, { scaleY: 1, ease: 'none', duration: 0.35 }, 0.2)
          .set(plane2Ref.current, { transformOrigin: 'top center' }, 0.55)
          .to(plane2Ref.current, { scaleY: 0, ease: 'none', duration: 0.25 }, 0.55)
          .set(plane1Ref.current, { transformOrigin: 'top center' }, 0.65)
          .to(plane1Ref.current, { scaleY: 0, ease: 'none', duration: 0.35 }, 0.65)
      }

      if (type === 'circle') {
        gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: 'bottom 85%',
            end: 'bottom 20%',
            scrub: 0.4,
          },
        })
          .to(circleRef.current, { scale: 1, ease: 'none', duration: 0.4 })
          .to(circleRef.current, { scale: 1, ease: 'none', duration: 0.2 })
          .to(circleRef.current, { scale: 0, ease: 'none', duration: 0.4 })
      }

      if (type === 'flash') {
        gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: 'bottom 85%',
            end: 'bottom 20%',
            scrub: 0.4,
          },
        })
          .to(flashRef.current, { opacity: 1, ease: 'none', duration: 0.4 })
          .to(flashRef.current, { opacity: 1, ease: 'none', duration: 0.2 })
          .to(flashRef.current, { opacity: 0, ease: 'none', duration: 0.4 })
      }
    })
  })

  return (
    <>
      <div ref={plane1Ref} className="section-transition-plane" />
      <div ref={plane2Ref} className="section-transition-plane section-transition-plane--accent" />
      <div ref={flashRef} className="section-transition-flash" />
      <div ref={circleRef} className="section-transition-circle" />
    </>
  )
}
