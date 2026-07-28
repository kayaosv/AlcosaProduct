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
const PAYMENT_LABELS = {
  stripe: 'Stripe', pickup: 'Recogida', pos_efectivo: 'Efectivo (TPV)', pos_tarjeta: 'Tarjeta (TPV)',
}

const isPhysical = (paymentMethod) => (paymentMethod ?? '').startsWith('pos_')

// Grafico de lineas hecho a mano (sin libreria) - misma filosofia que
// el resto de barras del dashboard, solo que en forma de SVG con
// preserveAspectRatio="none" para que estire sin depender de medir
// pixeles reales del contenedor.
const SalesLineChart = ({ days }) => {
  const max = Math.max(1, ...days.map((d) => Math.max(d.online, d.fisica)))
  const n = days.length
  const toPoints = (getValue) =>
    days.map((d, i) => `${n > 1 ? (i / (n - 1)) * 100 : 50},${100 - (getValue(d) / max) * 100}`).join(' ')
  const onlinePoints = toPoints((d) => d.online)
  const fisicaPoints = toPoints((d) => d.fisica)
  const trendPoints = toPoints((d) => (d.online + d.fisica) / 2)

  return (
    <svg className="sales-line-chart" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline points={trendPoints} className="sales-line sales-line--trend" />
      <polyline points={onlinePoints} className="sales-line sales-line--online" />
      <polyline points={fisicaPoints} className="sales-line sales-line--fisica" />
    </svg>
  )
}

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
      .select('id, created_at, payment_method, status, total')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
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

  // Margen por categoria - % promedio y, al lado, el margen medio en
  // euros por unidad (precio venta - mayorista) - la ganancia
  // aproximada de vender una unidad mas de esa categoria, no el valor
  // total de inventario.
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
    return Object.values(map).sort((a, b) => b.value - a.value)
  }, [products])

  const lowStock = useMemo(
    () => products.filter((p) => p.effectiveStock <= LOW_STOCK_THRESHOLD).sort((a, b) => a.effectiveStock - b.effectiveStock),
    [products],
  )

  // Antes mezclaba nicotina/tamaños de TODAS las categorias en un solo
  // bucket ("6mg: 12" sin decir de que producto) - ahora separado por
  // kind real, un mini-grupo de barras por categoria que usa ese campo.
  const nicotineByKind = useMemo(() => {
    const groups = {}
    products.forEach((p) => {
      const mg = p.details?.nicotine_mg
      if (mg == null) return
      const slug = categories.find((c) => c.id === p.category_id)?.slug
      const k = categoryKind(slug)
      if (k !== 'sales' && k !== 'desechables') return
      const label = k === 'sales' ? 'Sales de Nicotina' : 'Desechables'
      if (!groups[label]) groups[label] = {}
      const key = `${mg}mg`
      groups[label][key] = (groups[label][key] || 0) + 1
    })
    return Object.entries(groups).map(([label, map]) => ({
      label,
      data: Object.entries(map)
        .map(([mg, count]) => ({ mg, count }))
        .sort((a, b) => parseInt(a.mg) - parseInt(b.mg)),
    }))
  }, [products, categories])

  const sizeByKind = useMemo(() => {
    const groups = {}
    products.forEach((p) => {
      const slug = categories.find((c) => c.id === p.category_id)?.slug
      const k = categoryKind(slug)
      let ml = null
      let label = null
      if (k === 'sales') { ml = p.details?.size_ml; label = 'Sales de Nicotina' }
      else if (k === 'longfill') { ml = p.details?.bottle_ml; label = slug === 'minilongfill' ? 'Minilongfill' : 'Longfill' }
      if (!ml) return
      if (!groups[label]) groups[label] = {}
      const key = `${ml}ml`
      groups[label][key] = (groups[label][key] || 0) + 1
    })
    return Object.entries(groups).map(([label, map]) => ({
      label,
      data: Object.entries(map)
        .map(([ml, count]) => ({ ml, count }))
        .sort((a, b) => parseInt(a.ml) - parseInt(b.ml)),
    }))
  }, [products, categories])

  // Historial de pedidos: fisica (TPV) vs online (web), ultimos N dias.
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
      if (isPhysical(o.payment_method)) bucket.fisica += 1
      else bucket.online += 1
    })
    return days
  }, [orders])

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

      {/* ── Fila 1: ventas (lineas) + historial de pedidos ── */}
      <div className="dash-row" style={{ marginBottom: 20 }}>
        <div className="dash-section dash-section--wide">
          <h2 className="section-title">Ventas — física vs online</h2>
          {orderHistoryTotal === 0 ? (
            <p style={{ color: '#444', fontSize: 12 }}>Sin pedidos registrados en este período.</p>
          ) : (
            <>
              <div className="sales-line-wrap">
                <SalesLineChart days={orderHistory} />
              </div>
              <div className="sales-line-axis">
                <span>{orderHistory[0]?.label}</span>
                <span>{orderHistory[orderHistory.length - 1]?.label}</span>
              </div>
              <div className="order-history-legend">
                <span><i className="order-history-dot order-history-dot--online" /> Online</span>
                <span><i className="order-history-dot order-history-dot--fisica" /> Física (TPV)</span>
                <span><i className="order-history-dot order-history-dot--trend" /> Tendencia media</span>
              </div>
            </>
          )}
        </div>

        <div className="dash-section">
          <h2 className="section-title">Historial de pedidos</h2>
          <div className="alert-list alert-list--scroll">
            {orders.length === 0 && (
              <p style={{ color: '#444', fontSize: 12 }}>Sin pedidos en este período.</p>
            )}
            {orders.slice(0, 25).map((o) => (
              <Link key={o.id} to={`/admin/orders/${o.id}`} className="alert-row order-row">
                <div className="alert-info">
                  <span className="alert-name">
                    {new Date(o.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                    {' · '}
                    {PAYMENT_LABELS[o.payment_method] ?? o.payment_method}
                  </span>
                  <span className="alert-marca">{isPhysical(o.payment_method) ? 'Física (TPV)' : 'Online'}</span>
                </div>
                <span className="order-row-total">{Number(o.total ?? 0).toFixed(2)} €</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Fila 2: totales ── */}
      <div className="stats-grid stats-grid--compact" style={{ marginBottom: 20 }}>
        <div className="stat-card stat-card--sm">
          <span className="stat-label">Total productos</span>
          <span className="stat-value stat-value--sm">{stats.total}</span>
        </div>
        <div className="stat-card stat-card--sm">
          <span className="stat-label">Valor inventario</span>
          <span className="stat-value stat-value--sm">{stats.inventoryValue.toFixed(0)} €</span>
        </div>
        <div className="stat-card stat-card--sm stat-card--warn">
          <span className="stat-label">Sin stock</span>
          <span className="stat-value stat-value--sm">{stats.outOfStock}</span>
        </div>
      </div>

      {/* ── Fila 3: margen por categoria, en cards chicas ── */}
      <div className="dash-section" style={{ marginBottom: 20 }}>
        <h2 className="section-title">Margen por categoría</h2>
        <p style={{ color: '#444', fontSize: 11, margin: '-12px 0 16px' }}>
          El € es la ganancia aproximada por unidad vendida (precio venta − mayorista), promediada entre los productos de esa categoría con precio mayorista cargado.
        </p>
        {marginByCategory.length === 0 ? (
          <p style={{ color: '#444', fontSize: 12 }}>Sin datos de mayorista todavía.</p>
        ) : (
          <div className="margin-card-grid">
            {marginByCategory.map((c) => (
              <div key={c.id} className="margin-card">
                <span className="margin-card-cat" style={{ color: categoryColor(c.slug, c.color) }}>{c.name}</span>
                <span className="margin-card-pct">{c.margin}%</span>
                <span className="margin-card-euro">≈{c.marginEuro.toFixed(2)} €/u</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Fila 4: cantidad por categoria + stock bajo ── */}
      <div className="dash-row" style={{ marginBottom: 20 }}>
        <div className="dash-section">
          <h2 className="section-title">Por categoría (cantidad)</h2>
          <div className="cat-bars cat-bars--scroll">
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

      {/* ── Fila 5: top marcas ── */}
      <div className="dash-section" style={{ marginBottom: 20 }}>
        <h2 className="section-title">Top marcas por valor en stock</h2>
        <div className="cat-bars cat-bars--scroll">
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

      {/* ── Fila 6: distribucion nicotina / tamaños, separado por categoria real ── */}
      <div className="dash-row">
        <div className="dash-section">
          <h2 className="section-title">Nicotina (mg) por categoría</h2>
          {nicotineByKind.length === 0 ? (
            <p style={{ color: '#444', fontSize: 12 }}>Sin productos con nicotina.</p>
          ) : (
            nicotineByKind.map((g) => {
              const max = Math.max(1, ...g.data.map((d) => d.count))
              return (
                <div key={g.label} className="dist-group">
                  <span className="dist-group-label">{g.label}</span>
                  <div className="dist-bars dist-bars--sm">
                    {g.data.map((d) => (
                      <div key={d.mg} className="dist-bar-col">
                        <span className="dist-bar-count">{d.count}</span>
                        <div className="dist-bar-track dist-bar-track--sm">
                          <div className="dist-bar-fill" style={{ height: `${(d.count / max) * 100}%`, background: '#e53935' }} />
                        </div>
                        <span className="dist-bar-label">{d.mg}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="dash-section">
          <h2 className="section-title">Tamaños (ml) por categoría</h2>
          {sizeByKind.length === 0 ? (
            <p style={{ color: '#444', fontSize: 12 }}>Sin datos de tamaños.</p>
          ) : (
            sizeByKind.map((g) => {
              const max = Math.max(1, ...g.data.map((d) => d.count))
              return (
                <div key={g.label} className="dist-group">
                  <span className="dist-group-label">{g.label}</span>
                  <div className="dist-bars dist-bars--sm">
                    {g.data.map((d) => (
                      <div key={d.ml} className="dist-bar-col">
                        <span className="dist-bar-count">{d.count}</span>
                        <div className="dist-bar-track dist-bar-track--sm">
                          <div className="dist-bar-fill" style={{ height: `${(d.count / max) * 100}%`, background: '#8b5cf6' }} />
                        </div>
                        <span className="dist-bar-label">{d.ml}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
