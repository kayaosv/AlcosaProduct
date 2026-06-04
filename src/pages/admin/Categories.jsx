import { useRef, useMemo, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useAdminProducts } from '../../hooks/useAdminProducts.js'
import { useCategories } from '../../hooks/useCategories.js'
import { categoryColor } from '../../lib/productSpecs.js'

const effectivePrice = (p) => Number((p.is_on_sale && p.sale_price) ? p.sale_price : p.price ?? 0)

const slugify = (str) =>
  str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-')

export const Categories = () => {
  const ref = useRef(null)
  const { products, loading: pLoading } = useAdminProducts()
  const { categories, loading: cLoading } = useCategories()
  const [order, setOrder] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const list = useMemo(() => {
    if (order) return order
    return [...categories].sort((a, b) => a.sort_order - b.sort_order)
  }, [order, categories])

  const cards = useMemo(
    () =>
      list.map((c) => {
        const prods = products.filter((p) => p.category_id === c.id)
        const outOfStock = prods.filter((p) => p.stock === 0).length
        const totalValue = prods.reduce((a, p) => a + effectivePrice(p) * p.stock, 0)
        return { ...c, total: prods.length, outOfStock, totalValue }
      }),
    [list, products],
  )

  useGSAP(() => {
    if (pLoading || cLoading) return
    gsap.from('.cat-card', {
      y: 20, opacity: 0, duration: 0.4, stagger: 0.07, ease: 'power3.out',
    })
  }, { scope: ref, dependencies: [pLoading, cLoading] })

  const move = (idx, dir) => {
    const target = idx + dir
    if (target < 0 || target >= list.length) return
    const next = [...list]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setOrder(next)
  }

  const createCategory = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const slug = slugify(newName)
      const maxOrder = list.length ? Math.max(...list.map((c) => c.sort_order)) : 0
      const { error } = await supabase.from('categories').insert({
        name: newName.trim(),
        slug,
        sort_order: maxOrder + 10,
      })
      if (error) throw error
      setNewName('')
      setShowNewForm(false)
      window.location.reload()
    } catch (err) {
      alert(`Error creando categoría: ${err.message}`)
    } finally {
      setCreating(false)
    }
  }

  const saveOrder = async () => {
    if (!order) return
    setSaving(true)
    try {
      await Promise.all(
        order.map((c, i) =>
          supabase.from('categories').update({ sort_order: (i + 1) * 10 }).eq('id', c.id),
        ),
      )
      setOrder(null)
      // forzar refetch sencillo
      window.location.reload()
    } catch (err) {
      alert(`Error guardando orden: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (pLoading || cLoading) {
    return <div className="page-content"><p style={{ color: '#444' }}>Cargando…</p></div>
  }

  return (
    <div ref={ref} className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Categorías</h1>
          <p className="page-subtitle">Vista por tipo de producto · reordena con ↑ ↓</p>
        </div>
        <div className="header-actions">
          <button
            className="btn-ghost"
            onClick={() => { setShowNewForm((v) => !v); setNewName('') }}
          >
            {showNewForm ? 'Cancelar' : '+ Nueva categoría'}
          </button>
          {order && (
            <>
              <button className="btn-ghost" onClick={() => setOrder(null)} disabled={saving}>
                Descartar
              </button>
              <button className="btn-primary" onClick={saveOrder} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar orden'}
              </button>
            </>
          )}
        </div>
      </div>

      {showNewForm && (
        <div className="editor-section" style={{ marginBottom: 24, padding: '20px 24px', background: '#111', borderRadius: 10, border: '1px solid #1e1e1e' }}>
          <h2 className="editor-section-title" style={{ marginBottom: 16 }}>Nueva categoría</h2>
          <div className="field-row" style={{ alignItems: 'flex-end', gap: 12 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Nombre</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="ej. Minilongfill"
                onKeyDown={(e) => e.key === 'Enter' && createCategory()}
                autoFocus
              />
              {newName.trim() && (
                <span className="field-hint">Slug: {slugify(newName)}</span>
              )}
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={createCategory}
              disabled={creating || !newName.trim()}
              style={{ flexShrink: 0 }}
            >
              {creating ? 'Creando…' : 'Crear'}
            </button>
          </div>
        </div>
      )}

      <div className="cat-cards-grid">
        {cards.map((c, idx) => (
          <div key={c.id} className="cat-card" style={{ '--cat-color': categoryColor(c.slug) }}>
            <div className="cat-card-header">
              <div className="cat-card-dot" />
              <span className="cat-card-nombre">{c.name}</span>
              <span className="cat-card-total">{c.total} productos</span>
            </div>

            <div className="cat-card-stats">
              <div className="cat-stat">
                <span className="cat-stat-value">{c.total - c.outOfStock}</span>
                <span className="cat-stat-label">con stock</span>
              </div>
              <div className="cat-stat">
                <span className={`cat-stat-value ${c.outOfStock > 0 ? 'cat-stat-value--warn' : ''}`}>
                  {c.outOfStock}
                </span>
                <span className="cat-stat-label">agotados</span>
              </div>
              <div className="cat-stat">
                <span className="cat-stat-value">{c.totalValue.toFixed(0)} €</span>
                <span className="cat-stat-label">en stock</span>
              </div>
            </div>

            <div className="cat-card-actions">
              <div className="cat-card-order">
                <button
                  type="button"
                  className="order-btn"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  aria-label="Subir"
                >↑</button>
                <button
                  type="button"
                  className="order-btn"
                  onClick={() => move(idx, 1)}
                  disabled={idx === cards.length - 1}
                  aria-label="Bajar"
                >↓</button>
              </div>
              <Link to={`/admin/products?cat=${c.slug}`} className="cat-card-link">
                Ver productos →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
