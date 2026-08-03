import { lazy, Suspense, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { useAppStore } from '../../stores/useAppStore.js'
import { useCTAHover } from '../../hooks/useCTAHover.js'
import { shouldSimplifyVisuals } from '../../lib/deviceCapability.js'

// Import dinamico: en movil/tablet/reduced-motion, el modulo entero
// (three.js + postprocesado + preload del modelo GLB) ni siquiera se
// descarga - no solo se evita renderizarlo. Ver deviceCapability.js.
const HeroCanvas = lazy(() =>
  import('../three/HeroCanvas.jsx').then((m) => ({ default: m.HeroCanvas })),
)

export const Hero = () => {
  const rootRef = useRef(null)
  const titleRef = useRef(null)
  const sublineRef = useRef(null)
  const ctaRef = useRef(null)
  const verticalRef = useRef(null)
  const isLoaded = useAppStore((s) => s.isLoaded)
  const cta = useCTAHover()
  const [simplify] = useState(shouldSimplifyVisuals)

  useGSAP(
    () => {
      if (!isLoaded) return
      const lines = rootRef.current.querySelectorAll('.hero-line .hero-line-inner')

      gsap.set(lines, { yPercent: 110 })

      const tl = gsap.timeline({ delay: 0.2 })

      tl.to(lines, {
        yPercent: 0,
        duration: 0.9,
        ease: 'power4.out',
        stagger: 0.1,
      })
        .from(
          sublineRef.current,
          { y: 20, opacity: 0, duration: 0.6, ease: 'power3.out' },
          '-=0.5',
        )
        .from(
          ctaRef.current,
          { scale: 0.8, opacity: 0, duration: 0.5, ease: 'back.out(2)' },
          '-=0.3',
        )
        .from(
          verticalRef.current,
          { opacity: 0, duration: 0.8, ease: 'power2.out' },
          '-=0.4',
        )

      gsap.to(titleRef.current, {
        yPercent: -20,
        ease: 'none',
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      })
    },
    { dependencies: [isLoaded], scope: rootRef },
  )

  return (
    <section
      ref={rootRef}
      data-section="hero"
      data-transition-type="none"
      className="relative min-h-screen w-full overflow-hidden"
    >
      <style>{`
        @media (min-width: 768px) {
          .hero-lime { margin-left: -0.2em; }
        }
      `}</style>
      {!simplify && (
        <Suspense fallback={null}>
          <HeroCanvas />
        </Suspense>
      )}

      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, rgba(255,248,240,0.0) 0%, rgba(255,248,240,0.4) 100%)' }}
      />

      <div className="relative z-10 min-h-screen flex flex-col justify-between px-6 md:px-10 pt-28 pb-10">
        <div className="flex justify-between items-start text-[10px] tracking-[0.3em] uppercase opacity-70">
          <div className="flex flex-col gap-1">
            <span>00 / TEMPORADA 26</span>
            <span>SEVILLA · ALCOSA</span>
          </div>
          <div className="text-right hidden md:block">
            <div>—</div>
            <div>SCROLL ↓</div>
          </div>
        </div>

        <div
          ref={verticalRef}
          className="hidden lg:block absolute left-4 top-1/2 -translate-y-1/2 text-[10px] tracking-[0.4em] uppercase"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg) translateY(50%)' }}
        >
          CLAN · VPRS · ALCOSA · 2026
        </div>

        <h1
          ref={titleRef}
          className="font-sans"
          style={{
            fontWeight: 900,
            // Piso bajado (era 3.5rem) - en moviles angostos el 14vw
            // quedaba por debajo del minimo y clamp() se iba al piso
            // fijo, empujando "BARATO Y LOCAL." mas ancho que la
            // pantalla (no hay overflow-hidden horizontal aqui, asi
            // que no se recortaba, pero envolvia de forma fea a mitad
            // de frase). Con el piso mas bajo entra completo con mas
            // frecuencia, y si igual envuelve, la animacion de
            // aparicion sigue funcionando bien (yPercent es relativo a
            // la altura real del bloque).
            fontSize: 'clamp(2.75rem, 13vw, 16rem)',
            lineHeight: 0.88,
            letterSpacing: '-0.04em',
            color: 'var(--color-navy)',
          }}
        >
          <span className="hero-line block overflow-hidden italic">
            <span className="hero-line-inner block">VAPE.</span>
          </span>
          <span className="hero-line block overflow-hidden italic">
            <span className="hero-line-inner block">o no respires</span>
          </span>
          <span className="hero-line block overflow-hidden italic">
            <span className="hero-line-inner block">FUERTE,</span>
          </span>
          <span className="hero-line block overflow-hidden italic relative">
            <span
              className="hero-line-inner hero-lime block relative"
              style={{
                background: 'var(--color-lime)',
                display: 'inline-block',
                padding: '0 0.2em',
              }}
            >
              BARATO Y LOCAL.
            </span>
          </span>
        </h1>

        <div className="flex items-end justify-between gap-8 mt-12">
          <div ref={ctaRef}>
            <Link
              ref={cta.ref}
              onMouseEnter={cta.onMouseEnter}
              onMouseLeave={cta.onMouseLeave}
              to="/catalog"
              data-cursor="link"
              className="inline-flex items-center gap-3 px-6 py-3"
              style={{
                background: 'var(--color-navy)',
                color: 'var(--color-lime)',
                fontWeight: 700,
                fontSize: '14px',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                willChange: 'transform',
                minHeight: 44,
              }}
            >
              <span data-cta-arrow className="inline-block">▸</span>
              <span>Ver tienda</span>
            </Link>
          </div>

          <div ref={sublineRef} className="text-right max-w-xs">
            <div className="text-[10px] tracking-[0.25em] uppercase opacity-60 mb-2">
              ⌖ Sevilla · Tienda de vapeo
            </div>
            <p className="text-[13px] leading-snug italic opacity-90">
              120+ referencias entre <br />
              sales, longfill y desechables —<br /> made in Alcosa.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
