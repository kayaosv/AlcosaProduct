import { useEffect, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { supabase } from '../lib/supabase.js'
import { useCartStore } from '../stores/useCartStore.js'

const formatPrice = (n) => `${Number(n).toFixed(2)}€`
const MAX_POLL_ATTEMPTS = 8
const POLL_DELAY_MS = 1500

// El webhook de Stripe procesa el pago (crea el pedido, descuenta
// stock) de forma asincrona respecto a la redireccion del navegador -
// esta pagina puede cargar unos segundos antes de que el pedido exista
// todavia, por eso reintenta en vez de fallar directo.
export const CheckoutSuccess = () => {
  const ref = useRef(null)
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const clearCart = useCartStore((s) => s.clearCart)

  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!sessionId) {
      setLoading(false)
      setError('Falta la referencia del pago.')
      return
    }

    let cancelled = false
    let attempts = 0

    const poll = async () => {
      const { data, error: err } = await supabase
        .rpc('get_order_by_session', { p_session_id: sessionId })
        .maybeSingle()

      if (cancelled) return

      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      if (data) {
        setOrder(data)
        setLoading(false)
        clearCart()
        return
      }

      attempts += 1
      if (attempts < MAX_POLL_ATTEMPTS) {
        setTimeout(poll, POLL_DELAY_MS)
      } else {
        setLoading(false)
        setError('Tu pago se está procesando. Si no ves la confirmación en unos minutos, contáctanos.')
      }
    }

    poll()
    return () => { cancelled = true }
  }, [sessionId, clearCart])

  useGSAP(
    () => {
      if (loading) return
      gsap.from('[data-anim="success"]', { y: 40, opacity: 0, stagger: 0.1, duration: 0.8, ease: 'power3.out' })
    },
    { scope: ref, dependencies: [loading] },
  )

  if (loading) {
    return (
      <main className="min-h-screen pt-32 pb-24 px-6 md:px-10">
        <p className="text-[14px]" style={{ color: 'rgba(23,45,109,0.7)' }}>Confirmando tu pago…</p>
      </main>
    )
  }

  if (!order) {
    return (
      <main className="min-h-screen pt-32 pb-24 px-6 md:px-10">
        <div className="max-w-xl">
          <span className="text-[11px] tracking-[0.25em] uppercase" style={{ color: 'var(--color-blue)' }}>
            Un momento
          </span>
          <h1
            className="mt-4 leading-[0.9]"
            style={{ fontSize: 'var(--text-xl)', fontWeight: 900, color: 'var(--color-navy)', letterSpacing: '-0.03em' }}
          >
            AÚN CONFIRMANDO.
          </h1>
          <p className="mt-6 text-[15px]" style={{ color: 'rgba(23,45,109,0.7)' }}>{error}</p>
          <Link
            to="/"
            data-cursor="link"
            className="inline-flex items-center gap-3 mt-8 px-8 py-4 text-[12px] tracking-[0.2em] uppercase"
            style={{ background: 'var(--color-navy)', color: 'var(--color-lime)', fontWeight: 700 }}
          >
            Volver al inicio
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main ref={ref} className="min-h-screen pt-32 pb-24 px-6 md:px-10">
      <div className="max-w-2xl">
        <span data-anim="success" className="text-[11px] tracking-[0.25em] uppercase" style={{ color: 'var(--color-blue)' }}>
          Pago confirmado
        </span>
        <h1
          data-anim="success"
          className="mt-4 leading-[0.9]"
          style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--color-navy)', letterSpacing: '-0.04em' }}
        >
          GRACIAS.
        </h1>
        <p data-anim="success" className="mt-8 text-[16px] leading-relaxed max-w-lg" style={{ color: 'rgba(23,45,109,0.8)' }}>
          Tu pedido ya está pagado. Te avisamos por <strong>Instagram</strong> en cuanto esté listo para recoger en la tienda.
        </p>

        <div
          data-anim="success"
          className="mt-10 p-8 grid grid-cols-2 gap-6"
          style={{ background: 'var(--color-navy)', color: 'var(--color-cream)' }}
        >
          <div>
            <span className="text-[10px] tracking-[0.25em] uppercase" style={{ opacity: 0.6 }}>Nº de pedido</span>
            <p className="mt-2 text-[14px] break-all" style={{ fontWeight: 700 }}>
              #{order.order_id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <div>
            <span className="text-[10px] tracking-[0.25em] uppercase" style={{ opacity: 0.6 }}>Total pagado</span>
            <p className="mt-2 text-[20px]" style={{ fontWeight: 900, color: 'var(--color-lime)' }}>
              {formatPrice(order.total)}
            </p>
          </div>
        </div>

        <div data-anim="success" className="mt-10 flex flex-wrap gap-4">
          <Link
            to="/catalog"
            data-cursor="link"
            className="inline-flex items-center gap-3 px-8 py-4 text-[12px] tracking-[0.2em] uppercase"
            style={{ background: 'var(--color-navy)', color: 'var(--color-lime)', fontWeight: 700 }}
          >
            ▸ Seguir comprando
          </Link>
          <Link
            to="/"
            data-cursor="link"
            className="inline-flex items-center gap-3 px-8 py-4 text-[12px] tracking-[0.2em] uppercase"
            style={{ border: '1px solid rgba(23,45,109,0.3)', color: 'var(--color-navy)', fontWeight: 700 }}
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  )
}
