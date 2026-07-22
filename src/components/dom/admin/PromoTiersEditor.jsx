import { useState, useEffect } from 'react'

const EMPTY_TIERS = [
  { min_qty: '', unit_price: '' },
  { min_qty: '', unit_price: '' },
  { min_qty: '', unit_price: '' },
]

const toDraft = (tiers) => {
  const existing = Array.isArray(tiers) && tiers.length > 0 ? tiers : null
  return existing
    ? [0, 1, 2].map((i) => existing[i] ?? { min_qty: '', unit_price: '' })
    : EMPTY_TIERS
}

// Promociones por volumen — solo para categorías de tipo desechables
// (ver apply_desechables_tier() en supabase/, se aplican automático
// en carrito/checkout/TPV, esto solo define los 3 tramos). Es
// configuración de la CATEGORÍA, no del producto — aplica a todos los
// desechables por igual, aunque se edite desde la ficha de un
// producto puntual (ProductEditor) o desde Categories.jsx.
//
// alwaysOpen=true muestra los 3 inputs directo, sin el link
// "clic para expandir" (usado en ProductEditor, donde hay espacio y
// el admin espera verlos al cargar un desechable). Sin la prop, queda
// colapsado detrás de un link chico (usado en la card compacta de
// Categories.jsx).
export const PromoTiersEditor = ({ category, onSave, alwaysOpen = false }) => {
  const [open, setOpen] = useState(alwaysOpen)
  const [draft, setDraft] = useState(() => toDraft(category.promo_tiers))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Si cambia la categoría seleccionada (ProductEditor: el admin elige
  // otra categoría desechable, o carga otro producto) el draft tiene
  // que refrescarse contra los tramos de ESA categoría.
  useEffect(() => {
    setDraft(toDraft(category.promo_tiers))
  }, [category.id, category.promo_tiers])

  const existing = Array.isArray(category.promo_tiers) && category.promo_tiers.length > 0
    ? category.promo_tiers
    : null

  const startEdit = () => {
    setDraft(toDraft(category.promo_tiers))
    setOpen(true)
  }

  const setTier = (i, field, val) =>
    setDraft((d) => d.map((t, idx) => (idx === i ? { ...t, [field]: val } : t)))

  const save = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const cleaned = draft
        .filter((t) => t.min_qty !== '' && t.unit_price !== '')
        .map((t) => ({ min_qty: parseInt(t.min_qty), unit_price: parseFloat(t.unit_price) }))
        .sort((a, b) => a.min_qty - b.min_qty)
      await onSave(cleaned.length ? cleaned : null)
      setSaved(true)
      if (!alwaysOpen) setOpen(false)
      setTimeout(() => setSaved(false), 1500)
    } catch (err) {
      alert(`Error guardando promociones: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <div style={{ marginTop: 6 }}>
        <span
          title="Clic para definir promociones por volumen"
          style={{ cursor: 'pointer', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}
          onClick={startEdit}
        >
          Promos: {existing ? `${existing.length} tramo${existing.length !== 1 ? 's' : ''}` : 'sin definir'}
        </span>
      </div>
    )
  }

  return (
    <div style={alwaysOpen ? undefined : { marginTop: 6, padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
      <p style={{ fontSize: alwaysOpen ? 12 : 10, color: alwaysOpen ? '#666' : 'rgba(255,255,255,0.4)', marginBottom: alwaysOpen ? 12 : 6 }}>
        Hasta 3 tramos — vacío = sin promoción en ese tramo. Aplica a TODOS los
        desechables, no solo a este producto (es configuración de la categoría).
      </p>
      {draft.map((t, i) => (
        <div key={i} className={alwaysOpen ? 'field-row' : undefined} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: alwaysOpen ? 10 : 6 }}>
          <input
            type="number" min={1}
            placeholder="uds."
            value={t.min_qty}
            onChange={(e) => setTier(i, 'min_qty', e.target.value)}
            style={{ width: alwaysOpen ? 80 : 56, fontSize: alwaysOpen ? undefined : 11 }}
          />
          <span style={{ fontSize: alwaysOpen ? 12 : 10, color: alwaysOpen ? '#666' : 'rgba(255,255,255,0.4)' }}>uds. →</span>
          <input
            type="number" step="0.01" min={0}
            placeholder="€/ud"
            value={t.unit_price}
            onChange={(e) => setTier(i, 'unit_price', e.target.value)}
            style={{ width: alwaysOpen ? 90 : 64, fontSize: alwaysOpen ? undefined : 11 }}
          />
          <span style={{ fontSize: alwaysOpen ? 12 : 10, color: alwaysOpen ? '#666' : 'rgba(255,255,255,0.4)' }}>€/ud</span>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
        <button type="button" className={alwaysOpen ? 'btn-primary' : 'btn-primary'} style={alwaysOpen ? undefined : { fontSize: 11 }} onClick={save} disabled={saving}>
          {saved ? '✓ Guardado' : saving ? 'Guardando…' : 'Guardar promociones'}
        </button>
        {!alwaysOpen && (
          <button type="button" className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setOpen(false)}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}
