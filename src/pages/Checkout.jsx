import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useCartStore } from '../stores/useCartStore.js'
import { useCreateOrder } from '../hooks/useCreateOrder.js'
import { useStripeCheckout } from '../hooks/useStripeCheckout.js'

const formatPrice = (n) => `${Number(n).toFixed(2)}€`

const Field = ({ label, name, value, onChange, type = 'text', required, textarea, autoComplete }) => (
  <label className="block">
    <span
      className="block text-[10px] tracking-[0.25em] uppercase mb-2"
      style={{ color: 'rgba(23,45,109,0.7)' }}
    >
      {label} {required && <span style={{ color: 'var(--color-blue)' }}>*</span>}
    </span>
    {textarea ? (
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        rows={3}
        autoComplete={autoComplete}
        className="w-full bg-transparent py-3 px-0 text-[15px] outline-none resize-none"
        style={{
          borderBottom: '1px solid rgba(23,45,109,0.25)',
          color: 'var(--color-navy)',
        }}
      />
    ) : (
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={autoComplete}
        className="w-full bg-transparent py-3 px-0 text-[15px] outline-none"
        style={{
          borderBottom: '1px solid rgba(23,45,109,0.25)',
          color: 'var(--color-navy)',
        }}
      />
    )}
  </label>
)

const ConsentCheckbox = ({ checked, onChange, children }) => (
  <label className="flex items-start gap-3 text-[13px] leading-relaxed" style={{ color: 'rgba(23,45,109,0.8)' }}>
    <input
      type="checkbox"
      required
      checked={checked}
      onChange={onChange}
      className="mt-1"
    />
    <span>{children}</span>
  </label>
)

const SuccessState = ({ orderId, total, onContinue }) => {
  const ref = useRef(null)

  useGSAP(
    () => {
      gsap.from('[data-anim="success"]', {
        y: 40,
        opacity: 0,
        stagger: 0.1,
        duration: 0.8,
        ease: 'power3.out',
      })
    },
    { scope: ref },
  )

  return (
    <main ref={ref} className="min-h-screen pt-32 pb-24 px-6 md:px-10">
      <div className="max-w-2xl">
        <span
          data-anim="success"
          className="text-[11px] tracking-[0.25em] uppercase"
          style={{ color: 'var(--color-blue)' }}
        >
          Pedido confirmado
        </span>
        <h1
          data-anim="success"
          className="mt-4 leading-[0.9]"
          style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 900,
            color: 'var(--color-navy)',
            letterSpacing: '-0.04em',
          }}
        >
          GRACIAS.
        </h1>
        <p
          data-anim="success"
          className="mt-8 text-[16px] leading-relaxed max-w-lg"
          style={{ color: 'rgba(23,45,109,0.8)' }}
        >
          Hemos recibido tu pedido. Te avisamos por <strong>Instagram</strong> en cuanto
          esté listo para recoger en la tienda.
        </p>

        <div
          data-anim="success"
          className="mt-10 p-8 grid grid-cols-2 gap-6"
          style={{ background: 'var(--color-navy)', color: 'var(--color-cream)' }}
        >
          <div>
            <span className="text-[10px] tracking-[0.25em] uppercase" style={{ opacity: 0.6 }}>
              Nº de pedido
            </span>
            <p className="mt-2 text-[14px] break-all" style={{ fontWeight: 700 }}>
              #{orderId.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <div>
            <span className="text-[10px] tracking-[0.25em] uppercase" style={{ opacity: 0.6 }}>
              Total
            </span>
            <p className="mt-2 text-[20px]" style={{ fontWeight: 900, color: 'var(--color-lime)' }}>
              {formatPrice(total)}
            </p>
          </div>
        </div>

        <div data-anim="success" className="mt-10 flex flex-wrap gap-4">
          <Link
            to="/catalog"
            data-cursor="link"
            onClick={onContinue}
            className="inline-flex items-center gap-3 px-8 py-4 text-[12px] tracking-[0.2em] uppercase"
            style={{ background: 'var(--color-navy)', color: 'var(--color-lime)', fontWeight: 700 }}
          >
            ▸ Seguir comprando
          </Link>
          <Link
            to="/"
            data-cursor="link"
            onClick={onContinue}
            className="inline-flex items-center gap-3 px-8 py-4 text-[12px] tracking-[0.2em] uppercase"
            style={{
              border: '1px solid rgba(23,45,109,0.3)',
              color: 'var(--color-navy)',
              fontWeight: 700,
            }}
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  )
}

export const Checkout = () => {
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const items = useCartStore((s) => s.items)
  const clearCart = useCartStore((s) => s.clearCart)
  const { createOrder, loading, error } = useCreateOrder()
  const { payOnline, loading: stripeLoading, error: stripeError } = useStripeCheckout()

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  })
  const [acceptPrivacy, setAcceptPrivacy] = useState(false)
  const [confirmAge, setConfirmAge] = useState(false)
  const [success, setSuccess] = useState(null)

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  useGSAP(
    () => {
      if (success || items.length === 0) return
      gsap.from('[data-anim="checkout"]', {
        y: 40,
        opacity: 0,
        stagger: 0.05,
        duration: 0.6,
        ease: 'power3.out',
      })
    },
    { scope: containerRef, dependencies: [success, items.length] },
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (items.length === 0) return

    // Dos botones de envio comparten el mismo <form> (mismos datos de
    // cliente, misma validacion nativa required) - el boton pulsado
    // decide el flujo via submitter.value.
    const method = e.nativeEvent.submitter?.value === 'stripe' ? 'stripe' : 'pickup'

    if (method === 'stripe') {
      if (stripeLoading) return
      await payOnline({ customer: form, items, notes: form.notes })
      return
    }

    if (loading) return
    const result = await createOrder({
      customer: form,
      items,
      notes: form.notes,
    })

    if (result) {
      setSuccess({ orderId: result.id, total: result.total })
      clearCart()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (success) {
    return (
      <SuccessState
        orderId={success.orderId}
        total={success.total}
        onContinue={() => navigate(0)}
      />
    )
  }

  if (items.length === 0) {
    return (
      <main className="min-h-screen pt-32 pb-24 px-6 md:px-10">
        <div className="max-w-xl">
          <span
            className="text-[11px] tracking-[0.25em] uppercase"
            style={{ color: 'var(--color-blue)' }}
          >
            Sin pedidos en curso
          </span>
          <h1
            className="mt-4 leading-[0.9]"
            style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 900,
              color: 'var(--color-navy)',
              letterSpacing: '-0.03em',
            }}
          >
            Carrito vacío.
          </h1>
          <p className="mt-6 text-[15px]" style={{ color: 'rgba(23,45,109,0.7)' }}>
            Añade productos antes de finalizar el pedido.
          </p>
          <Link
            to="/catalog"
            data-cursor="link"
            className="inline-flex items-center gap-3 mt-8 px-8 py-4 text-[12px] tracking-[0.2em] uppercase"
            style={{ background: 'var(--color-navy)', color: 'var(--color-lime)', fontWeight: 700 }}
          >
            ▸ Ir al catálogo
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main ref={containerRef} className="min-h-screen pt-32 pb-24 px-6 md:px-10">
      <div data-anim="checkout">
        <Link
          to="/cart"
          data-cursor="link"
          className="text-[11px] tracking-[0.2em] uppercase"
          style={{ color: 'rgba(23,45,109,0.6)' }}
        >
          ← Volver al carrito
        </Link>
      </div>

      <div data-anim="checkout" className="mt-6">
        <span
          className="text-[11px] tracking-[0.25em] uppercase"
          style={{ color: 'var(--color-blue)' }}
        >
          Último paso
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
          CHECKOUT
        </h1>
        <p className="mt-4 text-[14px] max-w-xl" style={{ color: 'rgba(23,45,109,0.7)' }}>
          Paga online ahora, o reserva y paga en tienda al recoger. Te avisamos por
          Instagram en cuanto tu pedido esté listo.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-12 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-12"
      >
        <div data-anim="checkout" className="space-y-8">
          <div>
            <h2
              className="text-[11px] tracking-[0.25em] uppercase mb-6"
              style={{ color: 'var(--color-navy)', fontWeight: 700 }}
            >
              01 · Tus datos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field
                label="Nombre completo"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                autoComplete="name"
              />
              <Field
                label="Teléfono"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                type="tel"
                required
                autoComplete="tel"
              />
              <Field
                label="Email"
                name="email"
                value={form.email}
                onChange={handleChange}
                type="email"
                required
                autoComplete="email"
              />
              <Field
                label="Instagram (opcional)"
                name="address"
                value={form.address}
                onChange={handleChange}
                autoComplete="off"
              />
            </div>
          </div>

          <div>
            <h2
              className="text-[11px] tracking-[0.25em] uppercase mb-6"
              style={{ color: 'var(--color-navy)', fontWeight: 700 }}
            >
              02 · Notas para nosotros
            </h2>
            <Field
              label="Cualquier comentario sobre el pedido"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              textarea
            />
          </div>

          <div>
            <h2
              className="text-[11px] tracking-[0.25em] uppercase mb-6"
              style={{ color: 'var(--color-navy)', fontWeight: 700 }}
            >
              03 · Confirmación
            </h2>
            <div className="space-y-4">
              <ConsentCheckbox
                checked={acceptPrivacy}
                onChange={(e) => setAcceptPrivacy(e.target.checked)}
              >
                He leído y acepto la{' '}
                <Link
                  to="/privacidad"
                  data-cursor="link"
                  target="_blank"
                  className="underline underline-offset-4"
                  style={{ color: 'var(--color-blue)' }}
                >
                  Política de Privacidad
                </Link>
                . <span style={{ color: 'var(--color-blue)' }}>*</span>
              </ConsentCheckbox>
              <ConsentCheckbox
                checked={confirmAge}
                onChange={(e) => setConfirmAge(e.target.checked)}
              >
                Confirmo que soy mayor de edad (18+).{' '}
                <span style={{ color: 'var(--color-blue)' }}>*</span>
              </ConsentCheckbox>
            </div>
          </div>

          {(error || stripeError) && (
            <p
              className="text-[12px] tracking-[0.15em] uppercase px-4 py-3"
              style={{ background: 'rgba(229, 62, 62, 0.1)', color: '#b03030' }}
            >
              ⚠ {error || stripeError}
            </p>
          )}
        </div>

        <aside data-anim="checkout" className="lg:sticky lg:top-32 self-start">
          <div
            className="p-8"
            style={{ background: 'var(--color-navy)', color: 'var(--color-cream)' }}
          >
            <h2
              className="text-[11px] tracking-[0.25em] uppercase"
              style={{ color: 'var(--color-blue)' }}
            >
              Tu pedido
            </h2>

            <ul className="mt-6 space-y-4">
              {items.map((item) => (
                <li key={item.productId} className="flex justify-between gap-4 text-[13px]">
                  <div className="min-w-0">
                    <p style={{ fontWeight: 700 }} className="truncate">
                      {item.name}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ opacity: 0.6 }}>
                      {formatPrice(item.price)} × {item.quantity}
                    </p>
                  </div>
                  <span style={{ fontWeight: 700 }}>
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            <div
              className="mt-8 pt-6 flex justify-between items-end"
              style={{ borderTop: '1px solid rgba(255,248,240,0.15)' }}
            >
              <span className="text-[11px] tracking-[0.2em] uppercase">Total</span>
              <span
                style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 900,
                  color: 'var(--color-lime)',
                }}
              >
                {formatPrice(total)}
              </span>
            </div>

            <button
              type="submit"
              name="paymentMethod"
              value="stripe"
              disabled={loading || stripeLoading}
              data-cursor="link"
              className="block w-full text-center mt-8 py-4 text-[12px] tracking-[0.2em] uppercase transition-opacity"
              style={{
                background: 'var(--color-lime)',
                color: 'var(--color-navy)',
                fontWeight: 900,
                opacity: loading || stripeLoading ? 0.6 : 1,
                cursor: stripeLoading ? 'wait' : undefined,
              }}
            >
              {stripeLoading ? 'Redirigiendo…' : '▸ Pagar online ahora'}
            </button>

            <button
              type="submit"
              name="paymentMethod"
              value="pickup"
              disabled={loading || stripeLoading}
              data-cursor="link"
              className="block w-full text-center mt-3 py-4 text-[12px] tracking-[0.2em] uppercase transition-opacity"
              style={{
                border: '1px solid rgba(255,248,240,0.3)',
                color: 'var(--color-cream)',
                fontWeight: 700,
                opacity: loading || stripeLoading ? 0.6 : 1,
                cursor: loading ? 'wait' : undefined,
              }}
            >
              {loading ? 'Procesando…' : 'Reservar y pagar en tienda'}
            </button>

            <p
              className="mt-4 text-[10px] leading-relaxed text-center"
              style={{ color: 'rgba(255,248,240,0.6)' }}
            >
              Pago online seguro con Stripe, o reserva y paga al recoger en tienda.
            </p>
          </div>
        </aside>
      </form>
    </main>
  )
}
