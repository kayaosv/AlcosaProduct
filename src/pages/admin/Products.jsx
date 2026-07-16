import { useRef, useState, useMemo, useEffect } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Link, useSearchParams } from 'react-router-dom'
import { useAdminProducts } from '../../hooks/useAdminProducts.js'
import { useCategories } from '../../hooks/useCategories.js'
import { categoryColor, categoryKind } from '../../lib/productSpecs.js'
import { LOW_STOCK_THRESHOLD } from '../../config/stock.js'

const SORT_FIELDS = {
  name: (a, b) => a.name.localeCompare(b.name),
  price: (a, b) => (a.effectivePrice ?? 0) - (b.effectivePrice ?? 0),
  wholesale: (a, b) => (a.effectiveWholesalePrice ?? 0) - (b.effectiveWholesalePrice ?? 0),
  margin: (a, b) => a.marginPct - b.marginPct,
  stock: (a, b) => a.effectiveStock - b.effectiveStock,
}

export const Products = () => {
  const ref = useRef(null)
  const { products, loading, remove, refetch } = useAdminProducts()
  const { categories } = useCategories()

  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [categorySlug, setCategorySlug] = useState(searchParams.get('cat') || 'all')

  useEffect(() => {
    const cat = searchParams.get('cat')
    if (cat) setCategorySlug(cat)
  }, [searchParams])

  const [brand, setBrand] = useState('all')
  const [onlyOutOfStock, setOnlyOutOfStock] = useState(false)
  const [onlyLowStock, setOnlyLowStock] = useState(false)
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [sort, setSort] = useState({ field: null, dir: 'asc' })
  const [confirmDelete, setConfirmDelete] = useState(null)

  const uniqueBrands = useMemo(
    () => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort(),
    [products],
  )

  const lowStockCount = useMemo(
    () => products.filter((p) => p.effectiveStock > 0 && p.effectiveStock <= LOW_STOCK_THRESHOLD).length,
    [products],
  )

  const filtered = useMemo(() => {
    let list = products
    if (categorySlug !== 'all') list = list.filter((p) => p.categories?.slug === categorySlug)
    if (brand !== 'all') list = list.filter((p) => p.brand === brand)
    if (onlyOutOfStock) list = list.filter((p) => p.effectiveStock === 0)
    if (onlyLowStock) list = list.filter((p) => p.effectiveStock > 0 && p.effectiveStock <= LOW_STOCK_THRESHOLD)
    if (priceMin !== '') list = list.filter((p) => (p.effectivePrice ?? 0) >= parseFloat(priceMin))
    if (priceMax !== '') list = list.filter((p) => (p.effectivePrice ?? 0) <= parseFloat(priceMax))
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q) || (p.barcode || '').includes(q),
      )
    }
    if (sort.field) {
      list = [...list].sort(SORT_FIELDS[sort.field])
      if (sort.dir === 'desc') list = list.reverse()
    }
    return list
  }, [products, categorySlug, brand, onlyOutOfStock, onlyLowStock, priceMin, priceMax, search, sort])

  useGSAP(() => {
    gsap.from('.table-row', { opacity: 0, y: 8, duration: 0.3, stagger: 0.02, ease: 'power2.out' })
  }, { scope: ref, dependencies: [filtered.length, sort] })

  const toggleSort = (field) =>
    setSort((s) =>
      s.field === field
        ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'asc' },
    )

  const resetFilters = () => {
    setSearch('')
    setCategorySlug('all')
    setBrand('all')
    setOnlyOutOfStock(false)
    setOnlyLowStock(false)
    setPriceMin('')
    setPriceMax('')
  }

  const handleDelete = async (id) => {
    try {
      await remove(id)
      setConfirmDelete(null)
    } catch (err) {
      alert(`Error al borrar: ${err.message}`)
    }
  }

  const SortTh = ({ field, children }) => (
    <th
      className={`th-sortable ${sort.field === field ? 'th-sortable--active' : ''}`}
      onClick={() => toggleSort(field)}
    >
      {children}
      <span className="sort-arrow">
        {sort.field === field ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
      </span>
    </th>
  )

  const hasFilters =
    search || categorySlug !== 'all' || brand !== 'all' || onlyOutOfStock || onlyLowStock || priceMin || priceMax

  return (
    <div ref={ref} className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Productos</h1>
          <p className="page-subtitle">
            {loading ? 'Cargando…' : `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''}`}
            {!loading && lowStockCount > 0 && (
              <span className="page-subtitle-alert"> · {lowStockCount} con stock bajo</span>
            )}
          </p>
        </div>
        <Link to="/admin/products/new" className="btn-primary">+ Nuevo producto</Link>
      </div>

      <div className="filter-bar">
        <input
          className="filter-search"
          type="text"
          placeholder="Buscar por nombre o marca…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="filter-select"
          value={categorySlug}
          onChange={(e) => setCategorySlug(e.target.value)}
        >
          <option value="all">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>{c.name}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        >
          <option value="all">Todas las marcas</option>
          {uniqueBrands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <div className="filter-price-range">
          <input
            className="filter-price-input"
            type="number" placeholder="Min €" value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
          />
          <span className="filter-price-sep">–</span>
          <input
            className="filter-price-input"
            type="number" placeholder="Max €" value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
          />
        </div>
        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={onlyOutOfStock}
            onChange={(e) => setOnlyOutOfStock(e.target.checked)}
          />
          <span>Solo agotados</span>
        </label>
        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={onlyLowStock}
            onChange={(e) => setOnlyLowStock(e.target.checked)}
          />
          <span>Solo stock bajo</span>
        </label>
        {hasFilters && (
          <button className="btn-ghost" onClick={resetFilters}>Limpiar</button>
        )}
      </div>

      <div className="table-wrapper">
        <table className="productos-table">
          <thead>
            <tr>
              <SortTh field="name">Producto</SortTh>
              <th>Categoría</th>
              <th>Detalles</th>
              <SortTh field="price">Precio</SortTh>
              <SortTh field="wholesale">Mayorista</SortTh>
              <SortTh field="margin">Margen</SortTh>
              <SortTh field="stock">Stock</SortTh>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const slug = p.categories?.slug
              const hasVariants = (p.product_variants?.length ?? 0) > 0
              return (
                <tr key={p.id} className="table-row">
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
                      <span className="cat-pill" style={{ '--pill-color': categoryColor(slug, p.categories?.color) }}>
                        {p.categories.name}
                      </span>
                    )}
                  </td>
                  <td className="td-detalles"><ProductDetails slug={slug} details={p.details} /></td>
                  <td className="td-precio">
                    {!hasVariants && p.is_on_sale && p.sale_price && (
                      <span className="precio-original">{Number(p.price).toFixed(2)} €</span>
                    )}
                    <span className={p.is_on_sale ? 'precio-oferta' : ''}>
                      {p.effectivePrice.toFixed(2)} €
                    </span>
                  </td>
                  <td className="td-precio">
                    {p.effectiveWholesalePrice != null ? `${p.effectiveWholesalePrice.toFixed(2)} €` : '—'}
                  </td>
                  <td>
                    {p.marginPct > 0
                      ? <span className="margen-pill">{p.marginPct.toFixed(1)}%</span>
                      : <span style={{ color: '#333' }}>—</span>}
                  </td>
                  <td>
                    <span className={`stock-num ${p.effectiveStock === 0 ? 'stock-num--zero' : p.effectiveStock <= LOW_STOCK_THRESHOLD ? 'stock-num--low' : ''}`}>
                      {p.effectiveStock}
                    </span>
                  </td>
                  <td>
                    <span className={`status-dot ${p.is_active ? 'status-dot--on' : 'status-dot--off'}`}>
                      {p.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="td-actions">
                    <Link to={`/admin/products/${p.id}`} className="action-btn">Editar</Link>
                    <Link to={`/admin/products/${p.id}/label`} className="action-btn">Etiqueta</Link>
                    {confirmDelete === p.id ? (
                      <span className="confirm-delete">
                        <button className="action-btn action-btn--danger" onClick={() => handleDelete(p.id)}>Confirmar</button>
                        <button className="action-btn" onClick={() => setConfirmDelete(null)}>Cancelar</button>
                      </span>
                    ) : (
                      <button className="action-btn action-btn--ghost" onClick={() => setConfirmDelete(p.id)}>✕</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {!loading && filtered.length === 0 && (
          <div className="table-empty">
            <p>{hasFilters ? 'No se encontraron productos con los filtros actuales.' : 'Aún no hay productos. Crea el primero.'}</p>
            {hasFilters
              ? <button className="btn-ghost" onClick={resetFilters}>Limpiar filtros</button>
              : <Link to="/admin/products/new" className="btn-primary">+ Nuevo producto</Link>}
          </div>
        )}
      </div>
    </div>
  )
}

const ProductDetails = ({ slug, details }) => {
  const d = details || {}
  const kind = categoryKind(slug)
  if (kind === 'sales') return (
    <span className="detalle-chips">
      {d.size_ml && <span className="chip">{d.size_ml}ml</span>}
      {d.nicotine_mg != null && <span className="chip chip--nic">{d.nicotine_mg}mg</span>}
      {d.flavor && <span className="chip chip--sabor">{d.flavor}</span>}
    </span>
  )
  if (kind === 'longfill') return (
    <span className="detalle-chips">
      {d.concentrate_ml && d.bottle_ml && <span className="chip">{d.concentrate_ml}ml/{d.bottle_ml}ml</span>}
      {d.flavor && <span className="chip chip--sabor">{d.flavor}</span>}
    </span>
  )
  if (kind === 'desechables') return (
    <span className="detalle-chips">
      {d.puffs && <span className="chip">{d.puffs} puffs</span>}
      {d.nicotine_mg != null && <span className="chip chip--nic">{d.nicotine_mg}mg</span>}
      {d.flavor && <span className="chip chip--sabor">{d.flavor}</span>}
    </span>
  )
  if (kind === 'vapers') return (
    <span className="detalle-chips">
      {d.battery_mah && <span className="chip">{d.battery_mah}mAh</span>}
      {d.power_w && <span className="chip">{d.power_w}W</span>}
    </span>
  )
  return <span className="detalle-chips"><span className="chip">—</span></span>
}
