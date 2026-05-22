import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { useAppStore } from '../../stores/useAppStore.js'

export const Preloader = () => {
  const rootRef = useRef(null)
  const counterRef = useRef(null)
  const brandRef = useRef(null)

  useGSAP(
    () => {
      const counter = { value: 0 }
      const tl = gsap.timeline()

      tl.to(counter, {
        value: 100,
        duration: 2,
        ease: 'power2.inOut',
        snap: { value: 1 },
        onUpdate: () => {
          if (counterRef.current) counterRef.current.textContent = String(counter.value).padStart(3, '0')
        },
      })

      const split = new SplitText(brandRef.current, { type: 'chars' })
      gsap.set(split.chars, { yPercent: 110 })

      tl.to(
        split.chars,
        { yPercent: 0, stagger: 0.04, duration: 0.8, ease: 'power4.out' },
        '-=0.4',
      )

      tl.to(
        rootRef.current,
        {
          yPercent: -100,
          duration: 1.2,
          ease: 'expo.inOut',
          onComplete: () => {
            useAppStore.setState({ isLoaded: true })
            split.revert()
          },
        },
        '+=0.3',
      )
    },
    { scope: rootRef },
  )

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[9999] flex flex-col justify-between p-6 md:p-10"
      style={{ background: 'var(--color-dark)', color: 'var(--color-cream)' }}
    >
      <div className="flex justify-between items-start text-[10px] tracking-[0.3em] uppercase opacity-70">
        <span>Vapers·Alcosa</span>
        <span>Sevilla / EST 2025</span>
      </div>

      <div className="flex items-end justify-between gap-6">
        <span
          ref={counterRef}
          className="block leading-none"
          style={{ fontWeight: 200, fontSize: 'clamp(6rem, 18vw, 18rem)' }}
        >
          000
        </span>
        <span className="hidden md:block text-[10px] tracking-[0.3em] uppercase opacity-60 pb-6">
          Cargando experiencia
        </span>
      </div>

      <div className="overflow-hidden">
        <div
          ref={brandRef}
          className="italic leading-[0.9]"
          style={{
            fontWeight: 900,
            fontSize: 'clamp(2.5rem, 8vw, 7rem)',
            color: 'var(--color-lime)',
          }}
        >
          VAPERS ALCOSA
        </div>
      </div>
    </div>
  )
}
