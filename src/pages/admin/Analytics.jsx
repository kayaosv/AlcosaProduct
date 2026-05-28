import { useRef, useMemo } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useAdminProducts } from '../../hooks/useAdminProducts.js'
import { useCategories } from '../../hooks/useCategories.js'
import { categoryColor, categoryKind } from '../../lib/productSpecs.js'

const effectivePrice = (p) => Number((p.is_on_sale && p.sale_price) ? p.sale_price : p.price ?? 0)
const marginPct = (p) =>
  p.wholesale_price && p.price ? ((p.price - p.wholesale_price) / p.price) * 100 : 0

export const Analytics = () => {
  const ref = useRef(null)
  const { products, loading } = useAdminProducts()
  const { categories } = useCategories()

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
      if (!map[key]) map[key] = { brand: key, value: 0, units: 0, refs: 0 }
      map[key].value += effectivePrice(p) * p.stock
      map[key].units += p.stock
      map[key].refs += 1
    })
    return Object.values(map).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [products])

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

  const scatterData = useMemo(
    () =>
      products
        .filter((p) => p.wholesale_price && p.price)
        .map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.categories?.slug,
          price: effectivePrice(p),
          margin: parseFloat(marginPct(p).toFixed(1)),
        })),
    [products],
  )

  useGSAP(() => {
    if (loading) return
    gsap.from('.analytics-section', { y: 20, opacity: 0, duration: 0.45, stagger: 0.1, ease: 'power3.out' })
  }, { scope: ref, dependencies: [loading] })

  if (loading) return <div className="page-content"><p style={{ color: '#444' }}>Cargando…</p></div>

  const maxBrand = topBrands[0]?.value || 1
  const maxMargin = Math.max(1, ...marginByCategory.map((c) => c.margin))
  const prices = scatterData.map((d) => d.price)
  const margins = scatterData.map((d) => d.margin)
  const minP = prices.length ? Math.min(...prices) : 0
  const maxP = prices.length ? Math.max(...prices) : 1
  const minM = margins.length ? Math.min(...margins) : 0
  const maxM = margins.length ? Math.max(...margins) : 1
  const sx = (p) => ((p - minP) / (maxP - minP || 1)) * 100
  const sy = (m) => 100 - ((m - minM) / (maxM - minM || 1)) * 100

  return (
    <div ref={ref} className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Distribuciones y métricas del catálogo</p>
        </div>
      </div>

      <div className="dash-row" style={{ marginBottom: 20 }}>
        <div className="analytics-section dash-section dash-section--wide">
          <h2 className="section-title">Margen bruto por categoría</h2>
          {marginByCategory.length === 0 ? (
            <p style={{ color: '#444', fontSize: 12 }}>Sin datos de mayorista todavía.</p>
          ) : (
            <div className="analytics-bar-list">
              {marginByCategory.map((c) => (
                <div key={c.id} className="analytics-bar-row">
                  <div className="analytics-bar-meta">
                    <span className="analytics-bar-name">{c.name}</span>
                    <span className="analytics-bar-value">{c.margin}%</span>
                  </div>
                  <div className="analytics-bar-track">
                    <div
                      className="analytics-bar-fill"
                      style={{ width: `${(c.margin / maxMargin) * 100}%`, background: categoryColor(c.slug) }}
                    />
                  </div>
                  <span className="analytics-bar-sub">{c.count} refs con precio mayorista</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="analytics-section dash-section">
          <h2 className="section-title">Capital inmovilizado por marca</h2>
          <div className="analytics-bar-list">
            {topBrands.map((m) => (
              <div key={m.brand} className="analytics-bar-row">
                <div className="analytics-bar-meta">
                  <span className="analytics-bar-name">{m.brand}</span>
                  <span className="analytics-bar-value">{m.value.toFixed(0)} €</span>
                </div>
                <div className="analytics-bar-track">
                  <div
                    className="analytics-bar-fill"
                    style={{ width: `${(m.value / maxBrand) * 100}%`, background: '#6366f1' }}
                  />
                </div>
                <span className="analytics-bar-sub">{m.refs} refs · {m.units} u.</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dash-row" style={{ marginBottom: 20 }}>
        <div className="analytics-section dash-section">
          <h2 className="section-title">Distribución por nicotina</h2>
          <p className="section-desc">SKUs por nivel de mg en sales y desechables</p>
          {nicotineDist.length === 0 ? (
            <p style={{ color: '#444', fontSize: 12 }}>Sin datos.</p>
          ) : (
            <div className="dist-bars dist-bars--tall">
              {nicotineDist.map((d) => {
                const max = Math.max(...nicotineDist.map((x) => x.count))
                return (
                  <div key={d.mg} className="dist-bar-col">
                    <span className="dist-bar-count">{d.count}</span>
                    <div className="dist-bar-track dist-bar-track--tall">
                      <div className="dist-bar-fill" style={{ height: `${(d.count / max) * 100}%`, background: '#e53935' }} />
                    </div>
                    <span className="dist-bar-label">{d.mg}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="analytics-section dash-section dash-section--wide">
          <h2 className="section-title">Distribución por tamaño (ml)</h2>
          <p className="section-desc">SKUs por volumen final de botella o envase</p>
          {sizeDist.length === 0 ? (
            <p style={{ color: '#444', fontSize: 12 }}>Sin datos.</p>
          ) : (
            <div className="dist-bars dist-bars--tall dist-bars--wide">
              {sizeDist.map((d) => {
                const max = Math.max(...sizeDist.map((x) => x.count))
                return (
                  <div key={d.ml} className="dist-bar-col">
                    <span className="dist-bar-count">{d.count}</span>
                    <div className="dist-bar-track dist-bar-track--tall">
                      <div className="dist-bar-fill" style={{ height: `${(d.count / max) * 100}%`, background: '#8b5cf6' }} />
                    </div>
                    <span className="dist-bar-label">{d.ml}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="analytics-section dash-section">
        <h2 className="section-title">Precio público vs Margen bruto</h2>
        <p className="section-desc">
          Cada punto = un producto. X = PVP (€), Y = margen sobre PVP (%). Ideal: esquina superior derecha.
        </p>
        {scatterData.length === 0 ? (
          <p style={{ color: '#444', fontSize: 12 }}>Sin productos con precio mayorista.</p>
        ) : (
          <>
            <div className="scatter-wrapper">
              <div className="scatter-y-axis">
                <span>{maxM.toFixed(0)}%</span>
                <span>{((maxM + minM) / 2).toFixed(0)}%</span>
                <span>{minM.toFixed(0)}%</span>
              </div>
              <div className="scatter-area">
                <div className="scatter-grid-h" style={{ top: '0%' }} />
                <div className="scatter-grid-h" style={{ top: '50%' }} />
                <div className="scatter-grid-h" style={{ top: '100%' }} />
                <div className="scatter-grid-v" style={{ left: '0%' }} />
                <div className="scatter-grid-v" style={{ left: '50%' }} />
                <div className="scatter-grid-v" style={{ left: '100%' }} />

                {scatterData.map((d) => (
                  <div
                    key={d.id}
                    className="scatter-dot"
                    style={{
                      left: `${sx(d.price)}%`,
                      top: `${sy(d.margin)}%`,
                      background: categoryColor(d.slug),
                    }}
                  >
                    <div className="scatter-tooltip">
                      <strong>{d.name}</strong>
                      <span>{d.price.toFixed(2)} € · {d.margin}% margen</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="scatter-x-axis">
                <span>{minP.toFixed(0)} €</span>
                <span>{((maxP + minP) / 2).toFixed(0)} €</span>
                <span>{maxP.toFixed(0)} €</span>
              </div>
            </div>

            <div className="scatter-legend">
              {categories.map((c) => (
                <div key={c.id} className="scatter-legend-item">
                  <div className="scatter-legend-dot" style={{ background: categoryColor(c.slug) }} />
                  <span>{c.name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
