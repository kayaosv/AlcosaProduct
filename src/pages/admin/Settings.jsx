import { useState, useEffect } from 'react'
import { useShopSettings } from '../../hooks/useShopSettings.js'

export const Settings = () => {
  const { settings, loading, update } = useShopSettings()
  const [enabled, setEnabled] = useState(false)
  const [threshold, setThreshold] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [iban, setIban] = useState('')
  const [bizumPhone, setBizumPhone] = useState('')
  const [whatsappPhone, setWhatsappPhone] = useState('')
  const [timerMinutes, setTimerMinutes] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)
  const [savedPayment, setSavedPayment] = useState(false)

  const [ga4Id, setGa4Id] = useState('')
  const [pixelId, setPixelId] = useState('')
  const [savingSeo, setSavingSeo] = useState(false)
  const [savedSeo, setSavedSeo] = useState(false)

  useEffect(() => {
    if (!settings) return
    setEnabled(settings.free_shipping_enabled ?? false)
    setThreshold(settings.free_shipping_threshold ?? '')
    setIban(settings.payment_iban ?? '')
    setBizumPhone(settings.payment_bizum_phone ?? '')
    setWhatsappPhone(settings.payment_whatsapp_phone ?? '')
    setTimerMinutes(settings.payment_timer_minutes ?? 15)
    setGa4Id(settings.seo_ga4_id ?? '')
    setPixelId(settings.seo_meta_pixel_id ?? '')
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

  const handleSavePayment = async () => {
    setSavingPayment(true)
    setSavedPayment(false)
    try {
      await update({
        payment_iban: iban.trim() || null,
        payment_bizum_phone: bizumPhone.trim() || null,
        payment_whatsapp_phone: whatsappPhone.trim(),
        payment_timer_minutes: timerMinutes !== '' ? parseInt(timerMinutes, 10) : 15,
      })
      setSavedPayment(true)
      setTimeout(() => setSavedPayment(false), 1500)
    } catch (err) {
      alert(`Error guardando: ${err.message}`)
    } finally {
      setSavingPayment(false)
    }
  }

  const handleSaveSeo = async () => {
    setSavingSeo(true)
    setSavedSeo(false)
    try {
      await update({
        seo_ga4_id: ga4Id.trim() || null,
        seo_meta_pixel_id: pixelId.trim() || null,
      })
      setSavedSeo(true)
      setTimeout(() => setSavedSeo(false), 1500)
    } catch (err) {
      alert(`Error guardando: ${err.message}`)
    } finally {
      setSavingSeo(false)
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

      <section className="editor-section" style={{ maxWidth: 480 }}>
        <h2 className="editor-section-title">Pago por transferencia/Bizum</h2>
        <div className="field-group">
          <div className="field">
            <label>IBAN</label>
            <input
              type="text"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              placeholder="ES00 0000 0000 0000 0000 0000"
            />
            <span className="field-hint">Se muestra en la pantalla de pago. Vacío = no se muestra.</span>
          </div>
          <div className="field">
            <label>Número de Bizum</label>
            <input
              type="text"
              value={bizumPhone}
              onChange={(e) => setBizumPhone(e.target.value)}
              placeholder="ej. 600123456"
            />
            <span className="field-hint">Vacío = no se muestra.</span>
          </div>
          <div className="field">
            <label>WhatsApp para confirmar pagos</label>
            <input
              type="text"
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              placeholder="34600000000"
            />
            <span className="field-hint">Formato wa.me: código de país + número, sin espacios ni +.</span>
          </div>
          <div className="field">
            <label>Minutos del timer en la pantalla de pago</label>
            <input
              type="number"
              min="1"
              value={timerMinutes}
              onChange={(e) => setTimerMinutes(e.target.value)}
            />
            <span className="field-hint">Solo visual — no expira ni bloquea el pedido al llegar a cero.</span>
          </div>
          <button
            type="button"
            className={`btn-primary ${savedPayment ? 'btn-primary--saved' : ''}`}
            onClick={handleSavePayment}
            disabled={savingPayment}
            style={{ alignSelf: 'flex-start' }}
          >
            {savedPayment ? '✓ Guardado' : savingPayment ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </section>

      <section className="editor-section" style={{ maxWidth: 480 }}>
        <h2 className="editor-section-title">SEO y Analytics</h2>
        <div className="field-group">
          <div className="field">
            <label>Google Analytics 4 — Measurement ID</label>
            <input
              type="text"
              value={ga4Id}
              onChange={(e) => setGa4Id(e.target.value)}
              placeholder="G-XXXXXXXXXX"
            />
            <span className="field-hint">Vacío = no se carga ningún script de Google Analytics.</span>
          </div>
          <div className="field">
            <label>Meta Pixel ID (Facebook/Instagram Ads)</label>
            <input
              type="text"
              value={pixelId}
              onChange={(e) => setPixelId(e.target.value)}
              placeholder="ej. 123456789012345"
            />
            <span className="field-hint">Vacío = no se carga ningún script de Meta.</span>
          </div>
          <button
            type="button"
            className={`btn-primary ${savedSeo ? 'btn-primary--saved' : ''}`}
            onClick={handleSaveSeo}
            disabled={savingSeo}
            style={{ alignSelf: 'flex-start' }}
          >
            {savedSeo ? '✓ Guardado' : savingSeo ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </section>
    </div>
  )
}
