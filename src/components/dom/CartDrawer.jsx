import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { useAppStore } from '../../stores/useAppStore.js'
import { useCartStore } from '../../stores/useCartStore.js'

const formatPrice = (n) => `${Number(n).toFixed(2)}€`

export const CartDrawer = () => {
  const open = useAppStore((s) => s.cartOpen)
  const setOpen = useAppStore((s) => s.setCartOpen)
  const items = useCartStore((s) => s.items)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const clearCart = useCartStore((s) => s.clearCart)

  const overlayRef = useRef(null)
  const drawerRef = useRef(null)
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  // Plain useEffect on purpose, not useGSAP({ dependencies }) — useGSAP
  // reverts the previous run's tweens on every dependency change, which
  // fought this open/close toggle and could leave the drawer snapped back
  // off-screen while only the backdrop's fade/blur played through.
  useEffect(() => {
    if (open) {
      gsap.set(overlayRef.current, { display: 'block' })
      gsap.to(overlayRef.current, { opacity: 1, duration: 0.3 })
      gsap.to(drawerRef.current, { xPercent: 0, duration: 0.5, ease: 'power4.out' })
    } else {
      gsap.to(overlayRef.current, {
        opacity: 0,
        duration: 0.3,
        onComplete: () => gsap.set(overlayRef.current, { display: 'none' }),
      })
      gsap.to(drawerRef.current, { xPercent: 100, duration: 0.4, ease: 'power3.in' })
    }
  }, [open])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <div
        ref={overlayRef}
        onClick={() => setOpen(false)}
        className="fixed inset-0"
        style={{
          background: 'rgba(13,13,13,0.5)',
          backdropFilter: 'blur(4px)',
          opacity: 0,
          display: 'none',
          zIndex: 1000,
        }}
      />
      <aside
        ref={drawerRef}
        className="fixed top-0 right-0 h-full w-full sm:w-[440px] flex flex-col"
        style={{
          background: 'var(--color-cream)',
          color: 'var(--color-navy)',
          transform: 'translateX(100%)',
          zIndex: 1001,
          borderLeft: '1px solid rgba(23,45,109,0.1)',
        }}
      >
        <header
          className="flex items-center justify-between p-6 border-b"
          style={{ borderColor: 'rgba(23,45,109,0.1)' }}
        >
          <h2 className="text-[14px] tracking-[0.2em] uppercase" style={{ fontWeight: 900 }}>
            Carrito ({items.length})
          </h2>
          <button
            onClick={() => setOpen(false)}
            data-cursor="link"
            className="text-[12px] tracking-[0.2em] uppercase"
            style={{ color: 'var(--color-navy)' }}
          >
            Cerrar ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="py-16 text-center">
              <p
                className="text-[12px] tracking-[0.2em] uppercase"
                style={{ color: 'rgba(23,45,109,0.5)' }}
              >
                Tu carrito está vacío
              </p>
              <Link
                to="/catalog"
                onClick={() => setOpen(false)}
                data-cursor="link"
                className="inline-block mt-6 text-[12px] tracking-[0.2em] uppercase"
                style={{ color: 'var(--color-navy)', textDecoration: 'underline' }}
              >
                Ir al catálogo
              </Link>
            </div>
          ) : (
            <ul className="space-y-5">
              {items.map((item) => (
                <li key={item.productId} className="flex gap-4">
                  <div
                    className="w-16 h-20 shrink-0 flex items-center justify-center overflow-hidden"
                    style={{ background: 'var(--color-navy)', color: 'var(--color-cream)' }}
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span style={{ fontWeight: 900, fontSize: '14px' }}>
                        {(item.brand || item.name || 'V').slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[13px] leading-tight truncate" style={{ fontWeight: 700 }}>
                      {item.name}
                    </h3>
                    {item.brand && (
                      <p className="text-[11px] mt-0.5" style={{ color: 'rgba(23,45,109,0.6)' }}>
                        {item.brand}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-3">
                      <div className="inline-flex items-center" style={{ border: '1px solid rgba(23,45,109,0.2)' }}>
                        <button
                          data-cursor="link"
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="px-2 py-1 text-[12px]"
                        >
                          −
                        </button>
                        <span className="px-3 py-1 text-[12px]" style={{ fontWeight: 700 }}>
                          {item.quantity}
                        </span>
                        <button
                          data-cursor="link"
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="px-2 py-1 text-[12px]"
                        >
                          +
                        </button>
                      </div>
                      <button
                        data-cursor="link"
                        onClick={() => removeItem(item.productId)}
                        className="text-[10px] tracking-[0.2em] uppercase"
                        style={{ color: 'rgba(23,45,109,0.5)' }}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                  <div className="text-right text-[13px]" style={{ fontWeight: 700 }}>
                    {formatPrice(item.price * item.quantity)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <footer
            className="p-6 border-t space-y-3"
            style={{ borderColor: 'rgba(23,45,109,0.1)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] tracking-[0.2em] uppercase">Total</span>
              <span style={{ fontSize: 'var(--text-lg)', fontWeight: 900 }}>
                {formatPrice(total)}
              </span>
            </div>
            <Link
              to="/checkout"
              onClick={() => setOpen(false)}
              data-cursor="link"
              className="block w-full text-center py-4 text-[12px] tracking-[0.2em] uppercase"
              style={{
                background: 'var(--color-navy)',
                color: 'var(--color-lime)',
                fontWeight: 700,
              }}
            >
              ▸ Ir al checkout
            </Link>
            <button
              onClick={clearCart}
              data-cursor="link"
              className="block w-full text-center py-2 text-[10px] tracking-[0.2em] uppercase"
              style={{ color: 'rgba(23,45,109,0.6)' }}
            >
              Vaciar carrito
            </button>
          </footer>
        )}
      </aside>
    </>
  )
}
