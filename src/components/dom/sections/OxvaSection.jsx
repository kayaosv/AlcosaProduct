import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useCTAHover } from '../../../hooks/useCTAHover.js'

export const OxvaSection = () => {
  const rootRef = useRef(null)
  const cta = useCTAHover()

  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger)

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top 50%',
          once: true,
        },
      })

      tl.from('[data-anim="oxva-kicker"]', {
        y: 20,
        opacity: 0,
        duration: 0.5,
        ease: 'power3.out',
      })
        .from(
          '[data-anim="oxva-headline"]',
          {
            y: 40,
            opacity: 0,
            duration: 0.8,
            ease: 'expo.out',
          },
          '+=0.05',
        )
        .from(
          '[data-anim="oxva-body"]',
          {
            y: 25,
            opacity: 0,
            stagger: 0.1,
            duration: 0.65,
            ease: 'power3.out',
          },
          '-=0.4',
        )
        .from(
          '[data-anim="oxva-badge"]',
          {
            scale: 0.88,
            opacity: 0,
            duration: 0.45,
            ease: 'back.out(1.8)',
          },
          '-=0.15',
        )
        .from(
          '[data-anim="oxva-cta"]',
          { y: 20, opacity: 0, duration: 0.45, ease: 'power3.out' },
          '-=0.1',
        )
        .from(
          '[data-anim="oxva-number"]',
          {
            clipPath: 'inset(0 0 100% 0)',
            y: 50,
            duration: 1.4,
            ease: 'expo.out',
          },
          0.05,
        )
    },
    { scope: rootRef },
  )

  return (
    <section
      ref={rootRef}
      data-section="oxva"
      data-nav-theme="dark"
      data-transition-type="circle"
      className="relative w-full overflow-hidden py-32 md:py-48"
      style={{ background: 'var(--color-navy)', color: 'var(--color-cream)' }}
    >
      {/* Ambient lime brushstroke */}
      <div
        aria-hidden
        className="absolute -top-32 -right-20 w-[60vw] h-[60vw] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(closest-side, rgba(198,249,31,0.18), rgba(198,249,31,0) 70%)',
          filter: 'blur(20px)',
        }}
      />

      <div className="relative px-6 md:px-10 max-w-[1400px] mx-auto grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-5 flex flex-col">
          <span
            data-anim="oxva-kicker"
            className="text-[11px] tracking-[0.3em] uppercase"
            style={{ color: 'var(--color-lime)' }}
          >
            Tienda oficial · OXVA
          </span>

          <div className="mt-10 space-y-6">
            <h2
              data-anim="oxva-headline"
              className="leading-[0.9]"
              style={{
                fontSize: 'clamp(2.2rem, 4.5vw, 4rem)',
                fontWeight: 200,
                letterSpacing: '-0.02em',
              }}
            >
              Somos uno de los pocos.
            </h2>
            <p
              data-anim="oxva-body"
              className="text-[16px] md:text-[18px] leading-relaxed max-w-md"
              style={{ color: 'rgba(255,248,240,0.75)' }}
            >
              Distribuidor oficial autorizado por <strong style={{ color: 'var(--color-cream)' }}>OXVA</strong>.
              Producto auténtico, garantía directa de marca y precios sin intermediarios.
            </p>
            <p
              data-anim="oxva-body"
              className="text-[14px] leading-relaxed max-w-md"
              style={{ color: 'rgba(255,248,240,0.5)' }}
            >
              No somos una tienda más con su logo en el escaparate. Estamos en el
              registro oficial — el número lo dice.
            </p>

            <div data-anim="oxva-badge" className="pt-6 flex flex-wrap items-center gap-4">
              <span
                className="inline-flex items-center gap-2 px-4 py-2 text-[10px] tracking-[0.25em] uppercase"
                style={{
                  border: '1px solid var(--color-lime)',
                  color: 'var(--color-lime)',
                  fontWeight: 700,
                }}
              >
                ✓ Distribuidor Oficial · #061
              </span>
            </div>

            <div data-anim="oxva-cta" className="pt-4">
              <Link
                ref={cta.ref}
                onMouseEnter={cta.onMouseEnter}
                onMouseLeave={cta.onMouseLeave}
                to="/catalog?cat=vapers"
                data-cursor="link"
                className="inline-flex items-center gap-3 px-8 py-4 text-[12px] tracking-[0.25em] uppercase"
                style={{
                  background: 'var(--color-lime)',
                  color: 'var(--color-navy)',
                  fontWeight: 900,
                  willChange: 'transform',
                }}
              >
                <span data-cta-arrow className="inline-block">▸</span>
                <span>Ver dispositivos OXVA</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="col-span-12 md:col-span-7 flex items-center justify-end relative">
          <div className="relative">
            <span
              className="block text-[11px] tracking-[0.3em] uppercase absolute -top-8 left-2"
              style={{ color: 'rgba(255,248,240,0.4)' }}
            >
              Nº de registro
            </span>
            <span
              data-anim="oxva-number"
              className="block leading-[0.78]"
              style={{
                fontSize: 'clamp(10rem, 32vw, 32rem)',
                fontWeight: 900,
                letterSpacing: '-0.06em',
                color: 'var(--color-cream)',
              }}
            >
              <span style={{ color: 'rgba(255,248,240,0.25)' }}>#</span>061
            </span>
            <span
              className="block text-right text-[11px] tracking-[0.3em] uppercase mt-4"
              style={{ color: 'rgba(255,248,240,0.4)' }}
            >
              OXVA · España
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
