import { useRef, useMemo, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Link } from 'react-router-dom'
import { useAdminProducts } from '../../hooks/useAdminProducts.js'
import { useCategories } from '../../hooks/useCategories.js'
import { categoryColor } from '../../lib/productSpecs.js'

const DEFAULT_COLOR = '#6b7280'

const slugify = (str) =>
  str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-')

export const Categories = () => {
  const ref = useRef(null)
  const { products, loading: pLoading } = useAdminProducts()
  const { categories, loading: cLoading, create, update, remove } = useCategories()
  const [order, setOrder] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(DEFAULT_COLOR)
  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState(null) // id de la categoria en edicion de nombre
  const [renameValue, setRenameValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const list = useMemo(() => {
    if (order) return order
    return [...categories].sort((a, b) => a.sort_order - b.sort_order)
  }, [order, categories])

  const cards = useMemo(
    () =>
      list.map((c) => {
        const prods = products.filter((p) => p.category_id === c.id)
        const outOfStock = prods.filter((p) => p.effectiveStock === 0).length
        const totalValue = prods.reduce((a, p) => a + p.effectivePrice * p.effectiveStock, 0)
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
      await create({ name: newName.trim(), slug, sort_order: maxOrder + 10, color: newColor })
      setNewName('')
      setNewColor(DEFAULT_COLOR)
      setShowNewForm(false)
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
        order.map((c, i) => update(c.id, { sort_order: (i + 1) * 10 })),
      )
      setOrder(null)
    } catch (err) {
      alert(`Error guardando orden: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const startRename = (c) => {
    setRenaming(c.id)
    setRenameValue(c.name)
  }

  const saveRename = async (id) => {
    const name = renameValue.trim()
    setRenaming(null)
    if (!name) return
    try {
      await update(id, { name })
    } catch (err) {
      alert(`Error renombrando: ${err.message}`)
    }
  }

  const changeColor = async (id, color) => {
    try {
      await update(id, { color })
    } catch (err) {
      alert(`Error cambiando color: ${err.message}`)
    }
  }

  const deleteCategory = async (c) => {
    setDeleting(true)
    try {
      await remove(c.id)
      setConfirmDelete(null)
    } catch (err) {
      alert(`Error borrando categoría: ${err.message}`)
    } finally {
      setDeleting(false)
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
            onClick={() => { setShowNewForm((v) => !v); setNewName(''); setNewColor(DEFAULT_COLOR) }}
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
          <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
            El color se puede elegir acá. Los campos especiales (sabor, nicotina, Ω…) y qué tipo de
            variantes acepta siguen definidos en código — si esta categoría los necesita, pedime que
            los agregue después de crearla.
          </p>
          <div className="field-row" style={{ alignItems: 'flex-end', gap: 12 }}>
            <label className="color-swatch-label" title="Elegir color">
              <span className="color-swatch" style={{ background: newColor }} />
              <input
                type="color" value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="color-picker-hidden"
              />
            </label>
            <div className="field" style={{ flex: 1 }}>
              <label>Nombre</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="ej. Pods"
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
          <div key={c.id} className="cat-card" style={{ '--cat-color': categoryColor(c.slug, c.color) }}>
            <div className="cat-card-header">
              <label className="color-swatch-label" title="Cambiar color">
                <span className="color-swatch cat-card-dot" style={{ background: categoryColor(c.slug, c.color) }} />
                <input
                  type="color" value={c.color || categoryColor(c.slug)}
                  onChange={(e) => changeColor(c.id, e.target.value)}
                  className="color-picker-hidden"
                />
              </label>

              {renaming === c.id ? (
                <input
                  className="cat-card-rename-input"
                  value={renameValue}
                  autoFocus
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => saveRename(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); saveRename(c.id) }
                    if (e.key === 'Escape') setRenaming(null)
                  }}
                />
              ) : (
                <span
                  className="cat-card-nombre"
                  title="Clic para renombrar"
                  style={{ cursor: 'pointer' }}
                  onClick={() => startRename(c)}
                >
                  {c.name}
                </span>
              )}
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
              {confirmDelete === c.id ? (
                <span className="confirm-delete">
                  <button
                    type="button"
                    className="action-btn action-btn--danger"
                    disabled={deleting || c.total > 0}
                    onClick={() => deleteCategory(c)}
                  >
                    {deleting ? '…' : 'Confirmar'}
                  </button>
                  <button type="button" className="action-btn" onClick={() => setConfirmDelete(null)}>Cancelar</button>
                </span>
              ) : (
                <button
                  type="button"
                  className="action-btn action-btn--ghost"
                  onClick={() => setConfirmDelete(c.id)}
                  aria-label="Borrar categoría"
                >✕</button>
              )}
            </div>
            {confirmDelete === c.id && c.total > 0 && (
              <p style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>
                Tiene {c.total} producto{c.total !== 1 ? 's' : ''} — muévelos a otra categoría antes de borrarla.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
