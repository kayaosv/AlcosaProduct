import { useRef, useState, useMemo } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useAdminOrders, updateOrderStatus, STATUS_META, ORDER_STATUSES } from '../../hooks/useAdminOrders.js'
import { usePendingPaymentDrafts, confirmPaymentDraft } from '../../hooks/usePaymentDrafts.js'
import { OrderStatusSelect } from '../../components/dom/admin/OrderStatusSelect.jsx'

const PaymentBadge = ({ method, status }) => {
  if (method === 'transferencia') {
    return <span className="payment-badge payment-badge--paid">Transferencia/Bizum</span>
  }
  if (method === 'stripe') {
    return status === 'paid'
      ? <span className="payment-badge payment-badge--paid">Pagado online</span>
      : <span className="payment-badge payment-badge--refunded">Reembolsado</span>
  }
  if (method === 'pos_efectivo') {
    return <span className="payment-badge payment-badge--paid">Mostrador · Efectivo</span>
  }
  if (method === 'pos_tarjeta') {
    return <span className="payment-badge payment-badge--paid">Mostrador · Tarjeta</span>
  }
  return <span className="payment-badge payment-badge--pickup">Paga en tienda</span>
}

// Solo aplica a ventas del TPV (payment_method 'pos_*') — un pedido
// online/pickup no tiene nada que sincronizar con Odoo.
const OdooSyncBadge = ({ status }) => {
  if (status === 'synced') {
    return <span className="odoo-badge odoo-badge--synced" title="Factura creada en Odoo">✓ Odoo</span>
  }
  if (status === 'error') {
    return <span className="odoo-badge odoo-badge--error" title="Falló la sincronización con Odoo">⚠ Odoo</span>
  }
  return null
}

const formatDate = (iso) => {
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const formatPrice = (n) => `${Number(n).toFixed(2)} €`

export const Orders = () => {
  const ref = useRef(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const { orders, loading, setOrders } = useAdminOrders()
  const { drafts, loading: loadingDrafts, refetch: refetchDrafts } = usePendingPaymentDrafts()

  // 'all' | uno de ORDER_STATUSES | 'pending-payments' — un solo estado
  // maneja las pestañas de pedidos y la pestaña extra de pagos sin
  // confirmar (antes /admin/pending-payments, ver
  // specs/pedidos-pagos-pendientes-unificado.md). ?tab=pending-payments
  // en la URL permite que el link viejo del sidebar siga funcionando.
  const [filter, setFilter] = useState(() =>
    searchParams.get('tab') === 'pending-payments' ? 'pending-payments' : 'all',
  )
  const [search, setSearch] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [confirmingId, setConfirmingId] = useState(null)

  const setFilterTab = (next) => {
    setFilter(next)
    if (searchParams.get('tab')) setSearchParams({}, { replace: true })
  }

  // Update optimista con rollback si falla, igual que OrderDetail.jsx -
  // 'cancelled' pide confirmacion antes (mismo criterio que ya tenia el
  // boton "Cancelar pedido" del detalle) porque es la unica opcion del
  // select con consecuencia dificil de deshacer sin llamar al cliente.
  const changeStatus = async (order, next) => {
    if (next === 'cancelled' && !confirm('¿Cancelar este pedido?')) return
    setUpdatingId(order.id)
    const prev = orders
    setOrders((os) => os.map((o) => (o.id === order.id ? { ...o, status: next } : o)))
    try {
      await updateOrderStatus(order.id, next, order)
    } catch (err) {
      setOrders(prev)
      alert(`No se pudo actualizar el pedido: ${err.message}`)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleConfirmDraft = async (draft) => {
    if (!confirm(`¿Confirmar que "${draft.customer_name}" ya transfirió/pagó por Bizum ${formatPrice(draft.total)}?`)) return
    setConfirmingId(draft.id)
    try {
      const { orderId } = await confirmPaymentDraft(draft.id)
      // Mismo patron fire-and-forget que Tpv.jsx — cualquier venta
      // intenta sincronizar con Odoo por detras, sin bloquear la pantalla.
      supabase.functions.invoke('odoo-sync', { body: { order_id: orderId } }).catch(() => {})
      await refetchDrafts()
    } catch (err) {
      alert(`No se pudo confirmar el pago: ${err.message}`)
    } finally {
      setConfirmingId(null)
    }
  }

  const counts = useMemo(() => {
    const c = { all: orders.length }
    ORDER_STATUSES.forEach((s) => { c[s] = 0 })
    orders.forEach((o) => { c[o.status] = (c[o.status] || 0) + 1 })
    return c
  }, [orders])

  const filtered = useMemo(() => {
    if (filter === 'pending-payments') return []
    let list = orders
    if (filter !== 'all') list = list.filter((o) => o.status === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (o) =>
          (o.customer_name || '').toLowerCase().includes(q) ||
          (o.customer_email || '').toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q),
      )
    }
    return list
  }, [orders, filter, search])

  const onPendingPayments = filter === 'pending-payments'

  useGSAP(() => {
    if (loading || loadingDrafts) return
    gsap.from('.table-row', { opacity: 0, y: 8, duration: 0.3, stagger: 0.02, ease: 'power2.out' })
  }, { scope: ref, dependencies: [onPendingPayments, filtered.length, drafts.length] })

  if (loading || loadingDrafts) {
    return <div className="page-content"><p style={{ color: '#444' }}>Cargando…</p></div>
  }

  return (
    <div ref={ref} className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Pedidos</h1>
          <p className="page-subtitle">
            {onPendingPayments
              ? `${drafts.length} pago${drafts.length !== 1 ? 's' : ''} esperando confirmación por transferencia/Bizum`
              : `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''}${counts.pending > 0 ? ` · ${counts.pending} pendiente${counts.pending !== 1 ? 's' : ''}` : ''}`}
          </p>
        </div>
      </div>

      <div className="status-tabs">
        <button
          type="button"
          className={`status-tab ${filter === 'all' ? 'status-tab--active' : ''}`}
          onClick={() => setFilterTab('all')}
        >
          Todos <span className="status-tab-count">{counts.all}</span>
        </button>
        {ORDER_STATUSES.map((s) => {
          const meta = STATUS_META[s]
          return (
            <button
              key={s}
              type="button"
              className={`status-tab ${filter === s ? 'status-tab--active' : ''}`}
              onClick={() => setFilterTab(s)}
              style={filter === s ? { '--tab-color': meta.color } : undefined}
            >
              <span className="status-tab-dot" style={{ background: meta.color }} />
              {meta.label}
              <span className="status-tab-count">{counts[s] || 0}</span>
            </button>
          )
        })}
        <button
          type="button"
          className={`status-tab ${onPendingPayments ? 'status-tab--active' : ''}`}
          onClick={() => setFilterTab('pending-payments')}
          style={onPendingPayments ? { '--tab-color': '#f59e0b' } : undefined}
        >
          <span className="status-tab-dot" style={{ background: '#f59e0b' }} />
          Pendientes de pago
          <span className="status-tab-count">{drafts.length}</span>
        </button>
      </div>

      {onPendingPayments ? (
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
                      onClick={() => handleConfirmDraft(d)}
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
      ) : (
        <>
          <div className="filter-bar">
            <input
              className="filter-search"
              type="text"
              placeholder="Buscar por cliente, email o ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="btn-ghost" onClick={() => setSearch('')}>Limpiar</button>
            )}
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
                  <th>Estado</th>
                  <th>Pago</th>
                  <th>Fecha</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const shortId = o.id.slice(0, 8)
                  return (
                    <tr key={o.id} className="table-row">
                      <td>
                        <span className="order-id">#{shortId}</span>
                      </td>
                      <td className="producto-nombre">{o.customer_name || '—'}</td>
                      <td>
                        <span style={{ fontSize: 12, color: '#888' }}>{o.customer_email || '—'}</span>
                        {o.customer_phone && (
                          <span style={{ display: 'block', fontSize: 11, color: '#555' }}>{o.customer_phone}</span>
                        )}
                      </td>
                      <td>
                        <span className="chip">{o.order_items?.length ?? 0} u.</span>
                      </td>
                      <td className="td-precio">{Number(o.total ?? 0).toFixed(2)} €</td>
                      <td>
                        <OrderStatusSelect
                          status={o.status}
                          disabled={updatingId === o.id}
                          onChange={(next) => changeStatus(o, next)}
                          size="sm"
                        />
                      </td>
                      <td>
                        <PaymentBadge method={o.payment_method} status={o.payment_status} />
                        {o.payment_method?.startsWith('pos_') && <OdooSyncBadge status={o.odoo_sync_status} />}
                      </td>
                      <td style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap' }}>
                        {formatDate(o.created_at)}
                      </td>
                      <td className="td-actions">
                        <Link to={`/admin/orders/${o.id}`} className="action-btn">Abrir</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="table-empty">
                <p>
                  {filter === 'all' && !search
                    ? 'Aún no hay pedidos.'
                    : 'No se encontraron pedidos con esos filtros.'}
                </p>
                {(filter !== 'all' || search) && (
                  <button className="btn-ghost" onClick={() => { setFilterTab('all'); setSearch('') }}>
                    Limpiar
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
