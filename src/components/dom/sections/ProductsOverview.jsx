import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

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
  const headingRef = useRef(null)

  useGSAP(
    () => {
      gsap.registerPlugin(SplitText, ScrollTrigger)

      const split = new SplitText(headingRef.current, { type: 'chars' })

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top 65%',
          once: true,
        },
      })

      tl.from('[data-anim="po-kicker"]', {
        y: 20,
        opacity: 0,
        duration: 0.55,
        ease: 'power3.out',
      })
        .from(
          split.chars,
          {
            yPercent: 110,
            opacity: 0,
            stagger: { amount: 0.5 },
            duration: 0.65,
            ease: 'power4.out',
          },
          '-=0.2',
        )
        .from(
          '[data-anim="po-desc"]',
          { y: 25, opacity: 0, duration: 0.6, ease: 'power3.out' },
          '-=0.3',
        )

      gsap.utils.toArray('[data-anim="product-card"]').forEach((card) => {
        gsap.from(card, {
          y: 70,
          opacity: 0,
          rotateX: 20,
          transformPerspective: 900,
          duration: 1,
          ease: 'power4.out',
          scrollTrigger: {
            trigger: card,
            start: 'top 85%',
            once: true,
          },
        })
      })

      return () => split.revert()
    },
    { scope: rootRef },
  )

  return (
    <section
      ref={rootRef}
      data-section="products"
      data-transition-type="flash"
      data-transition-color="#172D6D"
      className="relative px-6 md:px-10 py-28 md:py-40 max-w-[1400px] mx-auto"
    >
      <div className="grid grid-cols-12 gap-6 mb-20 md:mb-32">
        <div className="col-span-12 md:col-span-3">
          <span
            data-anim="po-kicker"
            className="text-[11px] tracking-[0.3em] uppercase"
            style={{ color: 'var(--color-blue)' }}
          >
            Lo que encontrarás
          </span>
        </div>
        <h2
          ref={headingRef}
          className="col-span-12 leading-[0.85] overflow-hidden"
          style={{
            fontSize: 'clamp(3.5rem, 12.5vw, 13rem)',
            fontWeight: 900,
            color: 'var(--color-navy)',
            letterSpacing: '-0.05em',
            whiteSpace: 'nowrap',
          }}
        >
          PRODUCTOS<span style={{ color: 'var(--color-lime)' }}>.</span>
        </h2>
        <p
          data-anim="po-desc"
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
