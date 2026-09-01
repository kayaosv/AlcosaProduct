import { useRef, useState, useMemo } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { CHANNELS, fetchOrdersForExport, filterOrders, buildSummary, downloadSalesExcel } from '../../lib/salesExport.js'

const todayISO = () => new Date().toISOString().slice(0, 10)
const firstOfMonthISO = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export const Reports = () => {
  const ref = useRef(null)
  const [dateFrom, setDateFrom] = useState(firstOfMonthISO())
  const [dateTo, setDateTo] = useState(todayISO())
  const [channels, setChannels] = useState(() =>
    Object.fromEntries(Object.keys(CHANNELS).map((k) => [k, true])),
  )
  const [includeCancelled, setIncludeCancelled] = useState(false)
  const [orders, setOrders] = useState(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)

  useGSAP(() => {
    gsap.from('.reports-section', { y: 16, opacity: 0, duration: 0.4, stagger: 0.08, ease: 'power3.out' })
  }, { scope: ref })

  const filtered = useMemo(
    () => (orders ? filterOrders(orders, { channels, includeCancelled }) : []),
    [orders, channels, includeCancelled],
  )
  const summary = useMemo(() => buildSummary(filtered), [filtered])

  const runPreview = async () => {
    setLoading(true)
    setError(null)
    try {
      setOrders(await fetchOrdersForExport(dateFrom, dateTo))
    } catch (err) {
      setError(err.message)
      setOrders(null)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!orders) return
    setExporting(true)
    try {
      await downloadSalesExcel(filtered, { dateFrom, dateTo })
    } catch (err) {
      alert(`No se pudo generar el Excel: ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  const toggleChannel = (key) =>
    setChannels((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <div ref={ref} className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Informes</h1>
          <p className="page-subtitle">Export de ventas para el gestor — TPV, Stripe y reservas en un solo Excel</p>
        </div>
      </div>

      <div className="reports-section dash-section" style={{ marginBottom: 20 }}>
        <h2 className="section-title">Rango y canales</h2>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#888' }}>
            Desde
            <input type="date" value={dateFrom} max={dateTo} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#888' }}>
            Hasta
            <input type="date" value={dateTo} min={dateFrom} max={todayISO()} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <button className="btn-primary" onClick={runPreview} disabled={loading}>
            {loading ? 'Cargando…' : 'Ver ventas del período'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          {Object.entries(CHANNELS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`profit-filter-btn ${channels[key] ? 'profit-filter-btn--active' : ''}`}
              onClick={() => toggleChannel(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#888' }}>
          <input type="checkbox" checked={includeCancelled} onChange={(e) => setIncludeCancelled(e.target.checked)} />
          Incluir pedidos cancelados
        </label>

        {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 10 }}>{error}</p>}
      </div>

      {orders && (
        <div className="reports-section dash-section" style={{ marginBottom: 20 }}>
          <h2 className="section-title">Resumen del período</h2>
          <p className="section-desc">
            {summary.totalPedidos} pedidos · {summary.totalVentas.toFixed(2)} € · ticket promedio {summary.ticketPromedio.toFixed(2)} €
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '12px 0 20px' }}>
            {summary.rows.map((r) => (
              <div key={r.canal} className="dash-section" style={{ flex: 1, minWidth: 160 }}>
                <p className="section-desc" style={{ marginBottom: 4 }}>{r.canal}</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: '#e8e8e8', margin: 0 }}>{r.total.toFixed(2)} €</p>
                <p style={{ fontSize: 11, color: '#666', margin: 0 }}>{r.pedidos} pedidos</p>
              </div>
            ))}
            {summary.rows.length === 0 && (
              <p style={{ color: '#444', fontSize: 12 }}>Sin ventas en este período con los filtros elegidos.</p>
            )}
          </div>

          <button className="btn-primary" onClick={handleExport} disabled={exporting || filtered.length === 0}>
            {exporting ? 'Generando…' : 'Exportar a Excel'}
          </button>
        </div>
      )}
    </div>
  )
}
