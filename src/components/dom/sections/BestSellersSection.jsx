import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { supabase } from '../../../lib/supabase.js'
import { getEffectivePrice, getStock } from '../../../lib/stockPricing.js'

const formatPrice = (n) => `${Number(n).toFixed(2)}€`

const SELECT = `
  id, name, brand, price, sale_price, is_on_sale, stock, image_url,
  categories(name, slug),
  product_variants(price, sale_price, is_primary, is_active, stock)
`

const FLEX_LAYOUT = [1.4, 1, 1, 0.8]

// Antes esta seccion mostraba 4 productos inventados a mano
// (config/bestSellers.js) con un visor 3D generico repetido - ningun
// producto del catalogo real tiene modelo 3D, asi que ese enlace
// nunca llevaba a una ficha real. Ahora trae productos reales
// (is_featured=true, con stock) y cada tarjeta enlaza a su propia
// ficha de producto real, con su foto real.
const BestSellerCard = ({ product, flex = 1 }) => {
  const rootRef = useRef(null)
  const ctaRef = useRef(null)
  const { contextSafe } = useGSAP({ scope: rootRef })

  const onEnter = contextSafe(() => {
    gsap.to(rootRef.current, { scale: 1.02, duration: 0.4, ease: 'power2.out' })
    gsap.to(ctaRef.current, { color: 'var(--color-lime)', duration: 0.3 })
  })
  const onLeave = contextSafe(() => {
    gsap.to(rootRef.current, { scale: 1, duration: 0.4, ease: 'power2.out' })
    gsap.to(ctaRef.current, { color: 'var(--color-cream)', duration: 0.3 })
  })

  const price = getEffectivePrice(product)

  return (
    <Link
      to={`/product/${product.id}`}
      ref={rootRef}
      data-anim="bs-card"
      data-cursor="link"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="bs-card relative flex flex-col overflow-hidden"
      style={{
        '--bs-flex': flex,
        background: 'var(--color-navy)',
        minWidth: 0,
        willChange: 'transform',
      }}
    >
      <div style={{ width: '100%', height: 300, position: 'relative', background: 'var(--color-dark)' }}>
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ color: 'var(--color-lime)' }}
          >
            <span style={{ fontWeight: 900, fontSize: 32 }}>
              {(product.brand || product.name || 'V').slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 p-6 pt-4 border-t border-white/5">
        <span
          className="text-[10px] tracking-[0.3em] uppercase"
          style={{ color: 'var(--color-lime)', fontWeight: 700 }}
        >
          Lo más pedido
        </span>

        <h3
          className="font-sans"
          style={{
            fontWeight: 700,
            fontSize: '20px',
            color: 'var(--color-cream)',
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
          }}
        >
          {product.name}
        </h3>

        <span
          className="text-[11px] tracking-[0.25em] uppercase"
          style={{ color: 'var(--color-blue)' }}
        >
          {product.categories?.name}
        </span>

        <div className="flex items-end justify-between mt-3">
          <span
            style={{
              color: 'var(--color-lime)',
              fontWeight: 700,
              fontSize: '22px',
              letterSpacing: '-0.02em',
            }}
          >
            {formatPrice(price)}
          </span>

          <span
            ref={ctaRef}
            className="text-[11px] tracking-[0.25em] uppercase"
            style={{ color: 'var(--color-cream)', fontWeight: 700 }}
          >
            Ver producto →
          </span>
        </div>
      </div>
    </Link>
  )
}

export const BestSellersSection = () => {
  const rootRef = useRef(null)
  const headingRef = useRef(null)
  const [products, setProducts] = useState(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('products')
      .select(SELECT)
      .eq('is_featured', true)
      .eq('is_active', true)
      .limit(8)
      .then(({ data }) => {
        if (cancelled) return
        const inStock = (data ?? []).filter((p) => getStock(p) > 0).slice(0, 4)
        setProducts(inStock)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useGSAP(
    () => {
      if (!products || products.length === 0) return
      gsap.registerPlugin(SplitText, ScrollTrigger)

      const split = new SplitText(headingRef.current, { type: 'chars' })

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top 50%',
          once: true,
        },
      })

      tl.from('[data-anim="bs-kicker"]', {
        y: 20,
        opacity: 0,
        duration: 0.5,
        ease: 'power3.out',
      })
        .from(
          split.chars,
          {
            yPercent: 110,
            opacity: 0,
            stagger: 0.025,
            duration: 0.6,
            ease: 'power4.out',
          },
          '-=0.1',
        )
        .from(
          '[data-anim="bs-card"]',
          {
            y: 80,
            opacity: 0,
            rotateX: 18,
            transformPerspective: 900,
            stagger: 0.1,
            duration: 0.9,
            ease: 'power4.out',
          },
          '-=0.1',
        )

      return () => split.revert()
    },
    { scope: rootRef, dependencies: [products] },
  )

  // Sin productos destacados con stock real todavia - no mostrar una
  // seccion "Best Sellers" vacia o con datos falsos.
  if (products !== null && products.length === 0) return null

  return (
    <section
      ref={rootRef}
      data-section="best-sellers"
      data-nav-theme="dark"
      data-transition-type="none"
      data-transition-color="#172D6D"
      className="relative w-full py-32 md:py-40"
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
                fontSize: 'clamp(2.25rem, 8vw, 10rem)',
                fontWeight: 900,
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

        <div data-anim="best-sellers-grid" className="flex flex-col lg:flex-row gap-4 lg:gap-5 items-stretch">
          {(products ?? []).map((product, i) => (
            <BestSellerCard
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
