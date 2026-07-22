import { useState, useEffect } from 'react'
import { useShopSettings } from '../../hooks/useShopSettings.js'

export const Settings = () => {
  const { settings, loading, update } = useShopSettings()
  const [enabled, setEnabled] = useState(false)
  const [threshold, setThreshold] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!settings) return
    setEnabled(settings.free_shipping_enabled ?? false)
    setThreshold(settings.free_shipping_threshold ?? '')
  }, [settings])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await update({
        free_shipping_enabled: enabled,
        free_shipping_threshold: threshold !== '' ? parseFloat(threshold) : null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (err) {
      alert(`Error guardando: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="page-content"><p style={{ color: '#444' }}>Cargando…</p></div>

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ajustes</h1>
          <p className="page-subtitle">Configuración general de la tienda</p>
        </div>
      </div>

      <section className="editor-section" style={{ maxWidth: 480 }}>
        <h2 className="editor-section-title">Banner de envío gratis</h2>
        <div className="field-group">
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>Mostrar banner en la web</span>
          </label>
          <div className="field">
            <label>A partir de (€)</label>
            <input
              type="number"
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="ej. 30"
            />
            <span className="field-hint">Solo es un aviso — no aplica descuento automático en el checkout.</span>
          </div>
          <button
            type="button"
            className={`btn-primary ${saved ? 'btn-primary--saved' : ''}`}
            onClick={handleSave}
            disabled={saving}
            style={{ alignSelf: 'flex-start' }}
          >
            {saved ? '✓ Guardado' : saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </section>
    </div>
  )
}
