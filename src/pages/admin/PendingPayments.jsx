import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { supabase } from '../../lib/supabase.js'
import { usePendingPaymentDrafts, confirmPaymentDraft } from '../../hooks/usePaymentDrafts.js'

const formatPrice = (n) => `${Number(n).toFixed(2)} €`

const formatDate = (iso) => {
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export const PendingPayments = () => {
  const ref = useRef(null)
  const { drafts, loading, refetch } = usePendingPaymentDrafts()
  const [confirmingId, setConfirmingId] = useState(null)

  const handleConfirm = async (draft) => {
    if (!confirm(`¿Confirmar que "${draft.customer_name}" ya transfirió/pagó por Bizum ${formatPrice(draft.total)}?`)) return
    setConfirmingId(draft.id)
    try {
      const { orderId } = await confirmPaymentDraft(draft.id)
      // Mismo patron fire-and-forget que Tpv.jsx — cualquier venta
      // intenta sincronizar con Odoo por detras, sin bloquear la pantalla.
      supabase.functions.invoke('odoo-sync', { body: { order_id: orderId } }).catch(() => {})
      await refetch()
    } catch (err) {
      alert(`No se pudo confirmar el pago: ${err.message}`)
    } finally {
      setConfirmingId(null)
    }
  }

  useGSAP(() => {
    if (loading) return
    gsap.from('.table-row', { opacity: 0, y: 8, duration: 0.3, stagger: 0.02, ease: 'power2.out' })
  }, { scope: ref, dependencies: [drafts.length] })

  if (loading) {
    return <div className="page-content"><p style={{ color: '#444' }}>Cargando…</p></div>
  }

  return (
    <div ref={ref} className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Pagos pendientes</h1>
          <p className="page-subtitle">
            {drafts.length} pedido{drafts.length !== 1 ? 's' : ''} esperando confirmación por transferencia/Bizum
          </p>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="productos-table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Contacto</th>
              <th>Items</th>
              <th>Total</th>
              <th>Fecha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((d) => (
              <tr key={d.id} className="table-row">
                <td><span className="order-id">#{d.id.slice(0, 8)}</span></td>
                <td className="producto-nombre">{d.customer_name || '—'}</td>
                <td>
                  <span style={{ fontSize: 12, color: '#888' }}>{d.customer_email || '—'}</span>
                  {d.customer_phone && (
                    <span style={{ display: 'block', fontSize: 11, color: '#555' }}>{d.customer_phone}</span>
                  )}
                </td>
                <td>
                  <span className="chip">{d.items?.length ?? 0} u.</span>
                </td>
                <td className="td-precio">{formatPrice(d.total)}</td>
                <td style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap' }}>{formatDate(d.created_at)}</td>
                <td className="td-actions">
                  <button
                    type="button"
                    className="action-btn"
                    disabled={confirmingId === d.id}
                    onClick={() => handleConfirm(d)}
                  >
                    {confirmingId === d.id ? 'Confirmando…' : '✅ Confirmar pago recibido'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {drafts.length === 0 && (
          <div className="table-empty">
            <p>No hay pagos pendientes de confirmar.</p>
          </div>
        )}
      </div>
    </div>
  )
}
