import { Suspense, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import gsap from 'gsap'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Environment, useGLTF } from '@react-three/drei'
import { useProduct } from '../hooks/useProduct.js'
import { useProductVariants } from '../hooks/useProductVariants.js'
import { useCartStore } from '../stores/useCartStore.js'
import { useAppStore } from '../stores/useAppStore.js'
import { categoryVariantType, VARIANT_LABELS } from '../lib/productSpecs.js'
import { ProductSuggestions } from '../components/dom/ProductSuggestions.jsx'
import { PromoTiers } from '../components/dom/PromoTiers.jsx'

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
        <div key={label}>
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

const resolvePrice = (v) => (v?.sale_price ?? v?.price ?? null)

const VariantPicker = ({ variantType, variants, selectedId, onSelect }) => (
  <div className="mt-6">
    <span
      className="block text-[10px] tracking-[0.2em] uppercase mb-3"
      style={{ color: 'rgba(23,45,109,0.5)' }}
    >
      {VARIANT_LABELS[variantType] ?? 'Variante'}
    </span>
    <div className="flex flex-wrap gap-2">
      {variants.map((v) => {
        const isSelected = v.id === selectedId
        const isOut = v.stock === 0
        return (
          <button
            key={v.id}
            type="button"
            data-cursor="link"
            onClick={() => onSelect(v.id)}
            className="inline-flex items-center gap-2 px-4 py-2 text-[12px]"
            style={{
              border: `1px solid ${isSelected ? 'var(--color-navy)' : 'rgba(23,45,109,0.25)'}`,
              background: isSelected ? 'var(--color-navy)' : 'transparent',
              color: isOut ? 'rgba(23,45,109,0.4)' : isSelected ? 'var(--color-lime)' : 'var(--color-navy)',
              fontWeight: 700,
              textDecoration: isOut ? 'line-through' : 'none',
            }}
          >
            {variantType === 'color' && v.hex && (
              <span
                aria-hidden
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: v.hex,
                  border: '1px solid rgba(0,0,0,0.15)',
                  flexShrink: 0,
                }}
              />
            )}
            {v.label}
            {isOut && <span style={{ fontWeight: 400, fontSize: '10px' }}>· agotado</span>}
          </button>
        )
      })}
    </div>
  </div>
)

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
  const buttonRef = useRef(null)
  const { product, loading } = useProduct(id)
  const { variants } = useProductVariants(product?.id)
  const [selectedVariantId, setSelectedVariantId] = useState(null)
  const addItem = useCartStore((s) => s.addItem)
  const setCartOpen = useAppStore((s) => s.setCartOpen)

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

  const slug = product.categories?.slug
  const variantType = categoryVariantType(slug)
  const hasVariants = variantType && variants.length > 0

  // Self-healing: if the picked id doesn't belong to the current
  // product's variants (e.g. just navigated here), fall back to the
  // primary one instead of needing an effect to reset selection.
  const primaryVariant = variants.find((v) => v.is_primary) ?? variants[0] ?? null
  const selectedVariant = hasVariants
    ? (variants.find((v) => v.id === selectedVariantId) ?? primaryVariant)
    : null

  const baseEffectivePrice =
    product.is_on_sale && product.sale_price != null ? product.sale_price : product.price

  const finalPrice = hasVariants
    ? (resolvePrice(selectedVariant) ?? resolvePrice(primaryVariant) ?? baseEffectivePrice)
    : baseEffectivePrice

  const hasOwnSale = hasVariants && selectedVariant?.sale_price != null
  const strikePrice = hasVariants
    ? (hasOwnSale ? (selectedVariant.price ?? primaryVariant?.price ?? product.price) : null)
    : (product.is_on_sale && product.sale_price != null ? product.price : null)

  const effectiveStock = hasVariants ? selectedVariant.stock : product.stock
  const out = effectiveStock === 0
  const low = effectiveStock > 0 && effectiveStock < 5
  const showCanvas = slug === 'vapers' || slug === 'vapers-desechables'

  const handleAdd = () => {
    if (out) return
    addItem({
      productId: product.id,
      categorySlug: slug,
      variantId: hasVariants ? selectedVariant.id : null,
      variantLabel: hasVariants ? selectedVariant.label : null,
      name: product.name,
      brand: product.brand,
      price: Number(finalPrice),
      image_url: (hasVariants && selectedVariant.image_url) || product.image_url,
      quantity: 1,
    })
    gsap
      .timeline()
      .to(buttonRef.current, { scale: 0.95, duration: 0.1 })
      .to(buttonRef.current, { scale: 1.05, duration: 0.2, ease: 'elastic.out(1, 0.4)' })
      .to(buttonRef.current, { scale: 1, duration: 0.15 })
    setCartOpen(true)
  }

  return (
    <main className="min-h-screen pt-32 pb-24 relative overflow-hidden">
      {showCanvas && (
        // z-index negativo a proposito: sin esto, un elemento
        // position:absolute (aunque tenga z-index:auto) se pinta por
        // encima de todo el contenido position:static del grid de
        // abajo (imagen + selector de variantes), sin importar el
        // orden en el DOM - eso tapaba visualmente los botones de
        // variante en pantallas lg+ (PC), donde este canvas decorativo
        // se muestra (en tablet, bajo el breakpoint lg, ni aparece).
        <div
          className="hidden lg:block absolute top-32 right-0 w-[40%] h-[80vh] opacity-30 pointer-events-none"
          style={{ zIndex: -1 }}
        >
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

      <div className="px-6 md:px-10 grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-10 md:gap-16">
        <div
          className="product-image-frame relative overflow-hidden"
          style={{
            background: product.image_url ? 'transparent' : 'var(--color-navy)',
          }}
        >
          {(hasVariants && selectedVariant.image_url) || product.image_url ? (
            <img
              src={(hasVariants && selectedVariant.image_url) || product.image_url}
              alt={product.name}
              fetchPriority="high"
              className="w-full h-full object-cover"
            />
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
              className="text-[11px] tracking-[0.2em] uppercase"
              style={{ color: 'var(--color-blue)' }}
            >
              {product.categories.name}
            </span>
          )}
          <h1
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
              className="mt-3 text-[14px]"
              style={{ fontWeight: 300, color: 'rgba(23,45,109,0.7)' }}
            >
              {product.brand}
            </p>
          )}

          <div className="mt-6 flex items-end gap-4">
            {strikePrice != null ? (
              <>
                <span
                  className="line-through text-[14px]"
                  style={{ color: 'rgba(23,45,109,0.5)' }}
                >
                  {formatPrice(strikePrice)}
                </span>
                <span
                  style={{
                    fontSize: 'var(--text-lg)',
                    fontWeight: 700,
                    background: 'var(--color-lime)',
                    padding: '4px 10px',
                  }}
                >
                  {formatPrice(finalPrice)}
                </span>
              </>
            ) : (
              <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
                {formatPrice(finalPrice)}
              </span>
            )}
          </div>

          {slug === 'vapers-desechables' && (
            <PromoTiers basePrice={finalPrice} tiers={product.categories?.promo_tiers} />
          )}

          {hasVariants && (
            <VariantPicker
              variantType={variantType}
              variants={variants}
              selectedId={selectedVariant.id}
              onSelect={setSelectedVariantId}
            />
          )}

          <Specs slug={slug} details={product.details} />

          <div className="mt-6 text-[12px] tracking-[0.18em] uppercase">
            {out ? (
              <span style={{ color: 'var(--color-dark)' }}>Sin stock</span>
            ) : low ? (
              <span style={{ color: 'var(--color-blue)' }}>Últimas unidades</span>
            ) : (
              <span style={{ color: 'rgba(23,45,109,0.7)' }}>
                En stock ({effectiveStock} uds.)
              </span>
            )}
          </div>

          <div className="add-to-cart-bar mt-8">
            <button
              ref={buttonRef}
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

      <div className="px-6 md:px-10 mt-16">
        <ProductSuggestions productId={product.id} categorySlug={slug} />
      </div>
    </main>
  )
}
