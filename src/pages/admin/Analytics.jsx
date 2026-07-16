import { useRef, useMemo, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useAnalyticsData, getStock, getEffectivePrice, getWholesalePrice, getMarginPct, hasWholesale } from '../../hooks/useAnalyticsData.js'
import { useCategories } from '../../hooks/useCategories.js'
import { categoryColor, categoryKind } from '../../lib/productSpecs.js'

export const Analytics = () => {
  const ref = useRef(null)
  const { products, loading } = useAnalyticsData()
  const { categories } = useCategories()

  // ── Margen bruto por categoría ──────────────────────────────────────────
  const marginByCategory = useMemo(
    () =>
      categories
        .map((c) => {
          const prods = products.filter((p) => p.category_id === c.id && hasWholesale(p))
          const avg = prods.length
            ? prods.reduce((a, p) => a + getMarginPct(p), 0) / prods.length
            : 0
          return { ...c, margin: parseFloat(avg.toFixed(1)), count: prods.length }
        })
        .filter((c) => c.count > 0)
        .sort((a, b) => b.margin - a.margin),
    [categories, products],
  )

  // ── Capital inmovilizado por marca ──────────────────────────────────────
  const topBrands = useMemo(() => {
    const map = {}
    products.forEach((p) => {
      const key = p.brand || 'Sin marca'
      if (!map[key]) map[key] = { brand: key, value: 0, units: 0, refs: 0 }
      const vv = (p.product_variants ?? []).filter((v) => v.is_active !== false)
      if (vv.length) {
        vv.forEach((v) => {
          const price = v.price ?? p.price ?? 0
          const effective = (p.is_on_sale && v.sale_price) ? v.sale_price : price
          map[key].value += effective * (v.stock || 0)
          map[key].units += v.stock || 0
        })
      } else {
        map[key].value += getEffectivePrice(p) * getStock(p)
        map[key].units += getStock(p)
      }
      map[key].refs += 1
    })
    return Object.values(map).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [products])

  // ── Distribución nicotina ───────────────────────────────────────────────
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

  // ── Distribución tamaño ml ──────────────────────────────────────────────
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

  // ── KPIs ────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalStock = products.reduce((s, p) => s + getStock(p), 0)
    const totalValue = products.reduce((s, p) => s + getEffectivePrice(p) * getStock(p), 0)
    const withMargin = products.filter(hasWholesale)
    const avgMargin = withMargin.length
      ? withMargin.reduce((s, p) => s + getMarginPct(p), 0) / withMargin.length
      : 0
    const onSale = products.filter((p) => p.is_on_sale).length
    return { totalStock, totalValue, avgMargin, onSale, total: products.length }
  }, [products])

  // ── States ──────────────────────────────────────────────────────────────
  const [scatterCat, setScatterCat] = useState(null)
  const [filterCat, setFilterCat]   = useState(null)
  const [sortField, setSortField]   = useState('margin')
  const [sortDir, setSortDir]       = useState('desc')
  const [showAll, setShowAll]       = useState(false)

  // ── Scatter data (recomputed on filter) ────────────────────────────────
  const scatterAll = useMemo(
    () =>
      products
        .filter(hasWholesale)
        .map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.categories?.slug,
          catName: p.categories?.name || '',
          price: getEffectivePrice(p),
          margin: parseFloat(getMarginPct(p).toFixed(1)),
          hasVariants: (p.product_variants ?? []).length > 0,
        })),
    [products],
  )

  const scatterData = useMemo(
    () => scatterCat ? scatterAll.filter((d) => d.slug === scatterCat) : scatterAll,
    [scatterAll, scatterCat],
  )

  useGSAP(
    () => {
      if (loading) return
      gsap.from('.analytics-section', { y: 20, opacity: 0, duration: 0.45, stagger: 0.1, ease: 'power3.out' })
    },
    { scope: ref, dependencies: [loading] },
  )

  if (loading) return <div className="page-content"><p style={{ color: '#444' }}>Cargando…</p></div>

  // ── Scatter axes — always based on full dataset so positions never jump ──
  const allPrices  = scatterAll.map((d) => d.price)
  const allMargins = scatterAll.map((d) => d.margin)
  const minP = allPrices.length  ? Math.min(...allPrices)  : 0
  const maxP = allPrices.length  ? Math.max(...allPrices)  : 1
  const minM = allMargins.length ? Math.min(...allMargins) : 0
  const maxM = allMargins.length ? Math.max(...allMargins) : 1
  const sx = (p) => ((p - minP) / (maxP - minP || 1)) * 100
  const sy = (m) => 100 - ((m - minM) / (maxM - minM || 1)) * 100

  const catsInScatter = Array.from(new Set(scatterAll.map((d) => d.slug)))
    .map((slug) => ({ slug, name: scatterAll.find((d) => d.slug === slug)?.catName || slug }))

  // ── Table ───────────────────────────────────────────────────────────────
  const maxBrand  = topBrands[0]?.value || 1
  const maxMargin = Math.max(1, ...marginByCategory.map((c) => c.margin))

  const marginBadge = (m) =>
    m >= 40 ? 'margin-badge margin-badge--high' :
    m >= 25 ? 'margin-badge margin-badge--mid'  : 'margin-badge margin-badge--low'

  const tableRows = products
    .filter(hasWholesale)
    .filter((p) => !filterCat || p.categories?.slug === filterCat)
    .map((p) => ({
      id: p.id, name: p.name, brand: p.brand || '—',
      catName: p.categories?.name || '—', catSlug: p.categories?.slug,
      pvp: getEffectivePrice(p),
      wholesale: getWholesalePrice(p) ?? 0,
      margin: parseFloat(getMarginPct(p).toFixed(1)),
      stock: getStock(p),
      capital: parseFloat((getEffectivePrice(p) * getStock(p)).toFixed(2)),
      hasVariants: (p.product_variants ?? []).length > 0,
    }))
    .sort((a, b) => {
      const v = a[sortField] < b[sortField] ? -1 : a[sortField] > b[sortField] ? 1 : 0
      return sortDir === 'desc' ? -v : v
    })

  const PAGE    = 40
  const visible = showAll ? tableRows : tableRows.slice(0, PAGE)

  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else { setSortField(field); setSortDir('desc') }
  }
  const arrow = (field) => sortField === field ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''

  const catsWithData = categories.filter((c) =>
    products.some((p) => p.categories?.slug === c.slug && hasWholesale(p)),
  )

  return (
    <div ref={ref} className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Distribuciones y métricas del catálogo</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="analytics-section dash-row" style={{ marginBottom: 20, gap: 12 }}>
        {[
          { label: 'Referencias',  value: kpis.total },
          { label: 'Uds. en stock', value: kpis.totalStock.toLocaleString('es') },
          { label: 'Capital stock', value: `${kpis.totalValue.toLocaleString('es', { maximumFractionDigits: 0 })} €` },
          { label: 'Margen medio', value: `${kpis.avgMargin.toFixed(1)}%` },
          { label: 'En oferta',    value: kpis.onSale },
        ].map((k) => (
          <div key={k.label} className="dash-section" style={{ flex: 1, minWidth: 120 }}>
            <p className="section-desc" style={{ marginBottom: 4 }}>{k.label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#e8e8e8', margin: 0 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Margen + Capital */}
      <div className="dash-row" style={{ marginBottom: 20 }}>
        <div className="analytics-section dash-section dash-section--wide">
          <h2 className="section-title">Margen bruto por categoría</h2>
          <p className="section-desc">Incluye precios de variantes cuando aplica</p>
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
                    <div className="analytics-bar-fill"
                      style={{ width: `${(c.margin / maxMargin) * 100}%`, background: categoryColor(c.slug) }} />
                  </div>
                  <span className="analytics-bar-sub">{c.count} refs con precio mayorista</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="analytics-section dash-section">
          <h2 className="section-title">Capital inmovilizado por marca</h2>
          <p className="section-desc">Stock × precio efectivo (variante o producto)</p>
          <div className="analytics-bar-list">
            {topBrands.map((m) => (
              <div key={m.brand} className="analytics-bar-row">
                <div className="analytics-bar-meta">
                  <span className="analytics-bar-name">{m.brand}</span>
                  <span className="analytics-bar-value">{m.value.toFixed(0)} €</span>
                </div>
                <div className="analytics-bar-track">
                  <div className="analytics-bar-fill"
                    style={{ width: `${(m.value / maxBrand) * 100}%`, background: '#6366f1' }} />
                </div>
                <span className="analytics-bar-sub">{m.refs} refs · {m.units} u.</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Distribuciones */}
      <div className="dash-row" style={{ marginBottom: 20 }}>
        <div className="analytics-section dash-section">
          <h2 className="section-title">Distribución por nicotina</h2>
          <p className="section-desc">SKUs por nivel de mg</p>
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
          <p className="section-desc">SKUs por volumen de botella o envase</p>
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

      {/* Scatter filtrable */}
      <div className="analytics-section dash-section" style={{ marginBottom: 20 }}>
        <h2 className="section-title">PVP vs Margen bruto</h2>
        <p className="section-desc">
          {scatterCat
            ? `${scatterAll.filter(d => d.slug === scatterCat).length} activos · resto dimado — clic de nuevo para ver todo`
            : `${scatterAll.length} productos con precio mayorista · clic en una categoría para aislarla`}
        </p>

        {scatterAll.length === 0 ? (
          <p style={{ color: '#444', fontSize: 12 }}>Sin productos con precio mayorista.</p>
        ) : (
          <>
            {/* Leyenda clicable */}
            <div className="scatter-legend" style={{ marginBottom: 12, cursor: 'pointer' }}>
              {catsInScatter.map((c) => {
                const active = !scatterCat || scatterCat === c.slug
                return (
                  <div
                    key={c.slug}
                    className="scatter-legend-item"
                    style={{ opacity: active ? 1 : 0.3, transition: 'opacity 0.2s', cursor: 'pointer' }}
                    onClick={() => setScatterCat(scatterCat === c.slug ? null : c.slug)}
                  >
                    <div className="scatter-legend-dot" style={{ background: categoryColor(c.slug) }} />
                    <span>{c.name}</span>
                  </div>
                )
              })}
            </div>

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

                {scatterAll.map((d) => {
                  const active = !scatterCat || d.slug === scatterCat
                  return (
                    <div
                      key={d.id}
                      className="scatter-dot"
                      style={{
                        left: `${sx(d.price)}%`,
                        top:  `${sy(d.margin)}%`,
                        background: categoryColor(d.slug),
                        width:   active && scatterCat ? 12 : 9,
                        height:  active && scatterCat ? 12 : 9,
                        opacity: active ? 1 : 0.08,
                        pointerEvents: active ? 'auto' : 'none',
                        transition: 'opacity 0.2s, width 0.2s, height 0.2s',
                        zIndex: active ? 2 : 1,
                      }}
                    >
                      {active && (
                        <div className="scatter-tooltip">
                          <strong>{d.name}</strong>
                          <span>{d.price.toFixed(2)} € · {d.margin}% margen</span>
                          {d.hasVariants && <span style={{ color: '#818cf8' }}>precio variante principal</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="scatter-x-axis">
                <span>{minP.toFixed(0)} €</span>
                <span>{((maxP + minP) / 2).toFixed(0)} €</span>
                <span>{maxP.toFixed(0)} €</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tabla de rentabilidad */}
      <div className="analytics-section dash-section">
        <h2 className="section-title">Rentabilidad por producto</h2>
        <p className="section-desc">
          {tableRows.length} referencias con precio mayorista · ordena por columna
        </p>

        <div className="profit-filters">
          <button
            className={`profit-filter-btn ${!filterCat ? 'profit-filter-btn--active' : ''}`}
            onClick={() => setFilterCat(null)}
          >Todas</button>
          {catsWithData.map((c) => (
            <button
              key={c.id}
              className={`profit-filter-btn ${filterCat === c.slug ? 'profit-filter-btn--active' : ''}`}
              style={filterCat === c.slug ? { borderColor: categoryColor(c.slug), color: categoryColor(c.slug) } : {}}
              onClick={() => setFilterCat(filterCat === c.slug ? null : c.slug)}
            >
              {c.name}
            </button>
          ))}
        </div>

        {tableRows.length === 0 ? (
          <p style={{ color: '#444', fontSize: 12 }}>Sin productos con precio mayorista en esta categoría.</p>
        ) : (
          <div className="profit-table-wrap">
            <table className="profit-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Marca</th>
                  <th>Categoría</th>
                  <th className={`num-cell ${sortField === 'pvp' ? 'sorted' : ''}`} onClick={() => toggleSort('pvp')}>PVP €{arrow('pvp')}</th>
                  <th className={`num-cell ${sortField === 'wholesale' ? 'sorted' : ''}`} onClick={() => toggleSort('wholesale')}>Mayor. €{arrow('wholesale')}</th>
                  <th className={`num-cell ${sortField === 'margin' ? 'sorted' : ''}`} onClick={() => toggleSort('margin')}>Margen{arrow('margin')}</th>
                  <th className={`num-cell ${sortField === 'stock' ? 'sorted' : ''}`} onClick={() => toggleSort('stock')}>Stock{arrow('stock')}</th>
                  <th className={`num-cell ${sortField === 'capital' ? 'sorted' : ''}`} onClick={() => toggleSort('capital')}>Capital €{arrow('capital')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td className="name-cell" title={r.name}>
                      {r.name}
                      {r.hasVariants && <span style={{ marginLeft: 5, fontSize: 9, color: '#818cf8', verticalAlign: 'middle' }}>VAR</span>}
                    </td>
                    <td>{r.brand}</td>
                    <td>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: categoryColor(r.catSlug), marginRight: 5, verticalAlign: 'middle' }} />
                      {r.catName}
                    </td>
                    <td className="num-cell">{r.pvp.toFixed(2)}</td>
                    <td className="num-cell">{r.wholesale.toFixed(2)}</td>
                    <td className="num-cell"><span className={marginBadge(r.margin)}>{r.margin}%</span></td>
                    <td className="num-cell">{r.stock}</td>
                    <td className="num-cell">{r.capital.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!showAll && tableRows.length > PAGE && (
              <button className="profit-show-more" onClick={() => setShowAll(true)}>
                Mostrar {tableRows.length - PAGE} más…
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
