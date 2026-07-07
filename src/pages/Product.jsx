import { Suspense, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Environment, useGLTF } from '@react-three/drei'
import { useProduct } from '../hooks/useProduct.js'
import { useCartStore } from '../stores/useCartStore.js'
import { useAppStore } from '../stores/useAppStore.js'

const formatPrice = (n) => `${Number(n).toFixed(2)}€`

const SPEC_LABELS = {
  'sales-de-nicotina': [
    ['size', 'Tamaño'],
    ['nicotine', 'Nicotina'],
    ['flavor', 'Sabor'],
  ],
  longfill: [
    ['volume', 'Volumen'],
    ['flavor', 'Sabor'],
  ],
  vapers: [
    ['battery', 'Batería'],
    ['power', 'Potencia'],
  ],
  'vapers-desechables': [
    ['puffs', 'Caladas'],
    ['nicotine', 'Nicotina'],
  ],
}

const Specs = ({ slug, details }) => {
  const config = SPEC_LABELS[slug]
  const entries = config
    ? config
        .map(([key, label]) => [label, details?.[key]])
        .filter(([, v]) => v != null && v !== '')
    : Object.entries(details || {}).slice(0, 6)
  if (entries.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-y-3 gap-x-6 mt-8 py-6 border-y" style={{ borderColor: 'rgba(23,45,109,0.15)' }}>
      {entries.map(([label, value]) => (
        <div key={label} data-anim="spec">
          <span className="block text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(23,45,109,0.5)' }}>
            {label}
          </span>
          <span className="block text-[13px] mt-1" style={{ fontWeight: 600 }}>
            {String(value)}
          </span>
        </div>
      ))}
    </div>
  )
}

const ProductVape = () => {
  const ref = useRef(null)
  const { scene } = useGLTF('/models/vape.glb')
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.y += d * 0.4
  })
  return (
    <Float floatIntensity={0.3} speed={1}>
      <primitive ref={ref} object={scene.clone()} scale={2.2} />
    </Float>
  )
}

const ProductCanvas = () => (
  <Canvas
    dpr={[1, 1.5]}
    gl={{ antialias: true, alpha: true }}
    camera={{ position: [0, 0, 5], fov: 35 }}
    className="!absolute inset-0 pointer-events-none"
    style={{ zIndex: 0 }}
  >
    <ambientLight intensity={0.5} />
    <directionalLight position={[3, 4, 3]} intensity={1} color="#C6F91F" />
    <directionalLight position={[-3, -2, 2]} intensity={0.5} color="#5B8EE8" />
    <Suspense fallback={null}>
      <ProductVape />
    </Suspense>
    <Environment preset="studio" />
  </Canvas>
)

export const Product = () => {
  const { id } = useParams()
  const containerRef = useRef(null)
  const titleRef = useRef(null)
  const buttonRef = useRef(null)
  const { product, loading } = useProduct(id)
  const addItem = useCartStore((s) => s.addItem)
  const setCartOpen = useAppStore((s) => s.setCartOpen)

  useGSAP(
    () => {
      if (loading || !product) return

      const tl = gsap.timeline()

      tl.from('[data-anim="image"]', {
        clipPath: 'inset(100% 0 0 0)',
        duration: 1.1,
        ease: 'power4.out',
      })

      if (titleRef.current) {
        const split = new SplitText(titleRef.current, { type: 'chars' })
        tl.from(
          split.chars,
          {
            yPercent: 110,
            opacity: 0,
            stagger: 0.025,
            duration: 0.7,
            ease: 'power4.out',
          },
          '-=0.85',
        )
      }

      tl.from(
        '[data-anim="text"]',
        {
          y: 30,
          opacity: 0,
          stagger: 0.07,
          duration: 0.7,
          ease: 'power3.out',
        },
        '-=0.5',
      )
      tl.from(
        '[data-anim="spec"]',
        {
          y: 16,
          opacity: 0,
          stagger: 0.05,
          duration: 0.5,
          ease: 'power3.out',
        },
        '-=0.4',
      )
    },
    { scope: containerRef, dependencies: [loading, product?.id] },
  )

  const handleAdd = () => {
    if (!product || product.stock === 0) return
    const price = product.is_on_sale && product.sale_price != null ? product.sale_price : product.price
    addItem({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      price: Number(price),
      image_url: product.image_url,
      quantity: 1,
    })
    gsap
      .timeline()
      .to(buttonRef.current, { scale: 0.95, duration: 0.1 })
      .to(buttonRef.current, { scale: 1.05, duration: 0.2, ease: 'elastic.out(1, 0.4)' })
      .to(buttonRef.current, { scale: 1, duration: 0.15 })
    setCartOpen(true)
  }

  if (loading) {
    return (
      <main className="min-h-screen pt-32 px-6 md:px-10">
        <p className="text-[12px] tracking-[0.2em] uppercase opacity-60">Cargando producto…</p>
      </main>
    )
  }

  if (!product) {
    return (
      <main className="min-h-screen pt-32 px-6 md:px-10">
        <p className="text-[14px] tracking-[0.2em] uppercase">Producto no encontrado.</p>
        <Link
          to="/catalog"
          data-cursor="link"
          className="inline-block mt-6 text-[12px] tracking-[0.2em] uppercase"
          style={{ color: 'var(--color-navy)', textDecoration: 'underline' }}
        >
          ← Volver al catálogo
        </Link>
      </main>
    )
  }

  const out = product.stock === 0
  const low = product.stock > 0 && product.stock < 5
  const slug = product.categories?.slug
  const showCanvas = slug === 'vapers' || slug === 'vapers-desechables'
  const finalPrice =
    product.is_on_sale && product.sale_price != null ? product.sale_price : product.price

  return (
    <main ref={containerRef} className="min-h-screen pt-32 pb-24 relative overflow-hidden">
      {showCanvas && (
        <div className="hidden lg:block absolute top-32 right-0 w-[40%] h-[80vh] opacity-30 pointer-events-none">
          <ProductCanvas />
        </div>
      )}

      <div className="px-6 md:px-10 mb-8">
        <Link
          to="/catalog"
          data-cursor="link"
          className="text-[11px] tracking-[0.2em] uppercase"
          style={{ color: 'rgba(23,45,109,0.6)' }}
        >
          ← Catálogo
        </Link>
      </div>

      <div className="px-6 md:px-10 grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-10 lg:gap-16">
        <div
          data-anim="image"
          className="relative overflow-hidden"
          style={{
            aspectRatio: '4/3',
            background: product.image_url ? 'transparent' : 'var(--color-navy)',
          }}
        >
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ color: 'var(--color-cream)', fontWeight: 900, fontSize: '8vw', letterSpacing: '-0.04em' }}
            >
              {(product.brand || product.name || 'V').slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          {product.categories?.name && (
            <span
              data-anim="text"
              className="text-[11px] tracking-[0.2em] uppercase"
              style={{ color: 'var(--color-blue)' }}
            >
              {product.categories.name}
            </span>
          )}
          <h1
            ref={titleRef}
            className="mt-3 leading-none overflow-hidden"
            style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 900,
              color: 'var(--color-navy)',
              letterSpacing: '-0.03em',
            }}
          >
            {product.name}
          </h1>
          {product.brand && (
            <p
              data-anim="text"
              className="mt-3 text-[14px]"
              style={{ fontWeight: 300, color: 'rgba(23,45,109,0.7)' }}
            >
              {product.brand}
            </p>
          )}

          <div data-anim="text" className="mt-6 flex items-end gap-4">
            {product.is_on_sale && product.sale_price != null ? (
              <>
                <span
                  className="line-through text-[14px]"
                  style={{ color: 'rgba(23,45,109,0.5)' }}
                >
                  {formatPrice(product.price)}
                </span>
                <span
                  style={{
                    fontSize: 'var(--text-lg)',
                    fontWeight: 700,
                    background: 'var(--color-lime)',
                    padding: '4px 10px',
                  }}
                >
                  {formatPrice(product.sale_price)}
                </span>
              </>
            ) : (
              <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
                {formatPrice(product.price)}
              </span>
            )}
          </div>

          <div data-anim="text">
            <Specs slug={slug} details={product.details} />
          </div>

          <div data-anim="text" className="mt-6 text-[12px] tracking-[0.18em] uppercase">
            {out ? (
              <span style={{ color: 'var(--color-dark)' }}>Sin stock</span>
            ) : low ? (
              <span style={{ color: 'var(--color-blue)' }}>Últimas unidades</span>
            ) : (
              <span style={{ color: 'rgba(23,45,109,0.7)' }}>
                En stock ({product.stock} uds.)
              </span>
            )}
          </div>

          <div className="add-to-cart-bar mt-8">
            <button
              ref={buttonRef}
              data-anim="text"
              data-cursor="link"
              onClick={handleAdd}
              disabled={out}
              className="w-full lg:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 text-[12px] tracking-[0.2em] uppercase transition-opacity"
              style={{
                background: out ? 'rgba(23,45,109,0.2)' : 'var(--color-navy)',
                color: out ? 'rgba(23,45,109,0.5)' : 'var(--color-lime)',
                fontWeight: 700,
                cursor: out ? 'not-allowed' : undefined,
              }}
            >
              ▸ {out ? 'No disponible' : 'Agregar al carrito'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
