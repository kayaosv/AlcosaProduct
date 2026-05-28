import { useRef, useMemo } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Link } from 'react-router-dom'
import { useAdminProducts } from '../../hooks/useAdminProducts.js'
import { useCategories } from '../../hooks/useCategories.js'
import { categoryColor, categoryKind } from '../../lib/productSpecs.js'

const effectivePrice = (p) => Number((p.is_on_sale && p.sale_price) ? p.sale_price : p.price ?? 0)
const marginPct = (p) =>
  p.wholesale_price && p.price ? ((p.price - p.wholesale_price) / p.price) * 100 : 0

export const Dashboard = () => {
  const ref = useRef(null)
  const { products, loading } = useAdminProducts()
  const { categories } = useCategories()

  const stats = useMemo(() => {
    const total = products.length
    const outOfStock = products.filter((p) => p.stock === 0).length
    const featured = products.filter((p) => p.is_featured).length
    const inventoryValue = products.reduce((a, p) => a + effectivePrice(p) * p.stock, 0)
    const withMargin = products.filter((p) => p.wholesale_price)
    const avgMargin = withMargin.length
      ? withMargin.reduce((a, p) => a + marginPct(p), 0) / withMargin.length
      : 0
    return { total, outOfStock, featured, inventoryValue, avgMargin }
  }, [products])

  const byCategory = useMemo(
    () =>
      categories.map((c) => ({
        ...c,
        count: products.filter((p) => p.category_id === c.id).length,
      })),
    [categories, products],
  )

  const marginByCategory = useMemo(
    () =>
      categories
        .map((c) => {
          const prods = products.filter((p) => p.category_id === c.id && p.wholesale_price)
          const avg = prods.length
            ? prods.reduce((a, p) => a + marginPct(p), 0) / prods.length
            : 0
          return { ...c, margin: parseFloat(avg.toFixed(1)), count: prods.length }
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
      map[key].value += effectivePrice(p) * p.stock
      map[key].units += p.stock
      map[key].count += 1
    })
    return Object.values(map).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [products])

  const lowStock = useMemo(
    () => products.filter((p) => p.stock <= 10).sort((a, b) => a.stock - b.stock).slice(0, 6),
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

  return (
    <div ref={ref} className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Resumen general del catálogo</p>
        </div>
        <Link to="/admin/products/new" className="btn-primary">+ Nuevo producto</Link>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total productos</span>
          <span className="stat-value">{stats.total}</span>
          <span className="stat-hint">en catálogo</span>
        </div>
        <div className="stat-card stat-card--warn">
          <span className="stat-label">Sin stock</span>
          <span className="stat-value">{stats.outOfStock}</span>
          <span className="stat-hint">requieren reposición</span>
        </div>
        <div className="stat-card stat-card--green">
          <span className="stat-label">Margen medio global</span>
          <span className="stat-value">{stats.avgMargin.toFixed(1)}%</span>
          <span className="stat-hint">precio venta vs mayorista</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Valor inventario</span>
          <span className="stat-value">{stats.inventoryValue.toFixed(0)} €</span>
          <span className="stat-hint">precio venta × stock</span>
        </div>
      </div>

      <div className="dash-row dash-row--3" style={{ marginBottom: 20 }}>
        <div className="dash-section dash-section--wide">
          <h2 className="section-title">Por categoría</h2>
          <div className="cat-bars">
            {byCategory.map((c) => (
              <div key={c.id} className="cat-bar-row">
                <span className="cat-bar-label">{c.name}</span>
                <div className="cat-bar-track">
                  <div
                    className="cat-bar-fill"
                    style={{
                      width: `${stats.total ? (c.count / stats.total) * 100 : 0}%`,
                      background: categoryColor(c.slug),
                    }}
                  />
                </div>
                <span className="cat-bar-count">{c.count}</span>
              </div>
            ))}
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
                    style={{ width: `${c.margin}%`, background: categoryColor(c.slug) }}
                  />
                </div>
                <span className="cat-bar-count cat-bar-count--margen">{c.margin}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dash-row" style={{ marginBottom: 20 }}>
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
          <h2 className="section-title">Stock bajo</h2>
          <div className="alert-list">
            {lowStock.length === 0 && (
              <p style={{ color: '#444', fontSize: 12 }}>Todo en orden.</p>
            )}
            {lowStock.map((p) => (
              <Link key={p.id} to={`/admin/products/${p.id}`} className="alert-row">
                <div className="alert-info">
                  <span className="alert-name">{p.name}</span>
                  <span className="alert-marca">{p.brand || '—'}</span>
                </div>
                <span className={`stock-badge ${p.stock === 0 ? 'stock-badge--empty' : 'stock-badge--low'}`}>
                  {p.stock === 0 ? 'AGOTADO' : `${p.stock} u.`}
                </span>
              </Link>
            ))}
          </div>
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
