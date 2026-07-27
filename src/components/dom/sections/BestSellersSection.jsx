import { useEffect, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { useGLTF } from '@react-three/drei'
import { supabase } from '../../../lib/supabase.js'
import { getEffectivePrice, getStock } from '../../../lib/stockPricing.js'
import { ProductCard3D } from '../ProductCard3D.jsx'
import { useInView } from '../../../hooks/useInView.js'

const SELECT = `
  id, name, brand, price, sale_price, is_on_sale, stock, image_url,
  categories(name, slug),
  product_variants(price, sale_price, is_primary, is_active, stock)
`

// Modelo generico de vitrina hasta que existan modelos 3D reales por
// producto - lo que cambio (2026-07-27) es que ahora cada tarjeta es un
// producto real (is_featured, con stock) y enlaza a su propia ficha
// real (ver ProductCard3D), en vez de la lista inventada a mano de
// antes que enlazaba solo a categorias. Cuando haya modelos 3D reales
// por producto, alcanza con setear `model` por producto aca.
const PLACEHOLDER_MODEL = '/models/vape.glb'

const FLEX_LAYOUT = [1.4, 1, 1, 0.8]

export const BestSellersSection = () => {
  const rootRef = useRef(null)
  const headingRef = useRef(null)
  const [products, setProducts] = useState(null)
  const [, inView] = useInView('300px', rootRef)

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
        const cards = (data ?? [])
          .filter((p) => getStock(p) > 0)
          .slice(0, 4)
          .map((p) => ({
            id: p.id,
            name: p.name,
            brand: p.brand,
            tag: 'Lo más pedido',
            category: p.categories?.name ?? '',
            price: getEffectivePrice(p),
            model: PLACEHOLDER_MODEL,
          }))
        setProducts(cards)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // El modelo 3D se descarga solo cuando la seccion esta por aparecer
  // en el scroll (useInView, con margen de adelanto) - no antes, en
  // cualquier dispositivo capaz de mostrarlo.
  useEffect(() => {
    if (inView) useGLTF.preload(PLACEHOLDER_MODEL)
  }, [inView])

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

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 items-stretch">
          {(products ?? []).map((product, i) => (
            <ProductCard3D
              key={product.id}
              product={product}
              flex={FLEX_LAYOUT[i] ?? 1}
              active={inView}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
