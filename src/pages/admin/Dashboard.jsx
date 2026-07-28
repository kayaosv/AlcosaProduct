import { useRef, useMemo, useState, useEffect } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Link } from 'react-router-dom'
import { useAdminProducts } from '../../hooks/useAdminProducts.js'
import { useCategories } from '../../hooks/useCategories.js'
import { categoryColor, categoryKind } from '../../lib/productSpecs.js'
import { LOW_STOCK_THRESHOLD } from '../../config/stock.js'
import { supabase } from '../../lib/supabase.js'

const ORDER_HISTORY_DAYS = 14
const LOW_STOCK_VISIBLE = 4

export const Dashboard = () => {
  const ref = useRef(null)
  const { products, loading } = useAdminProducts()
  const { categories } = useCategories()
  const [orders, setOrders] = useState([])
  const [lowStockExpanded, setLowStockExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const since = new Date()
    since.setDate(since.getDate() - (ORDER_HISTORY_DAYS - 1))
    supabase
      .from('orders')
      .select('created_at, payment_method, status')
      .gte('created_at', since.toISOString())
      .then(({ data }) => {
        if (!cancelled) setOrders((data ?? []).filter((o) => o.status !== 'cancelled'))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => {
    const total = products.length
    const outOfStock = products.filter((p) => p.effectiveStock === 0).length
    const inventoryValue = products.reduce((a, p) => a + p.effectivePrice * p.effectiveStock, 0)
    return { total, outOfStock, inventoryValue }
  }, [products])

  const byCategory = useMemo(
    () =>
      categories.map((c) => ({
        ...c,
        count: products.filter((p) => p.category_id === c.id).length,
      })),
    [categories, products],
  )

  // Margen por categoria - promedio de % y, al lado, el margen medio
  // en euros por unidad (precio venta - mayorista) para que el % se
  // pueda leer junto a un numero concreto, no solo abstracto.
  const marginByCategory = useMemo(
    () =>
      categories
        .map((c) => {
          const prods = products.filter((p) => p.category_id === c.id && p.hasWholesale)
          const avgPct = prods.length
            ? prods.reduce((a, p) => a + p.marginPct, 0) / prods.length
            : 0
          const avgEuro = prods.length
            ? prods.reduce((a, p) => a + (p.effectivePrice - (p.effectiveWholesalePrice ?? 0)), 0) / prods.length
            : 0
          return { ...c, margin: parseFloat(avgPct.toFixed(1)), marginEuro: avgEuro, count: prods.length }
        })
        .filter((c) => c.count > 0)
        .sort((a, b) => b.margin - a.margin),
    [categories, products],
  )

  const topBrands = useMemo(() => {
    const map = {}
    products.forEach((p) => {
      const key = p.brand || 'Sin marca'
      if (!map[key]) map[key] = { brand: key, value: 0, units: 0, count: 0 }
      map[key].value += p.effectivePrice * p.effectiveStock
      map[key].units += p.effectiveStock
      map[key].count += 1
    })
    return Object.values(map).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [products])

  const lowStock = useMemo(
    () => products.filter((p) => p.effectiveStock <= LOW_STOCK_THRESHOLD).sort((a, b) => a.effectiveStock - b.effectiveStock),
    [products],
  )

  const nicotineDist = useMemo(() => {
    const map = {}
    products.forEach((p) => {
      const mg = p.details?.nicotine_mg
      if (mg == null) return
      const key = `${mg}mg`
      map[key] = (map[key] || 0) + 1
    })
    return Object.entries(map)
      .map(([mg, count]) => ({ mg, count }))
      .sort((a, b) => parseInt(a.mg) - parseInt(b.mg))
  }, [products])

  const sizeDist = useMemo(() => {
    const map = {}
    products.forEach((p) => {
      const slug = categories.find((c) => c.id === p.category_id)?.slug
      const k = categoryKind(slug)
      let ml = null
      if (k === 'sales') ml = p.details?.size_ml
      else if (k === 'longfill') ml = p.details?.bottle_ml
      if (!ml) return
      const key = `${ml}ml`
      map[key] = (map[key] || 0) + 1
    })
    return Object.entries(map)
      .map(([ml, count]) => ({ ml, count }))
      .sort((a, b) => parseInt(a.ml) - parseInt(b.ml))
  }, [products, categories])

  // Historial de pedidos online (web) vs fisica (TPV), ultimos N dias -
  // 'pos_efectivo'/'pos_tarjeta' vienen del TPV en tienda, todo lo demas
  // (stripe/pickup) se origina en la web.
  const orderHistory = useMemo(() => {
    const days = []
    const now = new Date()
    for (let i = ORDER_HISTORY_DAYS - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      days.push({
        date: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
        online: 0,
        fisica: 0,
      })
    }
    const byDate = Object.fromEntries(days.map((d) => [d.date, d]))
    orders.forEach((o) => {
      const key = (o.created_at ?? '').slice(0, 10)
      const bucket = byDate[key]
      if (!bucket) return
      if ((o.payment_method ?? '').startsWith('pos_')) bucket.fisica += 1
      else bucket.online += 1
    })
    return days
  }, [orders])

  const orderHistoryAvg = orderHistory.length
    ? orderHistory.reduce((s, d) => s + d.online + d.fisica, 0) / orderHistory.length
    : 0
  const orderHistoryMax = Math.max(1, ...orderHistory.map((d) => d.online + d.fisica))
  const orderHistoryTotal = orderHistory.reduce((s, d) => s + d.online + d.fisica, 0)

  useGSAP(() => {
    if (loading) return
    gsap.from('.stat-card', { y: 24, opacity: 0, duration: 0.5, stagger: 0.08, ease: 'power3.out' })
    gsap.from('.dash-section', { y: 16, opacity: 0, duration: 0.5, stagger: 0.08, delay: 0.3, ease: 'power3.out' })
  }, { scope: ref, dependencies: [loading] })

  if (loading) {
    return (
      <div className="page-content">
        <p style={{ color: '#444' }}>Cargando…</p>
      </div>
    )
  }

  const maxTopBrand = topBrands[0]?.value || 1
  const maxNic = Math.max(1, ...nicotineDist.map((x) => x.count))
  const maxSize = Math.max(1, ...sizeDist.map((x) => x.count))
  const visibleLowStock = lowStockExpanded ? lowStock : lowStock.slice(0, LOW_STOCK_VISIBLE)

  return (
    <div ref={ref} className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Resumen general del catálogo</p>
        </div>
        <div className="dash-quick-links">
          <Link to="/admin/orders" className="btn-ghost">📋 Pedidos</Link>
          <Link to="/admin/tpv" className="btn-ghost">💳 TPV / Ventas</Link>
          <Link to="/admin/stock-scanner" className="btn-ghost">📷 Escanear</Link>
          <Link to="/admin/products/new" className="btn-primary">+ Nuevo producto</Link>
        </div>
      </div>

      <div className="dash-two-col">
        {/* ── COLUMNA IZQUIERDA: producto / margen ── */}
        <div className="dash-col">
          <div className="stats-grid stats-grid--compact">
            <div className="stat-card stat-card--sm">
              <span className="stat-label">Total productos</span>
              <span className="stat-value stat-value--sm">{stats.total}</span>
            </div>
            <div className="stat-card stat-card--sm">
              <span className="stat-label">Valor inventario</span>
              <span className="stat-value stat-value--sm">{stats.inventoryValue.toFixed(0)} €</span>
            </div>
          </div>

          <div className="dash-section">
            <h2 className="section-title">Margen por categoría</h2>
            <div className="cat-bars">
              {marginByCategory.length === 0 && (
                <p style={{ color: '#444', fontSize: 12 }}>Sin datos de mayorista todavía.</p>
              )}
              {marginByCategory.map((c) => (
                <div key={c.id} className="cat-bar-row">
                  <span className="cat-bar-label">{c.name}</span>
                  <div className="cat-bar-track">
                    <div
                      className="cat-bar-fill"
                      style={{ width: `${c.margin}%`, background: categoryColor(c.slug, c.color) }}
                    />
                  </div>
                  <span className="cat-bar-count cat-bar-count--margen">
                    {c.margin}% <span className="cat-bar-count--euro">(≈{c.marginEuro.toFixed(2)}€)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="dash-section">
            <h2 className="section-title">Por categoría (cantidad)</h2>
            <div className="cat-bars">
              {byCategory.map((c) => (
                <div key={c.id} className="cat-bar-row">
                  <span className="cat-bar-label">{c.name}</span>
                  <div className="cat-bar-track">
                    <div
                      className="cat-bar-fill"
                      style={{
                        width: `${stats.total ? (c.count / stats.total) * 100 : 0}%`,
                        background: categoryColor(c.slug, c.color),
                      }}
                    />
                  </div>
                  <span className="cat-bar-count">{c.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── COLUMNA DERECHA: stock ── */}
        <div className="dash-col">
          <div className="stats-grid stats-grid--compact stats-grid--1">
            <div className="stat-card stat-card--sm stat-card--warn">
              <span className="stat-label">Sin stock</span>
              <span className="stat-value stat-value--sm">{stats.outOfStock}</span>
              <span className="stat-hint">requieren reposición</span>
            </div>
          </div>

          <div className="dash-section">
            <h2 className="section-title">Stock bajo</h2>
            <div className={`alert-list alert-list--scroll ${lowStockExpanded ? 'alert-list--expanded' : ''}`}>
              {lowStock.length === 0 && (
                <p style={{ color: '#444', fontSize: 12 }}>Todo en orden.</p>
              )}
              {visibleLowStock.map((p) => (
                <Link key={p.id} to={`/admin/products/${p.id}`} className="alert-row">
                  <div className="alert-info">
                    <span className="alert-name">{p.name}</span>
                    <span className="alert-marca">{p.brand || '—'}</span>
                  </div>
                  <span className={`stock-badge ${p.effectiveStock === 0 ? 'stock-badge--empty' : 'stock-badge--low'}`}>
                    {p.effectiveStock === 0 ? 'AGOTADO' : `${p.effectiveStock} u.`}
                  </span>
                </Link>
              ))}
            </div>
            {lowStock.length > LOW_STOCK_VISIBLE && (
              <button className="btn-ghost alert-list-toggle" onClick={() => setLowStockExpanded((v) => !v)}>
                {lowStockExpanded ? 'Ver menos' : `Ver ${lowStock.length - LOW_STOCK_VISIBLE} más`}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="dash-row" style={{ margin: '20px 0' }}>
        <div className="dash-section dash-section--wide">
          <h2 className="section-title">Top marcas por valor en stock</h2>
          <div className="cat-bars">
            {topBrands.map((m) => (
              <div key={m.brand} className="cat-bar-row cat-bar-row--marca">
                <span className="cat-bar-label">{m.brand}</span>
                <div className="cat-bar-track">
                  <div
                    className="cat-bar-fill"
                    style={{ width: `${(m.value / maxTopBrand) * 100}%`, background: '#6366f1' }}
                  />
                </div>
                <span className="cat-bar-count">{m.value.toFixed(0)} €</span>
              </div>
            ))}
          </div>
        </div>

        <div className="dash-section">
          <h2 className="section-title">Historial de pedidos ({ORDER_HISTORY_DAYS}d)</h2>
          {orderHistoryTotal === 0 ? (
            <p style={{ color: '#444', fontSize: 12 }}>Sin pedidos registrados en este período.</p>
          ) : (
            <>
              <div className="order-history-chart">
                <div
                  className="order-history-avg-line"
                  style={{ bottom: `${(orderHistoryAvg / orderHistoryMax) * 100}%` }}
                  title={`Promedio: ${orderHistoryAvg.toFixed(1)} pedidos/día`}
                />
                {orderHistory.map((d) => (
                  <div key={d.date} className="order-history-col">
                    <div className="order-history-bars">
                      <div
                        className="order-history-bar order-history-bar--online"
                        style={{ height: `${(d.online / orderHistoryMax) * 100}%` }}
                        title={`${d.online} online`}
                      />
                      <div
                        className="order-history-bar order-history-bar--fisica"
                        style={{ height: `${(d.fisica / orderHistoryMax) * 100}%` }}
                        title={`${d.fisica} física`}
                      />
                    </div>
                    <span className="order-history-label">{d.label}</span>
                  </div>
                ))}
              </div>
              <div className="order-history-legend">
                <span><i className="order-history-dot order-history-dot--online" /> Online</span>
                <span><i className="order-history-dot order-history-dot--fisica" /> Física (TPV)</span>
                <span className="order-history-avg-label">Promedio: {orderHistoryAvg.toFixed(1)}/día</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="dash-row">
        <div className="dash-section">
          <h2 className="section-title">Distribución nicotina (mg)</h2>
          {nicotineDist.length === 0 ? (
            <p style={{ color: '#444', fontSize: 12 }}>Sin productos con nicotina.</p>
          ) : (
            <div className="dist-bars">
              {nicotineDist.map((d) => (
                <div key={d.mg} className="dist-bar-col">
                  <span className="dist-bar-count">{d.count}</span>
                  <div className="dist-bar-track">
                    <div className="dist-bar-fill" style={{ height: `${(d.count / maxNic) * 100}%`, background: '#e53935' }} />
                  </div>
                  <span className="dist-bar-label">{d.mg}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dash-section dash-section--wide">
          <h2 className="section-title">Distribución tamaños (ml)</h2>
          {sizeDist.length === 0 ? (
            <p style={{ color: '#444', fontSize: 12 }}>Sin datos de tamaños.</p>
          ) : (
            <div className="dist-bars dist-bars--wide">
              {sizeDist.map((d) => (
                <div key={d.ml} className="dist-bar-col">
                  <span className="dist-bar-count">{d.count}</span>
                  <div className="dist-bar-track">
                    <div className="dist-bar-fill" style={{ height: `${(d.count / maxSize) * 100}%`, background: '#8b5cf6' }} />
                  </div>
                  <span className="dist-bar-label">{d.ml}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
