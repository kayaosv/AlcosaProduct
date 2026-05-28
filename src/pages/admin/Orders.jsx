import { useRef, useState, useMemo } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Link } from 'react-router-dom'
import { useAdminOrders, STATUS_META, ORDER_STATUSES } from '../../hooks/useAdminOrders.js'

const formatDate = (iso) => {
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export const Orders = () => {
  const ref = useRef(null)
  const { orders, loading } = useAdminOrders()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const counts = useMemo(() => {
    const c = { all: orders.length }
    ORDER_STATUSES.forEach((s) => { c[s] = 0 })
    orders.forEach((o) => { c[o.status] = (c[o.status] || 0) + 1 })
    return c
  }, [orders])

  const filtered = useMemo(() => {
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

  useGSAP(() => {
    if (loading) return
    gsap.from('.table-row', { opacity: 0, y: 8, duration: 0.3, stagger: 0.02, ease: 'power2.out' })
  }, { scope: ref, dependencies: [filtered.length] })

  if (loading) {
    return <div className="page-content"><p style={{ color: '#444' }}>Cargando…</p></div>
  }

  return (
    <div ref={ref} className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Pedidos</h1>
          <p className="page-subtitle">
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            {counts.pending > 0 && ` · ${counts.pending} pendiente${counts.pending !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      <div className="status-tabs">
        <button
          type="button"
          className={`status-tab ${filter === 'all' ? 'status-tab--active' : ''}`}
          onClick={() => setFilter('all')}
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
              onClick={() => setFilter(s)}
              style={filter === s ? { '--tab-color': meta.color } : undefined}
            >
              <span className="status-tab-dot" style={{ background: meta.color }} />
              {meta.label}
              <span className="status-tab-count">{counts[s] || 0}</span>
            </button>
          )
        })}
      </div>

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
              <th>Fecha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => {
              const meta = STATUS_META[o.status] ?? { label: o.status, color: '#666' }
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
                    <span className="status-badge" style={{ '--status-color': meta.color }}>
                      {meta.label}
                    </span>
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
              <button className="btn-ghost" onClick={() => { setFilter('all'); setSearch('') }}>
                Limpiar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
