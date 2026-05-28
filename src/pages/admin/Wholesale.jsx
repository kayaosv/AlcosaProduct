import { useRef, useState, useMemo } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useAdminProducts } from '../../hooks/useAdminProducts.js'
import { useCategories } from '../../hooks/useCategories.js'
import { categoryColor, categoryKind } from '../../lib/productSpecs.js'

const effectivePrice = (p) => Number((p.is_on_sale && p.sale_price) ? p.sale_price : p.price ?? 0)

export const Wholesale = () => {
  const ref = useRef(null)
  const { products, loading } = useAdminProducts()
  const { categories } = useCategories()
  const [categorySlug, setCategorySlug] = useState('all')
  const [minUnits, setMinUnits] = useState(10)

  const filtered = useMemo(() => {
    if (categorySlug === 'all') return products
    return products.filter((p) => p.categories?.slug === categorySlug)
  }, [products, categorySlug])

  const totals = useMemo(() => {
    const wholesale = filtered.reduce(
      (a, p) => a + (Number(p.wholesale_price) || 0) * minUnits, 0,
    )
    const publicEquiv = filtered.reduce((a, p) => a + effectivePrice(p) * minUnits, 0)
    const savings = publicEquiv - wholesale
    return { wholesale, publicEquiv, savings }
  }, [filtered, minUnits])

  useGSAP(() => {
    if (loading) return
    gsap.from('.mayorista-row', { opacity: 0, y: 6, duration: 0.3, stagger: 0.02, ease: 'power2.out' })
  }, { scope: ref, dependencies: [categorySlug] })

  if (loading) return <div className="page-content"><p style={{ color: '#444' }}>Cargando…</p></div>

  return (
    <div ref={ref} className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Precios Mayorista</h1>
          <p className="page-subtitle">Vista interna · márgenes y simulador de pedido</p>
        </div>
        <div className="mayorista-badge">
          <span className="mayorista-badge-icon">⬡</span>
          <span>Datos internos</span>
        </div>
      </div>

      <div className="mayorista-stats-row">
        <div className="mayorista-info-banner">
          <div className="info-banner-col">
            <span className="info-banner-label">Unidades simuladas</span>
            <div className="info-banner-input-row">
              <span>×</span>
              <input
                type="number" value={minUnits} min={1}
                onChange={(e) => setMinUnits(Math.max(1, Number(e.target.value) || 1))}
                className="min-pedido-input"
              />
              <span>por referencia</span>
            </div>
          </div>
          <div className="info-banner-divider" />
          <div className="info-banner-col">
            <span className="info-banner-label">Coste total mayorista</span>
            <span className="info-banner-total">{totals.wholesale.toFixed(2)} €</span>
          </div>
          <div className="info-banner-divider" />
          <div className="info-banner-col">
            <span className="info-banner-label">Equivalente PVP</span>
            <span className="info-banner-total info-banner-total--muted">{totals.publicEquiv.toFixed(2)} €</span>
          </div>
          <div className="info-banner-divider" />
          <div className="info-banner-col">
            <span className="info-banner-label">Margen total</span>
            <span className="info-banner-total info-banner-total--green">+{totals.savings.toFixed(2)} €</span>
          </div>
        </div>
      </div>

      <div className="mayorista-breakeven-note">
        <span className="note-icon">ℹ</span>
        <span>
          <strong>Equiv. tienda</strong> indica cuántas unidades al precio mayorista equivalen a 1 venta al PVP.
          Un valor de ×1.5 = vender 1.5 mayoristas para igualar 1 venta pública.
        </span>
      </div>

      <div className="filter-bar">
        <select
          className="filter-select"
          value={categorySlug}
          onChange={(e) => setCategorySlug(e.target.value)}
        >
          <option value="all">Todas las categorías</option>
          {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </select>
      </div>

      <div className="table-wrapper">
        <table className="productos-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Detalles</th>
              <th>P. Público</th>
              <th>P. Mayorista</th>
              <th>Margen</th>
              <th>Equiv. tienda</th>
              <th>Ahorro ×{minUnits}</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const slug = p.categories?.slug
              const pvp = effectivePrice(p)
              const w = p.wholesale_price ? Number(p.wholesale_price) : null
              const margin = w ? (((pvp - w) / pvp) * 100).toFixed(1) : null
              const equiv = w ? (pvp / w).toFixed(2) : null
              const savings = w ? ((pvp - w) * minUnits).toFixed(2) : null
              return (
                <tr key={p.id} className="mayorista-row table-row">
                  <td className="td-producto">
                    <div className="producto-thumb">
                      {p.image_url
                        ? <img src={p.image_url} alt={p.name} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6 }} />
                        : <div className="thumb-placeholder">{p.name[0]}</div>}
                    </div>
                    <div>
                      <p className="producto-nombre">{p.name}</p>
                      <p className="producto-marca">{p.brand || '—'}</p>
                    </div>
                  </td>
                  <td>
                    {slug && (
                      <span className="cat-pill" style={{ '--pill-color': categoryColor(slug) }}>
                        {p.categories.name}
                      </span>
                    )}
                  </td>
                  <td className="td-detalles"><DetailsChip slug={slug} details={p.details} /></td>
                  <td className="td-precio">{pvp.toFixed(2)} €</td>
                  <td className="td-precio td-precio--mayorista">
                    {w != null ? `${w.toFixed(2)} €` : '—'}
                  </td>
                  <td>
                    {margin ? <span className="margen-pill">{margin}%</span> : <span style={{ color: '#333' }}>—</span>}
                  </td>
                  <td>
                    {equiv ? (
                      <span className={`equiv-pill ${parseFloat(equiv) > 1.4 ? 'equiv-pill--high' : 'equiv-pill--low'}`}>
                        ×{equiv}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="td-precio td-precio--ahorro">{savings ? `${savings} €` : '—'}</td>
                  <td>
                    <span className={`stock-num ${p.stock === 0 ? 'stock-num--zero' : p.stock <= 10 ? 'stock-num--low' : ''}`}>
                      {p.stock}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="table-empty"><p>No hay productos en esta categoría.</p></div>
        )}
      </div>
    </div>
  )
}

const DetailsChip = ({ slug, details }) => {
  const d = details || {}
  const k = categoryKind(slug)
  if (k === 'sales')        return <span className="chip">{d.size_ml ?? '?'}ml · {d.nicotine_mg ?? '?'}mg</span>
  if (k === 'longfill')     return <span className="chip">{d.concentrate_ml ?? '?'}ml/{d.bottle_ml ?? '?'}ml</span>
  if (k === 'desechables')  return <span className="chip">{d.puffs ?? '?'} puffs</span>
  if (k === 'vapers')       return <span className="chip">{d.model || '—'}</span>
  return <span className="chip">—</span>
}
