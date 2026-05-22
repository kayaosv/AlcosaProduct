import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useProducts } from '../hooks/useProducts.js'
import { useCategories } from '../hooks/useCategories.js'
import { ProductCard } from '../components/dom/ProductCard.jsx'

const CategoryPill = ({ active, label, onClick }) => {
  const ref = useRef(null)
  const markerRef = useRef(null)
  const labelRef = useRef(null)
  const { contextSafe } = useGSAP(
    () => {
      gsap.to(markerRef.current, {
        scaleX: active ? 1 : 0,
        transformOrigin: active ? 'left center' : 'right center',
        duration: 0.45,
        ease: active ? 'power3.out' : 'power3.in',
      })
      gsap.to(labelRef.current, {
        fontWeight: active ? 700 : 400,
        duration: 0.25,
        ease: 'none',
      })
    },
    { dependencies: [active], scope: ref },
  )

  const onEnter = contextSafe(() => {
    if (active) return
    gsap.to(markerRef.current, {
      scaleX: 0.25,
      duration: 0.4,
      ease: 'power3.out',
      transformOrigin: 'left center',
    })
    gsap.to(ref.current, { y: -2, duration: 0.3, ease: 'power2.out' })
  })
  const onLeave = contextSafe(() => {
    if (active) return
    gsap.to(markerRef.current, {
      scaleX: 0,
      duration: 0.3,
      ease: 'power3.in',
      transformOrigin: 'right center',
    })
    gsap.to(ref.current, { y: 0, duration: 0.3, ease: 'power2.out' })
  })

  return (
    <button
      ref={ref}
      onClick={onClick}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      data-cursor="link"
      className="relative px-5 py-2 text-[11px] tracking-[0.2em] uppercase overflow-hidden"
      style={{
        background: 'transparent',
        color: 'var(--color-navy)',
        border: '1px solid var(--color-navy)',
      }}
    >
      <span
        ref={markerRef}
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'var(--color-lime)',
          transform: 'scaleX(0)',
          transformOrigin: 'left center',
        }}
      />
      <span ref={labelRef} className="relative">
        {label}
      </span>
    </button>
  )
}

const Skeleton = () => (
  <div
    className="relative overflow-hidden"
    style={{ aspectRatio: '4/5', background: 'rgba(23,45,109,0.05)' }}
  >
    <div
      className="absolute inset-0"
      style={{
        background:
          'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
        animation: 'shimmer 1.6s infinite',
      }}
    />
  </div>
)

export const Catalog = () => {
  const containerRef = useRef(null)
  const [params, setParams] = useSearchParams()
  const initialCat = params.get('cat') || 'all'
  const [activeCat, setActiveCat] = useState(initialCat)
  const [search] = useState('')

  const { categories } = useCategories()
  const { products, total, loading } = useProducts({
    categorySlug: activeCat,
    search,
    page: 1,
    pageSize: 24,
  })

  const handleSelect = (slug) => {
    setActiveCat(slug)
    if (slug === 'all') setParams({})
    else setParams({ cat: slug })
  }

  useGSAP(
    () => {
      gsap.from('[data-anim="header"]', {
        y: 40,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
      })
      gsap.from('[data-anim="pill"]', {
        y: 20,
        opacity: 0,
        stagger: 0.05,
        delay: 0.2,
        duration: 0.5,
        ease: 'power2.out',
      })
    },
    { scope: containerRef },
  )

  useGSAP(
    () => {
      if (loading) return
      gsap.from('[data-anim="card"]', {
        y: 30,
        opacity: 0,
        stagger: 0.05,
        duration: 0.6,
        ease: 'power3.out',
      })
    },
    { scope: containerRef, dependencies: [loading, activeCat] },
  )

  const grid = useMemo(() => products, [products])

  return (
    <main ref={containerRef} className="min-h-screen pt-32 pb-24">
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .cat-grid {
          display: grid;
          grid-template-columns: 1fr 1.5fr 1fr;
          gap: 2rem 1.5rem;
        }
        @media (max-width: 900px) {
          .cat-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 540px) {
          .cat-grid { grid-template-columns: 1fr; }
          .cat-grid > [data-span-wide] { grid-column: auto !important; }
        }
      `}</style>

      <header className="px-6 md:px-10 mb-12" data-anim="header">
        <h1
          className="leading-none"
          style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 900,
            letterSpacing: '-0.04em',
            color: 'var(--color-navy)',
          }}
        >
          TIENDA
        </h1>
        <p
          className="text-[12px] tracking-[0.2em] uppercase mt-2"
          style={{ color: 'rgba(23,45,109,0.6)' }}
        >
          {loading ? 'Cargando…' : `${total} resultado${total === 1 ? '' : 's'}`}
        </p>
      </header>

      <div className="px-6 md:px-10 mb-10 flex flex-wrap gap-3">
        <div data-anim="pill">
          <CategoryPill
            active={activeCat === 'all'}
            label="Todos"
            onClick={() => handleSelect('all')}
          />
        </div>
        {categories.map((c) => (
          <div key={c.id} data-anim="pill">
            <CategoryPill
              active={activeCat === c.slug}
              label={c.name}
              onClick={() => handleSelect(c.slug)}
            />
          </div>
        ))}
      </div>

      <section className="px-6 md:px-10">
        {loading ? (
          <div className="cat-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} />
            ))}
          </div>
        ) : grid.length === 0 ? (
          <div className="py-20 text-center">
            <p
              className="text-[14px] tracking-[0.2em] uppercase"
              style={{ color: 'rgba(23,45,109,0.6)' }}
            >
              No hay productos en esta categoría.
            </p>
          </div>
        ) : (
          <div className="cat-grid">
            {grid.map((p, i) => (
              <div
                key={p.id}
                data-anim="card"
                data-span-wide={i % 5 === 2 ? '' : undefined}
                style={{ gridColumn: i % 5 === 2 ? 'span 2' : undefined }}
              >
                <ProductCard product={p} span={i % 5 === 2 ? 2 : 1} />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
