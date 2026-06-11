import { useRef, useState, useEffect, useMemo } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useCategories } from '../../hooks/useCategories.js'
import { useUploadImage } from '../../hooks/useUploadImage.js'
import {
  fetchProductById,
  createProduct,
  updateProduct,
} from '../../hooks/useAdminProducts.js'
import {
  NICOTINE_LEVELS, SALES_SIZES,
  LONGFILL_CONCENTRATES, LONGFILL_BOTTLES, MINILONGFILL_CONCENTRATES, categoryKind,
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
  details: {},
}

export const ProductEditor = () => {
  const ref = useRef(null)
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const { categories } = useCategories()
  const { upload, uploading } = useUploadImage()

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

  useGSAP(() => {
    gsap.from('.editor-section', {
      y: 20, opacity: 0, duration: 0.4, stagger: 0.08, ease: 'power3.out',
    })
  }, { scope: ref, dependencies: [loading] })

  const currentSlug = useMemo(
    () => categories.find((c) => c.id === form.category_id)?.slug,
    [categories, form.category_id],
  )
  const kind = categoryKind(currentSlug)

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))
  const setDetail = (key, val) =>
    setForm((f) => ({ ...f, details: { ...f.details, [key]: val } }))

  const handleImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { publicUrl } = await upload(file, form.name || 'product')
      set('image_url', publicUrl)
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
        details: form.details ?? {},
      }
      if (isNew) await createProduct(payload)
      else await updateProduct(id, payload)
      setSaved(true)
      setTimeout(() => navigate('/admin/products'), 600)
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
    <div ref={ref} className="page-content">
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
                <div className="field-row">
                  <div className="field">
                    <label>Tamaño</label>
                    <p style={{ margin: 0, padding: '8px 0', color: '#aaa', fontSize: 14 }}>
                      {SALES_SIZES[0]} ml <span style={{ color: '#555', fontSize: 12 }}>(formato único)</span>
                    </p>
                  </div>
                  <div className="field">
                    <label>Nicotina (mg/ml)</label>
                    <select
                      value={form.details.nicotine_mg ?? 20}
                      onChange={(e) => setDetail('nicotine_mg', Number(e.target.value))}
                    >
                      {NICOTINE_LEVELS.map((v) => <option key={v} value={v}>{v} mg</option>)}
                    </select>
                  </div>
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
                    <select
                      value={form.details.concentrate_ml ?? 10}
                      onChange={(e) => setDetail('concentrate_ml', Number(e.target.value))}
                    >
                      {LONGFILL_CONCENTRATES.map((v) => <option key={v} value={v}>{v} ml</option>)}
                    </select>
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
                      const space = (form.details.bottle_ml ?? 60) - (form.details.concentrate_ml ?? 10)
                      return space > 0
                        ? <span className="field-hint">Espacio para nicokit + base: {space} ml</span>
                        : <span className="field-hint" style={{ color: '#e53935' }}>El concentrado supera la botella</span>
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
                    <select
                      value={form.details.concentrate_ml ?? 10}
                      onChange={(e) => setDetail('concentrate_ml', Number(e.target.value))}
                    >
                      {MINILONGFILL_CONCENTRATES.map((v) => <option key={v} value={v}>{v} ml</option>)}
                    </select>
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
                      const space = (form.details.bottle_ml ?? 30) - (form.details.concentrate_ml ?? 10)
                      return <span className="field-hint">Espacio para nicokit + base: {space} ml</span>
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
            <h2 className="editor-section-title">Imagen</h2>
            <div className="field-group">
              {form.image_url && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img
                    src={form.image_url}
                    alt="preview"
                    style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #1e1e1e' }}
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => set('image_url', null)}
                  >
                    Quitar imagen
                  </button>
                </div>
              )}
              <div className="field">
                <label>{form.image_url ? 'Reemplazar imagen' : 'Subir imagen'}</label>
                <input type="file" accept="image/*" onChange={handleImage} disabled={uploading} />
                {uploading && <span className="field-hint">Subiendo…</span>}
              </div>
            </div>
          </section>
        </div>

        <div className="editor-side">
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
            </div>
          </section>

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
