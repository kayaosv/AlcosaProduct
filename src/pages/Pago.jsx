import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { supabase } from '../lib/supabase.js'
import { useShopSettings } from '../hooks/useShopSettings.js'
import { useSeo } from '../hooks/useSeo.js'

const formatPrice = (n) => `${Number(n).toFixed(2)}€`

const formatTimer = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const buildWhatsAppMessage = (draft, settings) => {
  const lines = [
    `Pedido #${draft.draft_id.slice(0, 8).toUpperCase()} — pago por transferencia/Bizum`,
    `Cliente: ${draft.customer_name || '—'}`,
    '',
    'Productos:',
    ...(draft.items ?? []).map(
      (it) =>
        `- ${it.product_name}${it.variant_label ? ` (${it.variant_label})` : ''} x${it.quantity} — ${formatPrice(Number(it.unit_price) * it.quantity)}`,
    ),
    '',
    `Total a transferir: ${formatPrice(draft.total)}`,
    settings?.payment_iban ? `IBAN: ${settings.payment_iban}` : null,
    settings?.payment_bizum_phone ? `Bizum: ${settings.payment_bizum_phone}` : null,
    '',
    'Ya hice la transferencia/Bizum — adjunto el comprobante 👇',
  ].filter((l) => l !== null)
  return lines.join('\n')
}

// Copia al portapapeles con fallback silencioso — algunos navegadores
// en contextos no-https o embebidos no exponen navigator.clipboard.
const copyToClipboard = async (text, onDone) => {
  try {
    await navigator.clipboard.writeText(text)
    onDone()
  } catch {
    // Sin feedback visual si falla — el dato sigue visible para copiar a mano.
  }
}

const CopyField = ({ label, value }) => {
  const [copied, setCopied] = useState(false)
  if (!value) return null

  return (
    <div className="flex items-center justify-between gap-4 py-4" style={{ borderBottom: '1px solid rgba(255,248,240,0.15)' }}>
      <div className="min-w-0">
        <span className="block text-[10px] tracking-[0.25em] uppercase" style={{ opacity: 0.6 }}>
          {label}
        </span>
        <p className="mt-1 text-[16px] break-all" style={{ fontWeight: 700 }}>{value}</p>
      </div>
      <button
        type="button"
        data-cursor="link"
        onClick={() => copyToClipboard(value, () => { setCopied(true); setTimeout(() => setCopied(false), 1500) })}
        className="shrink-0 px-4 py-2 text-[11px] tracking-[0.15em] uppercase"
        style={{ border: '1px solid rgba(255,248,240,0.3)', color: 'var(--color-cream)', fontWeight: 700 }}
      >
        {copied ? '✓ Copiado' : 'Copiar'}
      </button>
    </div>
  )
}

export const Pago = () => {
  useSeo({ title: 'Completá tu pago', noindex: true })

  const ref = useRef(null)
  const { draftId } = useParams()
  const { settings } = useShopSettings()

  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [sentToWhatsApp, setSentToWhatsApp] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data, error: err } = await supabase
        .rpc('get_payment_draft', { p_draft_id: draftId })
        .maybeSingle()
      if (cancelled) return
      if (err || !data) {
        setError('No encontramos este pedido. Volvé al carrito e intentá de nuevo.')
      } else {
        setDraft(data)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [draftId])

  // Timer ficticio: puramente cosmético, agrega urgencia visual pero no
  // bloquea ni expira nada real — al llegar a 0 se queda ahí, el cliente
  // sigue pudiendo pagar y avisar por WhatsApp sin límite real.
  useEffect(() => {
    if (!settings || !draft) return
    setSecondsLeft(settings.payment_timer_minutes * 60)
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s === null || s <= 0 ? 0 : s - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [settings, draft])

  useGSAP(
    () => {
      if (loading) return
      gsap.from('[data-anim="pago"]', { y: 40, opacity: 0, stagger: 0.08, duration: 0.7, ease: 'power3.out' })
    },
    { scope: ref, dependencies: [loading] },
  )

  if (loading) {
    return (
      <main className="min-h-screen pt-32 pb-24 px-6 md:px-10">
        <p className="text-[14px]" style={{ color: 'rgba(23,45,109,0.7)' }}>Cargando tu pedido…</p>
      </main>
    )
  }

  if (error || !draft) {
    return (
      <main className="min-h-screen pt-32 pb-24 px-6 md:px-10">
        <div className="max-w-xl">
          <span className="text-[11px] tracking-[0.25em] uppercase" style={{ color: 'var(--color-blue)' }}>
            Un momento
          </span>
          <h1 className="mt-4 leading-[0.9]" style={{ fontSize: 'var(--text-xl)', fontWeight: 900, color: 'var(--color-navy)', letterSpacing: '-0.03em' }}>
            NO ENCONTRADO.
          </h1>
          <p className="mt-6 text-[15px]" style={{ color: 'rgba(23,45,109,0.7)' }}>{error}</p>
          <Link
            to="/cart"
            data-cursor="link"
            className="inline-flex items-center gap-3 mt-8 px-8 py-4 text-[12px] tracking-[0.2em] uppercase"
            style={{ background: 'var(--color-navy)', color: 'var(--color-lime)', fontWeight: 700 }}
          >
            Volver al carrito
          </Link>
        </div>
      </main>
    )
  }

  if (draft.consumed_at) {
    return (
      <main className="min-h-screen pt-32 pb-24 px-6 md:px-10">
        <div className="max-w-xl">
          <span className="text-[11px] tracking-[0.25em] uppercase" style={{ color: 'var(--color-blue)' }}>
            Pedido confirmado
          </span>
          <h1 className="mt-4 leading-[0.9]" style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--color-navy)', letterSpacing: '-0.04em' }}>
            YA CONFIRMADO.
          </h1>
          <p className="mt-6 text-[15px] max-w-lg" style={{ color: 'rgba(23,45,109,0.7)' }}>
            Ya confirmamos tu pago y tu pedido está en preparación. Te avisamos por Instagram
            en cuanto esté listo para recoger.
          </p>
          <Link
            to="/catalog"
            data-cursor="link"
            className="inline-flex items-center gap-3 mt-8 px-8 py-4 text-[12px] tracking-[0.2em] uppercase"
            style={{ background: 'var(--color-navy)', color: 'var(--color-lime)', fontWeight: 700 }}
          >
            ▸ Seguir comprando
          </Link>
        </div>
      </main>
    )
  }

  const whatsappHref = `https://wa.me/${settings?.payment_whatsapp_phone ?? ''}?text=${encodeURIComponent(buildWhatsAppMessage(draft, settings))}`

  return (
    <main ref={ref} className="min-h-screen pt-32 pb-24 px-6 md:px-10">
      <div className="max-w-2xl">
        <span data-anim="pago" className="text-[11px] tracking-[0.25em] uppercase" style={{ color: 'var(--color-blue)' }}>
          Último paso
        </span>
        <h1
          data-anim="pago"
          className="mt-4 leading-[0.9]"
          style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--color-navy)', letterSpacing: '-0.04em' }}
        >
          COMPLETÁ TU PAGO.
        </h1>
        <p data-anim="pago" className="mt-6 text-[15px] leading-relaxed max-w-lg" style={{ color: 'rgba(23,45,109,0.8)' }}>
          Transferí el total a los datos de abajo (o pagá por Bizum) y avisanos por WhatsApp
          adjuntando el comprobante — confirmamos tu pedido en cuanto lo vemos.
        </p>

        {secondsLeft !== null && (
          <p data-anim="pago" className="mt-6 text-[13px]" style={{ color: 'rgba(23,45,109,0.6)' }}>
            Te reservamos este precio por{' '}
            <span style={{ fontWeight: 900, color: 'var(--color-blue)' }}>{formatTimer(secondsLeft)}</span>
          </p>
        )}

        <div data-anim="pago" className="mt-8 p-8" style={{ background: 'var(--color-navy)', color: 'var(--color-cream)' }}>
          <div className="flex justify-between items-end pb-6" style={{ borderBottom: '1px solid rgba(255,248,240,0.15)' }}>
            <span className="text-[11px] tracking-[0.2em] uppercase">Total a pagar</span>
            <span style={{ fontSize: 'var(--text-lg)', fontWeight: 900, color: 'var(--color-lime)' }}>
              {formatPrice(draft.total)}
            </span>
          </div>

          <CopyField label="IBAN" value={settings?.payment_iban} />
          <CopyField label="Bizum" value={settings?.payment_bizum_phone} />

          {!settings?.payment_iban && !settings?.payment_bizum_phone && (
            <p className="pt-6 text-[13px]" style={{ opacity: 0.7 }}>
              Todavía no cargamos los datos de cobro — escribinos por WhatsApp y te los pasamos.
            </p>
          )}

          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor="link"
            onClick={() => setSentToWhatsApp(true)}
            className="flex items-center justify-center gap-3 mt-8 py-4 text-[12px] tracking-[0.2em] uppercase"
            style={{ background: '#25D366', color: '#0b3d24', fontWeight: 900 }}
          >
            ✅ Ya pagué — enviar comprobante por WhatsApp
          </a>

          {sentToWhatsApp && (
            <p className="mt-4 text-[12px] text-center" style={{ opacity: 0.8 }}>
              Te esperamos en WhatsApp — confirmamos tu pedido en cuanto veamos el comprobante.
            </p>
          )}
        </div>

        <div data-anim="pago" className="mt-8">
          <span className="text-[11px] tracking-[0.25em] uppercase" style={{ color: 'var(--color-navy)', fontWeight: 700 }}>
            Tu pedido
          </span>
          <ul className="mt-4 space-y-3">
            {(draft.items ?? []).map((item, i) => (
              <li key={i} className="flex justify-between gap-4 text-[13px]" style={{ color: 'rgba(23,45,109,0.85)' }}>
                <span className="min-w-0 truncate">
                  {item.product_name}{item.variant_label ? ` — ${item.variant_label}` : ''} × {item.quantity}
                </span>
                <span style={{ fontWeight: 700 }}>{formatPrice(Number(item.unit_price) * item.quantity)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  )
}
