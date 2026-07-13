import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useCartStore } from '../stores/useCartStore.js'

const formatPrice = (n) => `${Number(n).toFixed(2)}€`

const EmptyState = () => (
  <div className="mt-24 max-w-xl">
    <p
      className="text-[11px] tracking-[0.25em] uppercase"
      style={{ color: 'var(--color-blue)' }}
    >
      Sin pedidos en curso
    </p>
    <h2
      className="mt-4 leading-[0.95]"
      style={{ fontSize: 'var(--text-xl)', fontWeight: 900, color: 'var(--color-navy)', letterSpacing: '-0.03em' }}
    >
      Tu carrito está vacío.
    </h2>
    <p className="mt-6 text-[15px] max-w-md" style={{ color: 'rgba(23,45,109,0.7)' }}>
      Échale un vistazo al catálogo y añade lo que necesites. Recogida en tienda física, Parque Alcosa.
    </p>
    <Link
      to="/catalog"
      data-cursor="link"
      className="inline-flex items-center gap-3 mt-10 px-8 py-4 text-[12px] tracking-[0.2em] uppercase"
      style={{ background: 'var(--color-navy)', color: 'var(--color-lime)', fontWeight: 700 }}
    >
      ▸ Ir al catálogo
    </Link>
  </div>
)

const CartRow = ({ item, onMinus, onPlus, onRemove }) => (
  <li
    className="grid grid-cols-[80px_1fr_auto_auto] gap-6 py-6 items-center"
    style={{ borderTop: '1px solid rgba(23,45,109,0.12)' }}
  >
    <div
      className="w-20 h-24 flex items-center justify-center overflow-hidden"
      style={{ background: 'var(--color-navy)', color: 'var(--color-cream)' }}
    >
      {item.image_url ? (
        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <span style={{ fontWeight: 900, fontSize: '18px' }}>
          {(item.brand || item.name || 'V').slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>

    <div className="min-w-0">
      {item.brand && (
        <p
          className="text-[10px] tracking-[0.2em] uppercase"
          style={{ color: 'var(--color-blue)' }}
        >
          {item.brand}
        </p>
      )}
      <h3
        className="mt-1 text-[16px] leading-tight"
        style={{ fontWeight: 700, color: 'var(--color-navy)' }}
      >
        {item.name}
      </h3>
      {item.variantLabel && (
        <p className="mt-0.5 text-[12px]" style={{ color: 'rgba(23,45,109,0.6)' }}>
          {item.variantLabel}
        </p>
      )}
      <button
        data-cursor="link"
        onClick={onRemove}
        className="mt-3 text-[10px] tracking-[0.2em] uppercase"
        style={{ color: 'rgba(23,45,109,0.5)' }}
      >
        ✕ Quitar
      </button>
    </div>

    <div
      className="inline-flex items-center"
      style={{ border: '1px solid rgba(23,45,109,0.2)' }}
    >
      <button
        data-cursor="link"
        onClick={onMinus}
        className="px-3 py-2 text-[14px]"
        style={{ fontWeight: 700 }}
      >
        −
      </button>
      <span className="px-4 py-2 text-[14px]" style={{ fontWeight: 700 }}>
        {item.quantity}
      </span>
      <button
        data-cursor="link"
        onClick={onPlus}
        className="px-3 py-2 text-[14px]"
        style={{ fontWeight: 700 }}
      >
        +
      </button>
    </div>

    <div className="text-right min-w-[100px]">
      <span className="text-[18px]" style={{ fontWeight: 900, color: 'var(--color-navy)' }}>
        {formatPrice(item.price * item.quantity)}
      </span>
      <p className="text-[11px] mt-1" style={{ color: 'rgba(23,45,109,0.5)' }}>
        {formatPrice(item.price)} × {item.quantity}
      </p>
    </div>
  </li>
)

export const Cart = () => {
  const containerRef = useRef(null)
  const items = useCartStore((s) => s.items)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const clearCart = useCartStore((s) => s.clearCart)

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const count = items.reduce((sum, i) => sum + i.quantity, 0)

  useGSAP(
    () => {
      gsap.from('[data-anim="cart-header"] > *', {
        y: 40,
        opacity: 0,
        stagger: 0.06,
        duration: 0.7,
        ease: 'power3.out',
      })
      if (items.length > 0) {
        gsap.from('[data-anim="cart-row"]', {
          y: 30,
          opacity: 0,
          stagger: 0.06,
          delay: 0.2,
          duration: 0.6,
          ease: 'power3.out',
        })
      }
    },
    { scope: containerRef },
  )

  return (
    <main ref={containerRef} className="min-h-screen pt-32 pb-24 px-6 md:px-10">
      <div data-anim="cart-header" className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <span
            className="text-[11px] tracking-[0.25em] uppercase"
            style={{ color: 'var(--color-blue)' }}
          >
            Tu pedido
          </span>
          <h1
            className="mt-2 leading-[0.9]"
            style={{
              fontSize: 'var(--text-2xl)',
              fontWeight: 900,
              color: 'var(--color-navy)',
              letterSpacing: '-0.04em',
            }}
          >
            CARRITO
          </h1>
        </div>
        <p className="text-[12px] tracking-[0.2em] uppercase" style={{ color: 'rgba(23,45,109,0.6)' }}>
          {count} {count === 1 ? 'artículo' : 'artículos'}
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-12">
          <ul style={{ borderBottom: '1px solid rgba(23,45,109,0.12)' }}>
            {items.map((item) => (
              <div key={`${item.productId}-${item.variantId ?? 'base'}`} data-anim="cart-row">
                <CartRow
                  item={item}
                  onMinus={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                  onPlus={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                  onRemove={() => removeItem(item.productId, item.variantId)}
                />
              </div>
            ))}
          </ul>

          <aside className="lg:sticky lg:top-32 self-start">
            <div
              className="p-8"
              style={{ background: 'var(--color-navy)', color: 'var(--color-cream)' }}
            >
              <h2
                className="text-[11px] tracking-[0.25em] uppercase"
                style={{ color: 'var(--color-blue)' }}
              >
                Resumen
              </h2>

              <div className="mt-6 space-y-3">
                <div className="flex justify-between text-[13px]">
                  <span style={{ opacity: 0.7 }}>Subtotal</span>
                  <span style={{ fontWeight: 700 }}>{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span style={{ opacity: 0.7 }}>Recogida en tienda</span>
                  <span style={{ fontWeight: 700 }}>Gratis</span>
                </div>
              </div>

              <div
                className="mt-6 pt-6 flex justify-between items-end"
                style={{ borderTop: '1px solid rgba(255,248,240,0.15)' }}
              >
                <span className="text-[11px] tracking-[0.2em] uppercase">Total</span>
                <span style={{ fontSize: 'var(--text-lg)', fontWeight: 900, color: 'var(--color-lime)' }}>
                  {formatPrice(total)}
                </span>
              </div>

              <Link
                to="/checkout"
                data-cursor="link"
                className="block w-full text-center mt-8 py-4 text-[12px] tracking-[0.2em] uppercase"
                style={{ background: 'var(--color-lime)', color: 'var(--color-navy)', fontWeight: 900 }}
              >
                ▸ Finalizar pedido
              </Link>

              <button
                onClick={clearCart}
                data-cursor="link"
                className="block w-full mt-3 py-2 text-[10px] tracking-[0.2em] uppercase"
                style={{ color: 'rgba(255,248,240,0.5)' }}
              >
                Vaciar carrito
              </button>
            </div>

            <p
              className="mt-6 text-[11px] leading-relaxed"
              style={{ color: 'rgba(23,45,109,0.55)' }}
            >
              Tienda física en Parque Alcosa. Recogida y pago en local. Te avisamos por
              Instagram cuando el pedido esté listo.
            </p>
          </aside>
        </div>
      )}
    </main>
  )
}
