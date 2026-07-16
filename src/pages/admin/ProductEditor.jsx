import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useCategories } from '../../hooks/useCategories.js'
import { useUploadImage } from '../../hooks/useUploadImage.js'
import { useProductVariants } from '../../hooks/useProductVariants.js'
import {
  fetchProductById,
  createProduct,
  updateProduct,
} from '../../hooks/useAdminProducts.js'
import { supabase } from '../../lib/supabase.js'
import {
  NICOTINE_LEVELS, SALES_SIZES,
  LONGFILL_CONCENTRATES, LONGFILL_BOTTLES, MINILONGFILL_CONCENTRATES,
  categoryKind, categoryVariantType,
} from '../../lib/productSpecs.js'

const EMPTY = {
  name: '',
  brand: '',
  barcode: '',
  category_id: '',
  price: '',
  sale_price: '',
  is_on_sale: false,
  wholesale_price: '',
  stock: '',
  is_active: true,
  is_featured: false,
  image_url: null,
  images: [],
  details: {},
}

export const ProductEditor = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const { categories } = useCategories()
  const { upload, uploading } = useUploadImage()
  const { variants, add: addVariant, update: updateVariant, remove: removeVariant, setPrimary: setPrimaryVariant } = useProductVariants(isNew ? null : id)

  // Draft variants for new products — flushed to DB on submit
  const [draftVariants, setDraftVariants] = useState([])
  const addDraft = useCallback((v) => {
    setDraftVariants((d) => {
      const isPrimary = d.length === 0
      return [...d, { ...v, id: crypto.randomUUID(), is_primary: isPrimary }]
    })
  }, [])
  const updateDraft = useCallback((id, changes) => setDraftVariants((d) => d.map((v) => v.id === id ? { ...v, ...changes } : v)), [])
  const removeDraft = useCallback((id) => setDraftVariants((d) => {
    const next = d.filter((v) => v.id !== id)
    if (next.length > 0 && !next.some((v) => v.is_primary)) {
      return next.map((v, i) => ({ ...v, is_primary: i === 0 }))
    }
    return next
  }), [])
  const setPrimaryDraft = useCallback((id) => {
    setDraftVariants((d) => d.map((v) => ({ ...v, is_primary: v.id === id })))
  }, [])

  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  // Cargar producto existente
  useEffect(() => {
    if (isNew) return
    let cancelled = false
    fetchProductById(id)
      .then((p) => {
        if (cancelled || !p) return
        setForm({
          name: p.name ?? '',
          brand: p.brand ?? '',
          barcode: p.barcode ?? '',
          category_id: p.category_id ?? '',
          price: p.price ?? '',
          sale_price: p.sale_price ?? '',
          is_on_sale: p.is_on_sale ?? false,
          wholesale_price: p.wholesale_price ?? '',
          stock: p.stock ?? 0,
          is_active: p.is_active ?? true,
          is_featured: p.is_featured ?? false,
          image_url: p.image_url ?? null,
          images: p.images ?? [],
          details: p.details ?? {},
        })
      })
      .catch((err) => setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [id, isNew])

  // Default a primera categoría al crear nuevo (cuando carguen las categorías)
  useEffect(() => {
    if (isNew && !form.category_id && categories.length) {
      setForm((f) => ({ ...f, category_id: categories[0].id }))
    }
  }, [isNew, categories, form.category_id])

  const currentSlug = useMemo(
    () => categories.find((c) => c.id === form.category_id)?.slug,
    [categories, form.category_id],
  )
  const kind = categoryKind(currentSlug)
  const variantType = categoryVariantType(currentSlug)

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))
  const setDetail = (key, val) =>
    setForm((f) => ({ ...f, details: { ...f.details, [key]: val } }))

  const handleImageSlot = async (e, idx) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const slug = `${form.name || 'product'}-img${idx + 1}`
      const { publicUrl } = await upload(file, slug)
      if (idx === -1) {
        set('image_url', publicUrl)
      } else {
        const next = [...(form.images ?? [])]
        next[idx] = publicUrl
        set('images', next)
      }
    } catch (err) {
      alert(`Error subiendo imagen: ${err.message}`)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        brand: form.brand || null,
        barcode: form.barcode.trim() || null,
        category_id: form.category_id || null,
        price: parseFloat(form.price) || 0,
        sale_price: form.is_on_sale && form.sale_price !== '' ? parseFloat(form.sale_price) : null,
        is_on_sale: form.is_on_sale,
        wholesale_price: form.wholesale_price !== '' ? parseFloat(form.wholesale_price) : null,
        stock: parseInt(form.stock) || 0,
        is_active: form.is_active,
        is_featured: form.is_featured,
        image_url: form.image_url,
        images: (form.images ?? []).filter(Boolean),
        details: form.details ?? {},
      }
      if (isNew) {
        const created = await createProduct(payload)
        if (draftVariants.length > 0) {
          await supabase.from('product_variants').insert(
            draftVariants.map((v, i) => ({
              product_id: created.id,
              label: v.label,
              hex: v.hex ?? null,
              stock: v.stock ?? 0,
              price: v.price !== '' && v.price != null ? parseFloat(v.price) : null,
              sale_price: v.sale_price !== '' && v.sale_price != null ? parseFloat(v.sale_price) : null,
              wholesale_price: v.wholesale_price !== '' && v.wholesale_price != null ? parseFloat(v.wholesale_price) : null,
              image_url: v.image_url ?? null,
              is_primary: v.is_primary ?? i === 0,
              sort_order: i,
            }))
          )
        }
        setSaved(true)
        setTimeout(() => navigate(`/admin/products/${created.id}`), 600)
      } else {
        await updateProduct(id, payload)
        setSaved(true)
        setTimeout(() => navigate('/admin/products'), 600)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="page-content"><p style={{ color: '#444' }}>Cargando…</p></div>

  const marginPct =
    form.price && form.wholesale_price
      ? ((parseFloat(form.price) - parseFloat(form.wholesale_price)) / parseFloat(form.price)) * 100
      : null

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link to="/admin/products">Productos</Link>
            <span>/</span>
            <span>{isNew ? 'Nuevo producto' : form.name || 'Editar'}</span>
          </div>
          <h1 className="page-title">{isNew ? 'Nuevo producto' : 'Editar producto'}</h1>
        </div>
        <div className="header-actions">
          <Link to="/admin/products" className="btn-ghost">Cancelar</Link>
          {!isNew && (
            <Link to={`/admin/products/${id}/label`} className="btn-ghost">Etiqueta</Link>
          )}
          <button
            form="product-form"
            type="submit"
            disabled={saving || uploading}
            className={`btn-primary ${saved ? 'btn-primary--saved' : ''}`}
          >
            {saved ? '✓ Guardado' : saving ? 'Guardando…' : isNew ? 'Crear producto' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {error && <p className="admin-login-error" style={{ marginBottom: 16 }}>{error}</p>}

      <form id="product-form" onSubmit={handleSubmit} className="editor-layout">
        <div className="editor-main">
          <section className="editor-section">
            <h2 className="editor-section-title">Información general</h2>
            <div className="field-group">
              <div className="field">
                <label>Nombre del producto *</label>
                <input
                  required value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="ej. Drifter – Pineapple Ice"
                />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Marca</label>
                  <input
                    value={form.brand || ''}
                    onChange={(e) => set('brand', e.target.value)}
                    placeholder="ej. Bombo, OXVA, Elf Bar…"
                  />
                </div>
                <div className="field">
                  <label>Código de barras (EAN/UPC)</label>
                  <input
                    value={form.barcode || ''}
                    onChange={(e) => set('barcode', e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
                    placeholder="ej. 8410076470038"
                    maxLength={50}
                  />
                </div>
              </div>
              <div className="field">
                <label>Categoría *</label>
                <select
                  required
                  value={form.category_id}
                  onChange={(e) => set('category_id', e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {kind === 'sales' && (
            <section className="editor-section">
              <h2 className="editor-section-title">Especificaciones — Sales de Nicotina</h2>
              <div className="field-group">
                <div className="field">
                  <label>Tamaño (ml)</label>
                  <input
                    type="text"
                    value={form.details.size_ml ?? ''}
                    onChange={(e) => setDetail('size_ml', e.target.value)}
                    placeholder="ej. 10"
                  />
                </div>
                <div className="field">
                  <label>Sabor / Descripción</label>
                  <input
                    value={form.details.flavor ?? ''}
                    onChange={(e) => setDetail('flavor', e.target.value)}
                    placeholder="ej. Mango con toque helado"
                  />
                </div>
              </div>
            </section>
          )}

          {kind === 'longfill' && currentSlug !== 'minilongfill' && (
            <section className="editor-section">
              <h2 className="editor-section-title">Especificaciones — Longfill</h2>
              <div className="field-group">
                <div className="field-row">
                  <div className="field">
                    <label>Aroma concentrado (ml)</label>
                    <input
                      type="text"
                      value={form.details.concentrate_ml ?? ''}
                      onChange={(e) => setDetail('concentrate_ml', e.target.value)}
                      placeholder="ej. 10"
                    />
                  </div>
                  <div className="field">
                    <label>Botella final (ml)</label>
                    <select
                      value={form.details.bottle_ml ?? 60}
                      onChange={(e) => setDetail('bottle_ml', Number(e.target.value))}
                    >
                      {LONGFILL_BOTTLES.map((v) => <option key={v} value={v}>{v} ml</option>)}
                    </select>
                    {(() => {
                      const space = (form.details.bottle_ml ?? 60) - parseFloat(form.details.concentrate_ml)
                      return !isNaN(space) && space > 0
                        ? <span className="field-hint">Espacio para nicokit + base: {space} ml</span>
                        : !isNaN(space) && space <= 0
                          ? <span className="field-hint" style={{ color: '#e53935' }}>El concentrado supera la botella</span>
                          : null
                    })()}
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Nicotina recomendada (mg/ml)</label>
                    <select
                      value={form.details.nicotine_mg ?? 0}
                      onChange={(e) => setDetail('nicotine_mg', Number(e.target.value))}
                    >
                      {NICOTINE_LEVELS.map((v) => <option key={v} value={v}>{v === 0 ? 'Sin nicotina' : `${v} mg`}</option>)}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label>Sabor / Descripción</label>
                  <input
                    value={form.details.flavor ?? ''}
                    onChange={(e) => setDetail('flavor', e.target.value)}
                    placeholder="ej. Arándanos y frambuesas heladas"
                  />
                </div>
              </div>
            </section>
          )}

          {currentSlug === 'minilongfill' && (
            <section className="editor-section">
              <h2 className="editor-section-title">Especificaciones — Minilongfill</h2>
              <div className="field-group">
                <div className="field-row">
                  <div className="field">
                    <label>Aroma concentrado (ml)</label>
                    <input
                      type="text"
                      value={form.details.concentrate_ml ?? ''}
                      onChange={(e) => setDetail('concentrate_ml', e.target.value)}
                      placeholder="ej. 10"
                    />
                  </div>
                  <div className="field">
                    <label>Botella final (ml)</label>
                    <select
                      value={form.details.bottle_ml ?? 30}
                      onChange={(e) => setDetail('bottle_ml', Number(e.target.value))}
                    >
                      {LONGFILL_BOTTLES.map((v) => <option key={v} value={v}>{v} ml</option>)}
                    </select>
                    {(() => {
                      const space = (form.details.bottle_ml ?? 30) - parseFloat(form.details.concentrate_ml)
                      return !isNaN(space) && space > 0
                        ? <span className="field-hint">Espacio para nicokit + base: {space} ml</span>
                        : !isNaN(space) && space <= 0
                          ? <span className="field-hint" style={{ color: '#e53935' }}>El concentrado supera la botella</span>
                          : null
                    })()}
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Nicotina recomendada (mg/ml)</label>
                    <select
                      value={form.details.nicotine_mg ?? 0}
                      onChange={(e) => setDetail('nicotine_mg', Number(e.target.value))}
                    >
                      {NICOTINE_LEVELS.map((v) => <option key={v} value={v}>{v === 0 ? 'Sin nicotina' : `${v} mg`}</option>)}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label>Sabor / Descripción</label>
                  <input
                    value={form.details.flavor ?? ''}
                    onChange={(e) => setDetail('flavor', e.target.value)}
                    placeholder="ej. Arándanos y frambuesas heladas"
                  />
                </div>
              </div>
            </section>
          )}

          {kind === 'desechables' && (
            <section className="editor-section">
              <h2 className="editor-section-title">Especificaciones — Desechable</h2>
              <div className="field-group">
                <div className="field-row">
                  <div className="field">
                    <label>Puffs</label>
                    <input
                      type="number"
                      value={form.details.puffs ?? 600}
                      onChange={(e) => setDetail('puffs', Number(e.target.value))}
                      placeholder="600"
                    />
                  </div>
                  <div className="field">
                    <label>Nicotina (mg)</label>
                    <select
                      value={form.details.nicotine_mg ?? 20}
                      onChange={(e) => setDetail('nicotine_mg', Number(e.target.value))}
                    >
                      {NICOTINE_LEVELS.map((v) => <option key={v} value={v}>{v} mg</option>)}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label>Sabor</label>
                  <input
                    value={form.details.flavor ?? ''}
                    onChange={(e) => setDetail('flavor', e.target.value)}
                    placeholder="ej. Watermelon Ice"
                  />
                </div>
              </div>
            </section>
          )}

          {kind === 'vapers' && (
            <section className="editor-section">
              <h2 className="editor-section-title">Especificaciones — Vaper</h2>
              <div className="field-group">
                <div className="field-row">
                  <div className="field">
                    <label>Modelo</label>
                    <input
                      value={form.details.model ?? ''}
                      onChange={(e) => setDetail('model', e.target.value)}
                      placeholder="ej. Xlim V2"
                    />
                  </div>
                  <div className="field">
                    <label>Batería (mAh)</label>
                    <input
                      type="number"
                      value={form.details.battery_mah ?? ''}
                      onChange={(e) => setDetail('battery_mah', Number(e.target.value))}
                      placeholder="1000"
                    />
                  </div>
                  <div className="field">
                    <label>Potencia máx. (W)</label>
                    <input
                      type="number"
                      value={form.details.power_w ?? ''}
                      onChange={(e) => setDetail('power_w', Number(e.target.value))}
                      placeholder="25"
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {variantType && (
            <section className="editor-section">
              <VariantsEditor
                variantType={variantType}
                variants={isNew ? draftVariants : variants}
                onAdd={isNew ? addDraft : addVariant}
                onUpdate={isNew ? updateDraft : updateVariant}
                onRemove={isNew ? removeDraft : removeVariant}
                onSetPrimary={isNew ? setPrimaryDraft : setPrimaryVariant}
                upload={upload}
                uploading={uploading}
                productName={form.name}
              />
            </section>
          )}

          {(kind === 'accesorios' || kind === 'alquimia') && (
            <section className="editor-section">
              <h2 className="editor-section-title">Descripción</h2>
              <div className="field-group">
                <div className="field">
                  <label>Descripción del producto</label>
                  <textarea
                    rows={3}
                    value={form.details.description ?? ''}
                    onChange={(e) => setDetail('description', e.target.value)}
                    placeholder="Describe el accesorio o producto…"
                  />
                </div>
              </div>
            </section>
          )}

          <section className="editor-section">
            <h2 className="editor-section-title">Imágenes</h2>
            <div className="field-group">
              <div className="img-slots">
                <div className={`img-slot ${form.image_url ? 'img-slot--filled' : ''}`}>
                  {form.image_url ? (
                    <>
                      <img src={form.image_url} alt="principal" />
                      <button type="button" className="img-slot-remove" onClick={() => set('image_url', null)}>✕</button>
                      <span className="img-slot-primary-badge">PRINCIPAL</span>
                    </>
                  ) : (
                    <>
                      <span className="img-slot-label">Principal</span>
                      <label className="img-slot-upload">
                        {uploading ? '…' : '+ Foto'}
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleImageSlot(e, -1)} disabled={uploading} />
                      </label>
                    </>
                  )}
                </div>
                {[0, 1].map((i) => {
                  const url = form.images?.[i] ?? null
                  return (
                    <div key={i} className={`img-slot ${url ? 'img-slot--filled' : ''}`}>
                      {url ? (
                        <>
                          <img src={url} alt={`imagen ${i + 2}`} />
                          <button type="button" className="img-slot-remove"
                            onClick={() => {
                              const next = [...(form.images ?? [])]
                              next[i] = null
                              set('images', next)
                            }}>✕</button>
                        </>
                      ) : (
                        <>
                          <span className="img-slot-label">Foto {i + 2}</span>
                          <label className="img-slot-upload">
                            {uploading ? '…' : '+ Foto'}
                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleImageSlot(e, i)} disabled={uploading} />
                          </label>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
              {uploading && <span className="field-hint">Subiendo…</span>}
            </div>
          </section>
        </div>

        <div className="editor-side">
          {!variantType && (
            <section className="editor-section">
              <h2 className="editor-section-title">Precios</h2>
              <div className="field-group">
                <div className="field">
                  <label>Precio al público (€) *</label>
                  <input
                    required type="number" step="0.01"
                    value={form.price}
                    onChange={(e) => set('price', e.target.value)}
                    placeholder="4.50"
                  />
                </div>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={form.is_on_sale}
                    onChange={(e) => set('is_on_sale', e.target.checked)}
                  />
                  <span>En oferta</span>
                </label>
                {form.is_on_sale && (
                  <div className="field">
                    <label>Precio en oferta (€)</label>
                    <input
                      type="number" step="0.01"
                      value={form.sale_price}
                      onChange={(e) => set('sale_price', e.target.value)}
                      placeholder="3.90"
                    />
                  </div>
                )}
                <div className="field">
                  <label>Precio mayorista (€)</label>
                  <input
                    type="number" step="0.01"
                    value={form.wholesale_price}
                    onChange={(e) => set('wholesale_price', e.target.value)}
                    placeholder="3.10"
                  />
                  {marginPct != null && (
                    <span className="field-hint">Margen: {marginPct.toFixed(1)}%</span>
                  )}
                </div>
              </div>
            </section>
          )}

          {!variantType && (
            <section className="editor-section">
              <h2 className="editor-section-title">Inventario</h2>
              <div className="field-group">
                <div className="field">
                  <label>Unidades en stock *</label>
                  <input
                    required type="number"
                    value={form.stock}
                    onChange={(e) => set('stock', e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            </section>
          )}

          <section className="editor-section">
            <h2 className="editor-section-title">Visibilidad</h2>
            <div className="field-group">
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => set('is_active', e.target.checked)}
                />
                <span>Producto activo / visible</span>
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(e) => set('is_featured', e.target.checked)}
                />
                <span>Destacado en home</span>
              </label>
            </div>
          </section>
        </div>
      </form>
    </div>
  )
}

const MAX_COLOR_IMAGES = 4

const VARIANT_META = {
  color:  { title: 'Colores y variantes',              placeholder: 'ej. Negro mate, Azul cielo…',  hasColor: true,  hasImage: true  },
  flavor: { title: 'Sabores y variantes',              placeholder: 'ej. Mango Ice, Fresa Helada…', hasColor: false, hasImage: false },
  ohm:    { title: 'Resistencias (Ω)',                 placeholder: 'ej. 0.3Ω, 0.6Ω, 1.2Ω…',      hasColor: false, hasImage: false },
  nic:    { title: 'Concentraciones de nicotina',      placeholder: 'ej. 5 mg, 10 mg, 20 mg…',     hasColor: false, hasImage: false },
  volume: { title: 'Variantes de volumen',             placeholder: 'ej. 10ml/30ml, 24ml/60ml…',   hasColor: false, hasImage: false },
  recipe: { title: 'Composición (bases y nicokits)',   placeholder: '',                             hasColor: false, hasImage: false },
}

const EMPTY_DRAFT = { label: '', hex: '#6b7280', stock: '', price: '', sale_price: '', wholesale_price: '' }

const PriceInput = ({ value, onChange, onCommit, placeholder, inherited }) => (
  <div className="vfield">
    <input
      type="number" step="0.01" min={0}
      className="color-stock-input"
      style={{ width: 80 }}
      value={value}
      onChange={onChange}
      onBlur={onCommit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onCommit() } }}
      placeholder={inherited != null ? `${Number(inherited).toFixed(2)}` : placeholder}
    />
  </div>
)

const ALQUIMIA_AXES = [
  { key: 'vol',   label: 'Volumen',  opts: ['10ml','30ml','60ml','100ml','250ml','500ml','1L'] },
  { key: 'ratio', label: 'Ratio',    opts: ['50/50','30/70','20/80','100%VG','100%PG'] },
  { key: 'nic',   label: 'Nicotina', opts: ['0mg','3mg','6mg','9mg','12mg','18mg','20mg'] },
]

const AlquimiaComposer = ({ value, onChange }) => {
  const [axes, setAxes] = useState({ vol: '', ratio: '', nic: '' })
  const [free, setFree] = useState(false)

  const composed = ALQUIMIA_AXES.map((a) => axes[a.key]).filter(Boolean).join(' · ')

  const handleAxis = (key, val) => {
    const next = { ...axes, [key]: val }
    setAxes(next)
    const parts = ALQUIMIA_AXES.map((a) => next[a.key]).filter(Boolean)
    onChange(parts.join(' · '))
  }

  if (free) return (
    <div style={{ flex: 1, display: 'flex', gap: 6, alignItems: 'center' }}>
      <input type="text" className="color-name-input" style={{ flex: 1 }}
        value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="ej. Mango Ice · 30ml, Base especial…" />
      <button type="button" className="btn-ghost" style={{ fontSize: 11, flexShrink: 0 }}
        onClick={() => { setFree(false); setAxes({ vol: '', ratio: '', nic: '' }); onChange('') }}>
        ← Ejes
      </button>
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {ALQUIMIA_AXES.map((axis) => (
          <select key={axis.key} className="alq-axis-select"
            value={axes[axis.key]} onChange={(e) => handleAxis(axis.key, e.target.value)}>
            <option value="">{axis.label}…</option>
            {axis.opts.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        <button type="button" className="btn-ghost" style={{ fontSize: 11, flexShrink: 0 }}
          onClick={() => setFree(true)}>Libre</button>
      </div>
      {composed && (
        <span className="alq-preview">→ {composed}</span>
      )}
    </div>
  )
}

const VariantsEditor = ({ variantType, variants, onAdd, onUpdate, onRemove, onSetPrimary, upload, uploading, productName }) => {
  const meta = VARIANT_META[variantType] ?? VARIANT_META.flavor
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [edits, setEdits] = useState({}) // { [id]: { field: value } }

  const primary = variants.find((v) => v.is_primary) ?? variants[0]
  const imagesUsed = variants.filter((v) => v.image_url).length

  const setEdit = (id, field, val) =>
    setEdits((e) => ({ ...e, [id]: { ...(e[id] ?? {}), [field]: val } }))

  const commit = async (id, field) => {
    const val = edits[id]?.[field]
    if (val === undefined) return
    const parsed = field === 'stock' ? (Number(val) || 0) : (val !== '' ? parseFloat(val) : null)
    await onUpdate(id, { [field]: parsed })
    setEdits((e) => {
      const next = { ...e }
      if (next[id]) { delete next[id][field]; if (!Object.keys(next[id]).length) delete next[id] }
      return next
    })
  }

  const handleAdd = async () => {
    if (!draft.label.trim()) return
    setSaving(true)
    try {
      await onAdd({
        label: draft.label.trim(),
        hex: meta.hasColor ? draft.hex : null,
        stock: Number(draft.stock) || 0,
        price: draft.price !== '' ? parseFloat(draft.price) : null,
        sale_price: draft.sale_price !== '' ? parseFloat(draft.sale_price) : null,
        wholesale_price: draft.wholesale_price !== '' ? parseFloat(draft.wholesale_price) : null,
        image_url: null,
      })
      setDraft(EMPTY_DRAFT)
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleImage = async (id, file) => {
    if (!file) return
    try {
      const { publicUrl } = await upload(file, `${productName || 'product'}-variant-${id}`)
      await onUpdate(id, { image_url: publicUrl })
    } catch (err) {
      alert(`Error subiendo imagen: ${err.message}`)
    }
  }

  const fieldVal = (id, field, fallback) => edits[id]?.[field] ?? fallback ?? ''

  return (
    <div className="color-variants-section">
      <h2 className="editor-section-title">{meta.title}</h2>

      <div className="variant-cards-list">
        {variants.length === 0 && (
          <p style={{ fontSize: 13, color: '#333' }}>Sin variantes añadidas aún</p>
        )}

        {variants.map((v) => {
          const isPrimary = v.is_primary || v === primary
          return (
            <div key={v.id} className={`variant-card ${isPrimary ? 'variant-card--primary' : ''}`}>
              <div className="variant-card-top">
                <button
                  type="button"
                  className={`variant-primary-btn ${isPrimary ? 'variant-primary-btn--active' : ''}`}
                  title={isPrimary ? 'Variante principal' : 'Marcar como principal'}
                  onClick={() => !isPrimary && onSetPrimary(v.id)}
                >★</button>

                {meta.hasColor && (
                  <label className="color-swatch-label" title="Cambiar color">
                    <span className="color-swatch" style={{ background: v.hex ?? '#6b7280' }} />
                    <input type="color" value={v.hex ?? '#6b7280'}
                      onChange={(e) => onUpdate(v.id, { hex: e.target.value })}
                      className="color-picker-hidden" />
                  </label>
                )}

                <span className="variant-label">{v.label}</span>

                {meta.hasImage && (
                  <div className="color-image-slot" style={{ marginLeft: 'auto' }}>
                    {v.image_url ? (
                      <>
                        <img src={v.image_url} alt={v.label} className="color-thumb" />
                        <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '2px 6px' }}
                          onClick={() => onUpdate(v.id, { image_url: null })}>✕</button>
                      </>
                    ) : imagesUsed < MAX_COLOR_IMAGES ? (
                      <label className="btn-ghost color-img-upload" title={`${imagesUsed}/${MAX_COLOR_IMAGES} imágenes`}>
                        📷
                        <input type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={(e) => handleImage(v.id, e.target.files?.[0])} disabled={uploading} />
                      </label>
                    ) : <span className="color-img-cap">—</span>}
                  </div>
                )}

                <button type="button" className="color-remove-btn" onClick={() => onRemove(v.id)}>✕</button>
              </div>

              <div className="variant-card-pricing">
                <div className="vfield-wrap">
                  <span className="vfield-label">Precio público</span>
                  <PriceInput
                    value={fieldVal(v.id, 'price', v.price)}
                    onChange={(e) => setEdit(v.id, 'price', e.target.value)}
                    onCommit={() => commit(v.id, 'price')}
                    inherited={!isPrimary && v.price == null ? primary?.price : null}
                    placeholder="—"
                  />
                </div>
                <div className="vfield-wrap">
                  <span className="vfield-label">Precio oferta</span>
                  <PriceInput
                    value={fieldVal(v.id, 'sale_price', v.sale_price)}
                    onChange={(e) => setEdit(v.id, 'sale_price', e.target.value)}
                    onCommit={() => commit(v.id, 'sale_price')}
                    inherited={!isPrimary && v.sale_price == null ? primary?.sale_price : null}
                    placeholder="—"
                  />
                </div>
                <div className="vfield-wrap">
                  <span className="vfield-label">Mayorista</span>
                  <PriceInput
                    value={fieldVal(v.id, 'wholesale_price', v.wholesale_price)}
                    onChange={(e) => setEdit(v.id, 'wholesale_price', e.target.value)}
                    onCommit={() => commit(v.id, 'wholesale_price')}
                    inherited={!isPrimary && v.wholesale_price == null ? primary?.wholesale_price : null}
                    placeholder="—"
                  />
                </div>
                <div className="vfield-wrap">
                  <span className="vfield-label">Stock</span>
                  <div className="vfield">
                    <input
                      type="number" min={0}
                      className="color-stock-input"
                      style={{ width: 64 }}
                      value={fieldVal(v.id, 'stock', v.stock)}
                      onChange={(e) => setEdit(v.id, 'stock', e.target.value)}
                      onBlur={() => commit(v.id, 'stock')}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(v.id, 'stock') } }}
                    />
                    <span className="color-stock-label">uds</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Añadir nueva variante */}
      <div className="variant-add-card">
        <div className="variant-card-top">
          {meta.hasColor && (
            <label className="color-swatch-label" title="Elegir color">
              <span className="color-swatch" style={{ background: draft.hex }} />
              <input type="color" value={draft.hex}
                onChange={(e) => setDraft((d) => ({ ...d, hex: e.target.value }))}
                className="color-picker-hidden" />
            </label>
          )}
          {variantType === 'recipe' ? (
            <AlquimiaComposer
              value={draft.label}
              onChange={(v) => setDraft((d) => ({ ...d, label: v }))}
            />
          ) : (
            <input
              type="text"
              className="color-name-input"
              style={{ flex: 1 }}
              value={draft.label}
              onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
              placeholder={meta.placeholder}
            />
          )}
        </div>
        <div className="variant-card-pricing">
          <div className="vfield-wrap">
            <span className="vfield-label">Precio público</span>
            <div className="vfield">
              <input type="number" step="0.01" min={0} className="color-stock-input" style={{ width: 80 }}
                value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))} placeholder="—" />
            </div>
          </div>
          <div className="vfield-wrap">
            <span className="vfield-label">Precio oferta</span>
            <div className="vfield">
              <input type="number" step="0.01" min={0} className="color-stock-input" style={{ width: 80 }}
                value={draft.sale_price} onChange={(e) => setDraft((d) => ({ ...d, sale_price: e.target.value }))} placeholder="—" />
            </div>
          </div>
          <div className="vfield-wrap">
            <span className="vfield-label">Mayorista</span>
            <div className="vfield">
              <input type="number" step="0.01" min={0} className="color-stock-input" style={{ width: 80 }}
                value={draft.wholesale_price} onChange={(e) => setDraft((d) => ({ ...d, wholesale_price: e.target.value }))} placeholder="—" />
            </div>
          </div>
          <div className="vfield-wrap">
            <span className="vfield-label">Stock</span>
            <div className="vfield">
              <input type="number" min={0} className="color-stock-input" style={{ width: 64 }}
                value={draft.stock} onChange={(e) => setDraft((d) => ({ ...d, stock: e.target.value }))} placeholder="0" />
              <span className="color-stock-label">uds</span>
            </div>
          </div>
          <button type="button" className="btn-primary" style={{ fontSize: 12, alignSelf: 'flex-end' }}
            onClick={handleAdd} disabled={saving || !draft.label.trim()}>
            {saving ? '…' : '+ Añadir'}
          </button>
        </div>
      </div>

      {meta.hasImage && imagesUsed >= MAX_COLOR_IMAGES && (
        <p style={{ fontSize: 11, color: '#444', marginTop: 4 }}>Máximo {MAX_COLOR_IMAGES} imágenes alcanzado.</p>
      )}
    </div>
  )
}
