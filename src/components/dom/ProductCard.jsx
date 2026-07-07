import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useCartStore } from '../../stores/useCartStore.js'
import { useAppStore } from '../../stores/useAppStore.js'

const formatPrice = (n) => `${Number(n).toFixed(2)}€`

const Placeholder = ({ brand }) => {
  const initials = (brand || 'V').slice(0, 2).toUpperCase()
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{
        background: 'var(--color-navy)',
        color: 'var(--color-cream)',
        fontWeight: 900,
        fontSize: '4vw',
        letterSpacing: '-0.04em',
      }}
    >
      {initials}
    </div>
  )
}

export const ProductCard = ({ product, span = 1 }) => {
  const cardRef = useRef(null)
  const imageRef = useRef(null)
  const outOfStock = product.stock === 0
  const addItem = useCartStore((s) => s.addItem)
  const setCartOpen = useAppStore((s) => s.setCartOpen)

  const { contextSafe } = useGSAP({ scope: cardRef })

  const onEnter = contextSafe(() => {
    gsap.to(cardRef.current, { scale: 1.02, duration: 0.4, ease: 'power2.out' })
    gsap.to(imageRef.current, { scale: 1.08, duration: 0.6, ease: 'power2.out' })
  })

  const onLeave = contextSafe(() => {
    gsap.to(cardRef.current, { scale: 1, duration: 0.4, ease: 'power2.out' })
    gsap.to(imageRef.current, { scale: 1, duration: 0.6, ease: 'power2.out' })
  })

  const handleQuickAdd = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (outOfStock) return
    const price = product.is_on_sale && product.sale_price != null ? product.sale_price : product.price
    addItem({
      productId: product.id,
      categorySlug: product.categories?.slug ?? null,
      name: product.name,
      brand: product.brand,
      price: Number(price),
      image_url: product.image_url,
      quantity: 1,
    })
    setCartOpen(true)
  }

  return (
    <Link
      to={`/product/${product.id}`}
      data-cursor="link"
      ref={cardRef}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="block group"
      style={{
        gridColumn: span === 2 ? 'span 2' : undefined,
        opacity: outOfStock ? 0.5 : 1,
      }}
    >
      <div
        className="relative overflow-hidden"
        style={{
          aspectRatio: span === 2 ? '16/9' : '4/5',
          background: 'var(--color-cream)',
          border: '1px solid rgba(23,45,109,0.08)',
        }}
      >
        <div ref={imageRef} className="absolute inset-0">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <Placeholder brand={product.brand} />
          )}
        </div>

        {outOfStock && (
          <span
            className="absolute top-3 left-3 text-[10px] tracking-[0.18em] uppercase px-2 py-1"
            style={{ background: 'var(--color-dark)', color: 'var(--color-cream)' }}
          >
            Sin stock
          </span>
        )}
        {product.is_on_sale && !outOfStock && (
          <span
            className="absolute top-3 right-3 text-[10px] tracking-[0.18em] uppercase px-2 py-1"
            style={{ background: 'var(--color-lime)', color: 'var(--color-navy)', fontWeight: 700 }}
          >
            Oferta
          </span>
        )}

        {!outOfStock && (
          <button
            type="button"
            onClick={handleQuickAdd}
            data-cursor="link"
            aria-label={`Añadir ${product.name} al carrito`}
            className="quick-add-btn absolute bottom-3 right-3 flex items-center justify-center"
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--color-lime)',
              color: 'var(--color-navy)',
              fontWeight: 900,
              fontSize: 22,
              lineHeight: 1,
              boxShadow: '0 2px 10px rgba(23,45,109,0.3)',
            }}
          >
            +
          </button>
        )}
      </div>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          {product.categories?.name && (
            <span
              className="text-[10px] tracking-[0.2em] uppercase block mb-1"
              style={{ color: 'var(--color-blue)' }}
            >
              {product.categories.name}
            </span>
          )}
          <h3
            className="text-[15px] leading-tight truncate"
            style={{ fontWeight: 700, color: 'var(--color-navy)' }}
          >
            {product.name}
          </h3>
          {product.brand && (
            <p className="text-[12px] mt-0.5" style={{ color: 'rgba(23,45,109,0.6)' }}>
              {product.brand}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          {product.is_on_sale && product.sale_price != null ? (
            <>
              <span
                className="text-[11px] block line-through"
                style={{ color: 'rgba(23,45,109,0.5)' }}
              >
                {formatPrice(product.price)}
              </span>
              <span
                className="text-[15px] block"
                style={{ fontWeight: 900, color: 'var(--color-navy)', background: 'var(--color-lime)', padding: '2px 6px' }}
              >
                {formatPrice(product.sale_price)}
              </span>
            </>
          ) : (
            <span className="text-[15px]" style={{ fontWeight: 700 }}>
              {formatPrice(product.price)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
