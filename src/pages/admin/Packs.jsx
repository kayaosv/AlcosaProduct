import { useRef, useState, useEffect, useMemo } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { supabase } from '../../lib/supabase.js'
import { useUploadImage } from '../../hooks/useUploadImage.js'
import { useAdminPacks, createPack, updatePack, deletePack } from '../../hooks/useAdminPacks.js'
import { getEffectivePrice } from '../../lib/stockPricing.js'

// Precio de referencia de un componente del pack: el de la variante
// elegida si la tiene, si no el precio efectivo del producto (mismo
// criterio que el resto del admin, ver stockPricing.js).
const itemReferencePrice = (item) => {
  if (item.variant) return Number(item.variant.sale_price ?? item.variant.price ?? 0)
  return getEffectivePrice(item.product)
}

const EMPTY_FORM = { name: '', description: '', price: '', image_url: null, is_active: true, items: [] }

export const Packs = () => {
  const ref = useRef(null)
  const { packs, loading, refetch } = useAdminPacks()
  const { upload, uploading } = useUploadImage()

  const [editing, setEditing] = useState(null) // null = lista, 'new' | pack.id
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [variantPick, setVariantPick] = useState(null) // producto con variantes, eligiendo cual

  useGSAP(() => {
    if (loading) return
    gsap.from('.table-row', { opacity: 0, y: 8, duration: 0.3, stagger: 0.02, ease: 'power2.out' })
  }, { scope: ref, dependencies: [loading, editing] })

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, brand, image_url, price, sale_price, is_on_sale, product_variants(id, label, price, sale_price, is_active)')
        .eq('is_active', true)
        .ilike('name', `%${q}%`)
        .order('name')
        .limit(8)
      if (!cancelled) {
        setResults(data ?? [])
        setSearching(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  const startNew = () => {
    setForm(EMPTY_FORM)
    setError(null)
    setEditing('new')
  }

  const startEdit = (pack) => {
    setForm({
      name: pack.name,
      description: pack.description ?? '',
      price: pack.price,
      image_url: pack.image_url,
      is_active: pack.is_active,
      items: pack.pack_items.map((it) => ({
        productId: it.product_id,
        variantId: it.variant_id,
        quantity: it.quantity,
        product: it.products,
        variant: it.product_variants,
      })),
    })
    setError(null)
    setEditing(pack.id)
  }

  const cancelEdit = () => {
    setEditing(null)
    setQuery('')
    setResults([])
    setVariantPick(null)
  }

  const addItem = (product, variant = null) => {
    setForm((f) => ({
      ...f,
      items: [...f.items, { productId: product.id, variantId: variant?.id ?? null, quantity: 1, product, variant }],
    }))
    setQuery('')
    setResults([])
    setVariantPick(null)
  }

  const pickProduct = (product) => {
    const activeVariants = (product.product_variants ?? []).filter((v) => v.is_active !== false)
    if (activeVariants.length) {
      setVariantPick({ product, variants: activeVariants })
      return
    }
    addItem(product)
  }

  const removeItem = (idx) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
  const setItemQty = (idx, qty) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, quantity: Math.max(1, qty) } : it)) }))

  const referenceTotal = useMemo(
    () => form.items.reduce((sum, it) => sum + itemReferencePrice(it) * it.quantity, 0),
    [form.items],
  )
  const finalPrice = Number(form.price) || 0
  const savings = referenceTotal - finalPrice

  const handleImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { publicUrl } = await upload(file, `pack-${form.name || 'nuevo'}`)
      setForm((f) => ({ ...f, image_url: publicUrl }))
    } catch (err) {
      alert(`Error subiendo imagen: ${err.message}`)
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('El pack necesita un nombre.')
      return
    }
    if (form.items.length < 2) {
      setError('Un pack necesita al menos 2 productos.')
      return
    }
    if (!(Number(form.price) > 0)) {
      setError('El precio del pack tiene que ser mayor que 0.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        image_url: form.image_url,
        is_active: form.is_active,
        items: form.items.map((it) => ({ productId: it.productId, variantId: it.variantId, quantity: it.quantity })),
      }
      if (editing === 'new') {
        await createPack(payload)
      } else {
        await updatePack(editing, payload)
      }
      await refetch()
      cancelEdit()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (pack) => {
    if (!confirm(`¿Borrar el pack "${pack.name}"? No borra los productos que lo componen.`)) return
    try {
      await deletePack(pack.id)
      await refetch()
    } catch (err) {
      alert(`No se pudo borrar: ${err.message}`)
    }
  }

  const toggleActive = async (pack) => {
    try {
      await updatePack(pack.id, {
        name: pack.name,
        description: pack.description,
        price: pack.price,
        image_url: pack.image_url,
        is_active: !pack.is_active,
        items: pack.pack_items.map((it) => ({ productId: it.product_id, variantId: it.variant_id, quantity: it.quantity })),
      })
      await refetch()
    } catch (err) {
      alert(`No se pudo actualizar: ${err.message}`)
    }
  }

  if (loading) {
    return <div className="page-content"><p style={{ color: '#444' }}>Cargando…</p></div>
  }

  if (editing) {
    return (
      <div ref={ref} className="page-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">{editing === 'new' ? 'Nuevo pack' : 'Editar pack'}</h1>
            <p className="page-subtitle">Combiná productos ya cargados a un precio de oferta fijo</p>
          </div>
          <button className="btn-ghost" onClick={cancelEdit}>Cancelar</button>
        </div>

        {error && <p className="admin-login-error" style={{ marginBottom: 16 }}>{error}</p>}

        <div className="dash-section" style={{ marginBottom: 16 }}>
          <div className="field-row">
            <div className="field">
              <label>Nombre del pack</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="ej. Combo Iniciación" />
            </div>
            <div className="field">
              <label>Foto (opcional — si no se carga, usa la del primer producto)</label>
              <input type="file" accept="image/*" onChange={handleImage} disabled={uploading} />
            </div>
          </div>
          <div className="field">
            <label>Descripción (opcional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="field-row" style={{ alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
              Activo (visible en la web)
            </label>
          </div>
        </div>

        <div className="dash-section" style={{ marginBottom: 16 }}>
          <h2 className="section-title">Productos del pack</h2>
          <p className="section-desc">Buscá por nombre — si el producto tiene variantes, elegís cuál va en el pack.</p>

          <div className="tpv-name-search" style={{ marginTop: 12 }}>
            <div className="scanner-input-wrap">
              <input
                className="scanner-input tpv-name-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar producto para agregar…"
              />
              {query && <button type="button" className="scanner-clear" onClick={() => setQuery('')}>✕</button>}
            </div>
            {query.trim().length >= 2 && (
              <div className="tpv-name-results">
                {searching ? (
                  <p className="tpv-name-results-empty">Buscando…</p>
                ) : results.length === 0 ? (
                  <p className="tpv-name-results-empty">Sin resultados.</p>
                ) : (
                  results.map((p) => (
                    <button key={p.id} type="button" className="tpv-name-result" onClick={() => pickProduct(p)}>
                      <span className="tpv-name-result-name">{p.name}</span>
                      {p.brand && <span className="tpv-name-result-brand">{p.brand}</span>}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {variantPick && (
            <div style={{ margin: '12px 0' }}>
              <p style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                "{variantPick.product.name}" tiene variantes — elegí cuál va en el pack
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {variantPick.variants.map((v) => (
                  <button key={v.id} type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={() => addItem(variantPick.product, v)}>
                    {v.label}
                  </button>
                ))}
                <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setVariantPick(null)}>Cancelar</button>
              </div>
            </div>
          )}

          {form.items.length === 0 ? (
            <p style={{ color: '#444', fontSize: 12, marginTop: 12 }}>Todavía no agregaste ningún producto.</p>
          ) : (
            <div className="table-wrapper" style={{ marginTop: 12 }}>
              <table className="productos-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio ref.</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((it, idx) => (
                    <tr key={idx} className="table-row">
                      <td className="producto-nombre">
                        {it.product.name}
                        {it.variant && <span style={{ color: '#666' }}> · {it.variant.label}</span>}
                      </td>
                      <td>
                        <input
                          type="number"
                          min={1}
                          value={it.quantity}
                          onChange={(e) => setItemQty(idx, parseInt(e.target.value) || 1)}
                          style={{ width: 60 }}
                        />
                      </td>
                      <td className="td-precio">{(itemReferencePrice(it) * it.quantity).toFixed(2)} €</td>
                      <td className="td-actions">
                        <button className="btn-ghost" onClick={() => removeItem(idx)}>Quitar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="dash-section" style={{ marginBottom: 16 }}>
          <h2 className="section-title">Precio del pack</h2>
          <p className="section-desc">
            Suma de los productos por separado: <strong>{referenceTotal.toFixed(2)} €</strong>
            {finalPrice > 0 && savings > 0 && (
              <> — con {finalPrice.toFixed(2)} € el cliente ahorra <strong style={{ color: '#4ade80' }}>{savings.toFixed(2)} €</strong></>
            )}
          </p>
          <div className="field" style={{ maxWidth: 200 }}>
            <label>Precio final del pack (€)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              placeholder={referenceTotal ? referenceTotal.toFixed(2) : '0.00'}
            />
          </div>
        </div>

        <button className="btn-primary" disabled={saving || uploading} onClick={handleSave}>
          {saving ? 'Guardando…' : 'Guardar pack'}
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Packs</h1>
          <p className="page-subtitle">{packs.length} pack{packs.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={startNew}>+ Nuevo pack</button>
      </div>

      <div className="table-wrapper">
        <table className="productos-table">
          <thead>
            <tr>
              <th>Pack</th>
              <th>Productos</th>
              <th>Precio</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {packs.map((p) => (
              <tr key={p.id} className="table-row">
                <td className="producto-nombre">{p.name}</td>
                <td>
                  <span className="chip">{p.pack_items.length} producto{p.pack_items.length !== 1 ? 's' : ''}</span>
                </td>
                <td className="td-precio">{Number(p.price).toFixed(2)} €</td>
                <td>
                  <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => toggleActive(p)}>
                    {p.is_active ? '✓ Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="td-actions">
                  <button className="action-btn" onClick={() => startEdit(p)}>Editar</button>
                  <button className="btn-ghost" onClick={() => handleDelete(p)}>Borrar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {packs.length === 0 && (
          <div className="table-empty">
            <p>Todavía no armaste ningún pack.</p>
          </div>
        )}
      </div>
    </div>
  )
}
