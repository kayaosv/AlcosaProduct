import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

const STATS = [
  { value: 6, suffix: '+', label: 'Categorías de producto' },
  { value: 3, suffix: '', label: 'Marcas premium' },
  { value: 61, suffix: '', prefix: '#0', label: 'Distribuidor oficial OXVA' },
  { value: 2019, suffix: '', prefix: 'Desde ', label: 'Año de apertura', plain: true },
]

const Stat = ({ stat, index }) => {
  const numRef = useRef(null)

  useGSAP(
    () => {
      const target = { v: 0 }
      gsap.to(target, {
        v: stat.value,
        duration: 1.6,
        delay: index * 0.08,
        ease: 'power3.out',
        snap: { v: 1 },
        scrollTrigger: {
          trigger: numRef.current,
          start: 'top 85%',
          once: true,
        },
        onUpdate: () => {
          if (numRef.current) {
            numRef.current.textContent = `${stat.prefix ?? ''}${Math.round(target.v)}${stat.suffix ?? ''}`
          }
        },
      })
    },
    { dependencies: [] },
  )

  return (
    <div
      className="py-6"
      style={{ borderTop: '1px solid rgba(255,248,240,0.2)' }}
    >
      <span
        ref={numRef}
        className="block leading-none"
        style={{
          fontSize: stat.plain ? 'clamp(1.5rem, 2.5vw, 2.2rem)' : 'clamp(2rem, 4vw, 3.4rem)',
          fontWeight: 900,
          color: 'var(--color-lime)',
          letterSpacing: '-0.03em',
        }}
      >
        0
      </span>
      <span
        className="block mt-3 text-[10px] tracking-[0.25em] uppercase"
        style={{ color: 'rgba(255,248,240,0.6)' }}
      >
        {stat.label}
      </span>
    </div>
  )
}

export const AboutSection = () => {
  const rootRef = useRef(null)

  useGSAP(
    () => {
      gsap.from('[data-anim="about-kicker"]', {
        y: 20,
        opacity: 0,
        duration: 0.7,
        ease: 'power3.out',
        scrollTrigger: { trigger: rootRef.current, start: 'top 75%', once: true },
      })
      gsap.from('[data-anim="about-head"]', {
        clipPath: 'inset(0 100% 0 0)',
        duration: 1.3,
        ease: 'expo.out',
        scrollTrigger: { trigger: rootRef.current, start: 'top 70%', once: true },
      })
      gsap.from('[data-anim="about-copy"] > *', {
        y: 25,
        opacity: 0,
        stagger: 0.1,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: rootRef.current, start: 'top 65%', once: true },
      })
    },
    { scope: rootRef },
  )

  return (
    <section
      ref={rootRef}
      className="relative w-full py-32 md:py-48"
      style={{ background: 'var(--color-dark)', color: 'var(--color-cream)' }}
    >
      <div className="relative px-6 md:px-10 max-w-[1400px] mx-auto grid grid-cols-12 gap-6 md:gap-10">
        <div className="col-span-12 md:col-span-8">
          <span
            data-anim="about-kicker"
            className="text-[11px] tracking-[0.3em] uppercase"
            style={{ color: 'var(--color-blue)' }}
          >
            Quiénes somos
          </span>

          <h2
            data-anim="about-head"
            className="mt-8 leading-[0.85]"
            style={{
              fontSize: 'clamp(3rem, 9vw, 9rem)',
              fontWeight: 900,
              letterSpacing: '-0.04em',
            }}
          >
            UN NEGOCIO<br />
            DE <em className="italic" style={{ fontWeight: 200, color: 'var(--color-blue)' }}>familia</em>.
          </h2>

          <div data-anim="about-copy" className="mt-12 max-w-2xl space-y-6">
            <p
              className="text-[17px] md:text-[19px] leading-relaxed"
              style={{ color: 'rgba(255,248,240,0.85)' }}
            >
              Somos una tienda de vapers en el corazón del <strong>Parque Alcosa</strong>.
              Madre e hijos emprendiendo juntos desde el primer día, con la ilusión
              de ofrecerte el mejor producto y el trato más cercano.
            </p>
            <p
              className="text-[15px] md:text-[16px] leading-relaxed"
              style={{ color: 'rgba(255,248,240,0.65)' }}
            >
              Creemos que vapear no es fumar. Es una herramienta real para quienes
              de verdad quieren dejar el tabaco.
            </p>
            <div
              className="pt-4 inline-flex items-center gap-3 text-[10px] tracking-[0.25em] uppercase"
              style={{ color: 'var(--color-lime)', fontWeight: 700 }}
            >
              <span
                className="inline-block w-8 h-px"
                style={{ background: 'var(--color-lime)' }}
              />
              Tienda Oficial OXVA · No.061
            </div>
          </div>
        </div>

        <div className="col-span-12 md:col-span-4 md:pt-24">
          <div className="grid grid-cols-2 md:grid-cols-1 gap-x-6">
            {STATS.map((stat, i) => (
              <Stat key={stat.label} stat={stat} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
