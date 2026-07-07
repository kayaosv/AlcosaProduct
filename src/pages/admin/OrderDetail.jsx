import { useRef, useEffect, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  fetchOrderById,
  updateOrderStatus,
  STATUS_META,
} from '../../hooks/useAdminOrders.js'

const formatDate = (iso) => {
  const d = new Date(iso)
  return d.toLocaleString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export const OrderDetail = () => {
  const ref = useRef(null)
  const { id } = useParams()
  const navigate = useNavigate()

  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchOrderById(id)
      .then((o) => { if (!cancelled) setOrder(o) })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [id])

  useGSAP(() => {
    if (loading) return
    gsap.from('.editor-section', {
      y: 20, opacity: 0, duration: 0.4, stagger: 0.08, ease: 'power3.out',
    })
  }, { scope: ref, dependencies: [loading] })

  const changeStatus = async (next) => {
    setUpdating(true)
    setError(null)
    try {
      await updateOrderStatus(id, next)
      setOrder((o) => ({ ...o, status: next }))
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return <div className="page-content"><p style={{ color: '#444' }}>Cargando…</p></div>
  if (!order) return (
    <div className="page-content">
      <p style={{ color: '#444' }}>Pedido no encontrado.</p>
      <Link to="/admin/orders" className="btn-ghost" style={{ marginTop: 16 }}>← Volver</Link>
    </div>
  )

  const meta = STATUS_META[order.status] ?? { label: order.status, color: '#666', next: null }
  const shortId = order.id.slice(0, 8)
  const subtotal = (order.order_items ?? []).reduce(
    (a, i) => a + Number(i.product_price) * i.quantity, 0,
  )

  return (
    <div ref={ref} className="page-content">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link to="/admin/orders">Pedidos</Link>
            <span>/</span>
            <span>#{shortId}</span>
          </div>
          <h1 className="page-title">Pedido #{shortId}</h1>
          <p className="page-subtitle">{formatDate(order.created_at)}</p>
        </div>
        <div className="header-actions">
          <span className="status-badge status-badge--lg" style={{ '--status-color': meta.color }}>
            {meta.label}
          </span>
        </div>
      </div>

      {error && <p className="admin-login-error" style={{ marginBottom: 16 }}>{error}</p>}

      <div className="editor-layout">
        <div className="editor-main">
          <section className="editor-section">
            <h2 className="editor-section-title">Líneas del pedido</h2>
            <table className="productos-table" style={{ marginTop: -4 }}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Precio</th>
                  <th>Uds.</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(order.order_items ?? []).map((it) => (
                  <tr key={it.id} className="table-row">
                    <td>
                      <div className="producto-nombre">{it.product_name}</div>
                      {it.variant_label && (
                        <div style={{ fontSize: 11, color: '#888' }}>{it.variant_label}</div>
                      )}
                      {it.product_id && (
                        <Link
                          to={`/admin/products/${it.product_id}`}
                          style={{ fontSize: 11, color: '#555', textDecoration: 'none' }}
                        >
                          Ver producto →
                        </Link>
                      )}
                    </td>
                    <td className="td-precio">{Number(it.product_price).toFixed(2)} €</td>
                    <td><span className="chip">×{it.quantity}</span></td>
                    <td className="td-precio">{(Number(it.product_price) * it.quantity).toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="3" style={{ textAlign: 'right', padding: '14px 16px', color: '#888', fontSize: 12 }}>
                    Total
                  </td>
                  <td className="td-precio" style={{ fontSize: 16, color: '#e8e8e8', fontWeight: 800 }}>
                    {Number(order.total ?? subtotal).toFixed(2)} €
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          {order.notes && (
            <section className="editor-section">
              <h2 className="editor-section-title">Notas del cliente</h2>
              <p style={{ color: '#aaa', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {order.notes}
              </p>
            </section>
          )}
        </div>

        <div className="editor-side">
          <section className="editor-section">
            <h2 className="editor-section-title">Cambiar estado</h2>
            <div className="field-group">
              {meta.next && (
                <button
                  type="button"
                  className="btn-primary"
                  style={{ justifyContent: 'center', width: '100%' }}
                  disabled={updating}
                  onClick={() => changeStatus(meta.next)}
                >
                  {updating ? '…' : `→ Marcar como ${STATUS_META[meta.next].label}`}
                </button>
              )}
              {order.status !== 'cancelled' && order.status !== 'delivered' && (
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ justifyContent: 'center', width: '100%', borderColor: '#3a1a1a', color: '#ef4444' }}
                  disabled={updating}
                  onClick={() => {
                    if (confirm('¿Cancelar este pedido?')) changeStatus('cancelled')
                  }}
                >
                  Cancelar pedido
                </button>
              )}
              {(order.status === 'delivered' || order.status === 'cancelled') && (
                <p style={{ fontSize: 12, color: '#444', textAlign: 'center' }}>
                  Pedido cerrado.
                </p>
              )}
            </div>
          </section>

          <section className="editor-section">
            <h2 className="editor-section-title">Cliente</h2>
            <div className="field-group">
              <div className="field">
                <label>Nombre</label>
                <p style={{ color: '#ddd', fontSize: 13, margin: 0 }}>{order.customer_name || '—'}</p>
              </div>
              <div className="field">
                <label>Email</label>
                <p style={{ color: '#ddd', fontSize: 13, margin: 0 }}>
                  {order.customer_email
                    ? <a href={`mailto:${order.customer_email}`} style={{ color: '#aaa' }}>{order.customer_email}</a>
                    : '—'}
                </p>
              </div>
              <div className="field">
                <label>Teléfono</label>
                <p style={{ color: '#ddd', fontSize: 13, margin: 0 }}>
                  {order.customer_phone
                    ? <a href={`tel:${order.customer_phone}`} style={{ color: '#aaa' }}>{order.customer_phone}</a>
                    : '—'}
                </p>
              </div>
              <div className="field">
                <label>Dirección</label>
                <p style={{ color: '#ddd', fontSize: 13, margin: 0, whiteSpace: 'pre-wrap' }}>
                  {order.customer_address || '—'}
                </p>
              </div>
            </div>
          </section>

          <button
            type="button"
            className="btn-ghost"
            onClick={() => navigate('/admin/orders')}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            ← Volver a pedidos
          </button>
        </div>
      </div>
    </div>
  )
}
