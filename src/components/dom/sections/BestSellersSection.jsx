import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { useGLTF } from '@react-three/drei'
import { BEST_SELLERS } from '../../../config/bestSellers.js'
import { ProductCard3D } from '../ProductCard3D.jsx'

BEST_SELLERS.forEach((p) => useGLTF.preload(p.model))

const FLEX_LAYOUT = [1.4, 1, 1, 0.8]

export const BestSellersSection = () => {
  const rootRef = useRef(null)
  const headingRef = useRef(null)

  useGSAP(
    () => {
      const split = new SplitText(headingRef.current, { type: 'chars' })

      gsap.from(split.chars, {
        yPercent: 110,
        stagger: 0.03,
        duration: 0.7,
        ease: 'power4.out',
        scrollTrigger: { trigger: rootRef.current, start: 'top 70%', once: true },
      })

      gsap.from('[data-anim="bs-kicker"]', {
        y: 20,
        opacity: 0,
        duration: 0.6,
        ease: 'power3.out',
        scrollTrigger: { trigger: rootRef.current, start: 'top 75%', once: true },
      })

      gsap.from('[data-anim="bs-card"]', {
        y: 60,
        opacity: 0,
        stagger: 0.12,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: rootRef.current, start: 'top 70%', once: true },
      })

      return () => split.revert()
    },
    { scope: rootRef },
  )

  return (
    <section
      ref={rootRef}
      data-section="best-sellers"
      data-nav-theme="dark"
      data-transition-type="none"
      data-transition-color="#172D6D"
      className="relative w-full overflow-hidden py-32 md:py-40"
      style={{ background: 'var(--color-dark)', color: 'var(--color-cream)' }}
    >
      <div className="relative px-6 md:px-10 max-w-[1500px] mx-auto">
        <div className="flex items-end justify-between gap-8 mb-16">
          <div>
            <span
              data-anim="bs-kicker"
              className="block text-[11px] tracking-[0.3em] uppercase mb-4"
              style={{ color: 'var(--color-lime)' }}
            >
              Lo más pedido
            </span>
            <h2
              ref={headingRef}
              className="leading-[0.85] overflow-hidden"
              style={{
                fontWeight: 900,
                fontSize: 'clamp(3rem, 9vw, 10rem)',
                letterSpacing: '-0.04em',
                color: 'var(--color-cream)',
              }}
            >
              BEST SELLERS
            </h2>
          </div>

          <span
            className="hidden md:block text-[10px] tracking-[0.4em] uppercase pb-3"
            style={{ color: 'rgba(255,248,240,0.4)' }}
          >
            04 / Selección
          </span>
        </div>

        <div className="flex flex-col md:flex-row gap-4 md:gap-5 items-stretch">
          {BEST_SELLERS.map((product, i) => (
            <ProductCard3D
              key={product.id}
              product={product}
              flex={FLEX_LAYOUT[i] ?? 1}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
