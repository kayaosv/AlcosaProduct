import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

const CARDS = [
  {
    num: '01',
    title: 'Desechables',
    kicker: 'Usa y disfruta',
    copy: 'Los mejores desechables de las marcas líderes del mercado.',
    href: '/catalog?cat=vapers-desechables',
  },
  {
    num: '02',
    title: 'Vapers',
    kicker: 'Dispositivos & Mods',
    copy: 'Kits completos para todos los niveles de experiencia.',
    href: '/catalog?cat=vapers',
  },
  {
    num: '03',
    title: 'Longfill',
    kicker: 'DIY concentrados',
    copy: 'Concentrados premium para preparar tu mezcla perfecta.',
    href: '/catalog?cat=longfill',
  },
  {
    num: '04',
    title: 'Sales',
    kicker: 'Nic Salts',
    copy: 'Sales de nicotina de absorción rápida y sabor intenso.',
    href: '/catalog?cat=sales-de-nicotina',
  },
  {
    num: '05',
    title: 'Alquimia',
    kicker: 'DIY & Bases',
    copy: 'Todo lo que necesitas para crear tus propios líquidos.',
    href: '/catalog?cat=alquimia',
  },
  {
    num: '06',
    title: 'Accesorios',
    kicker: 'Resistencias & más',
    copy: 'Resistencias, baterías, algodón y todo el mantenimiento.',
    href: '/catalog?cat=accesorios',
  },
]

// Asymmetric placements — full Tailwind class strings (no interpolation, JIT-safe)
const LAYOUT = [
  'col-span-12 md:col-start-1 md:col-span-7',                              // 01 wide left
  'col-span-12 md:col-start-9 md:col-span-4 mt-16 md:mt-32',               // 02 narrow right, offset
  'col-span-12 md:col-start-2 md:col-span-5 mt-8 md:mt-12',                // 03 mid indent
  'col-span-12 md:col-start-8 md:col-span-5 mt-24 md:mt-40',               // 04 right big offset
  'col-span-12 md:col-start-1 md:col-span-6 mt-12 md:mt-20',               // 05 left half
  'col-span-12 md:col-start-8 md:col-span-4 mt-16 md:mt-24',               // 06 right narrow
]

const Card = ({ card, layout }) => {
  const ref = useRef(null)
  const numRef = useRef(null)
  const { contextSafe } = useGSAP({ scope: ref })

  const onEnter = contextSafe(() => {
    gsap.to(numRef.current, {
      x: 12,
      opacity: 0.35,
      duration: 0.5,
      ease: 'power3.out',
    })
  })
  const onLeave = contextSafe(() => {
    gsap.to(numRef.current, {
      x: 0,
      opacity: 0.12,
      duration: 0.5,
      ease: 'power3.out',
    })
  })

  return (
    <Link
      ref={ref}
      to={card.href}
      data-cursor="link"
      data-anim="product-card"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className={`group relative block ${layout}`}
      style={{ borderTop: '1px solid rgba(23,45,109,0.18)' }}
    >
      <span
        ref={numRef}
        aria-hidden
        className="absolute right-0 top-0 leading-none pointer-events-none select-none"
        style={{
          fontSize: 'clamp(5rem, 11vw, 11rem)',
          fontWeight: 900,
          color: 'var(--color-navy)',
          opacity: 0.12,
          letterSpacing: '-0.05em',
          transform: 'translateY(-0.18em)',
        }}
      >
        {card.num}
      </span>

      <div className="relative pt-6 pb-10 md:pt-8 md:pb-16 pr-24 md:pr-32">
        <span
          className="text-[10px] tracking-[0.3em] uppercase"
          style={{ color: 'var(--color-blue)' }}
        >
          {card.kicker}
        </span>
        <h3
          className="mt-3 leading-[0.9]"
          style={{
            fontSize: 'clamp(2.2rem, 4.5vw, 4rem)',
            fontWeight: 900,
            color: 'var(--color-navy)',
            letterSpacing: '-0.03em',
          }}
        >
          {card.title}.
        </h3>
        <p
          className="mt-4 max-w-md text-[14px] md:text-[15px] leading-relaxed"
          style={{ color: 'rgba(23,45,109,0.7)' }}
        >
          {card.copy}
        </p>
        <span
          className="inline-block mt-6 text-[11px] tracking-[0.25em] uppercase"
          style={{ color: 'var(--color-navy)', fontWeight: 700 }}
        >
          → Ver categoría
        </span>
      </div>
    </Link>
  )
}

export const ProductsOverview = () => {
  const rootRef = useRef(null)

  useGSAP(
    () => {
      gsap.from('[data-anim="po-head"] > *', {
        y: 30,
        opacity: 0,
        stagger: 0.08,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top 75%',
          once: true,
        },
      })

      gsap.from('[data-anim="product-card"]', {
        clipPath: 'inset(0 0 100% 0)',
        y: 40,
        opacity: 0,
        stagger: 0.1,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '[data-anim="product-grid"]',
          start: 'top 80%',
          once: true,
        },
      })
    },
    { scope: rootRef },
  )

  return (
    <section
      ref={rootRef}
      className="relative px-6 md:px-10 py-28 md:py-40 max-w-[1400px] mx-auto"
    >
      <div data-anim="po-head" className="grid grid-cols-12 gap-6 mb-20 md:mb-32">
        <div className="col-span-12 md:col-span-3">
          <span
            className="text-[11px] tracking-[0.3em] uppercase"
            style={{ color: 'var(--color-blue)' }}
          >
            Lo que encontrarás
          </span>
        </div>
        <h2
          className="col-span-12 md:col-span-9 leading-[0.85]"
          style={{
            fontSize: 'clamp(4rem, 13vw, 14rem)',
            fontWeight: 900,
            color: 'var(--color-navy)',
            letterSpacing: '-0.05em',
          }}
        >
          PRODUCTOS<span style={{ color: 'var(--color-lime)' }}>.</span>
        </h2>
        <p
          className="col-span-12 md:col-start-4 md:col-span-6 mt-6 text-[16px] md:text-[18px] leading-relaxed"
          style={{ color: 'rgba(23,45,109,0.7)' }}
        >
          Stock renovado constantemente con las mejores marcas del mercado.
        </p>
      </div>

      <div data-anim="product-grid" className="grid grid-cols-12 gap-x-6">
        {CARDS.map((card, i) => (
          <Card key={card.num} card={card} layout={LAYOUT[i]} />
        ))}
      </div>
    </section>
  )
}
