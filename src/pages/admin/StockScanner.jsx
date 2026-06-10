import { useRef, useState, useEffect, useCallback } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'

const QUICK_DELTAS = [1, 5, 10, -1, -5]

export const StockScanner = () => {
  const ref = useRef(null)
  const inputRef = useRef(null)
  const resultRef = useRef(null)
  const lastKeyTimeRef = useRef(0)

  const [barcode, setBarcode] = useState('')
  const [product, setProduct] = useState(null)   // found product
  const [notFound, setNotFound] = useState(false)
  const [delta, setDelta] = useState(1)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState([])     // { name, barcode, before, after, ts }
  const [scanMode, setScanMode] = useState(true) // true = scanner focused

  useGSAP(() => {
    gsap.from('.scanner-zone', { y: 16, opacity: 0, duration: 0.4, ease: 'power3.out' })
    gsap.from('.scanner-history', { y: 16, opacity: 0, duration: 0.4, delay: 0.15, ease: 'power3.out' })
  }, { scope: ref })

  // Keep input focused when in scan mode
  useEffect(() => {
    if (scanMode) inputRef.current?.focus()
  }, [scanMode, product])

  const lookup = useCallback(async (code) => {
    const clean = code.trim()
    if (!clean) return
    setNotFound(false)
    setProduct(null)
    setDelta(1)

    const { data } = await supabase
      .from('products')
      .select('id, name, brand, stock, image_url, categories(name)')
      .eq('barcode', clean)
      .single()

    if (!data) {
      setNotFound(true)
      gsap.from('.scanner-not-found', { y: 8, opacity: 0, duration: 0.25, ease: 'power2.out' })
      return
    }

    setProduct(data)
    requestAnimationFrame(() => {
      if (resultRef.current) {
        gsap.from(resultRef.current, { y: 10, opacity: 0, duration: 0.3, ease: 'power2.out' })
      }
    })
  }, [])

  const handleKeyDown = (e) => {
    lastKeyTimeRef.current = Date.now()
    if (e.key === 'Enter') {
      e.preventDefault()
      lookup(barcode)
      setBarcode('')
    }
  }

  const applyDelta = async (amount) => {
    if (!product || saving) return
    const newStock = Math.max(0, product.stock + amount)
    setSaving(true)
    try {
      const { error } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', product.id)
      if (error) throw error

      setHistory((h) => [
        { id: product.id, name: product.name, before: product.stock, after: newStock, delta: amount, ts: new Date() },
        ...h.slice(0, 19),
      ])
      setProduct((p) => ({ ...p, stock: newStock }))

      gsap.from('.stock-updated', { scale: 0.9, opacity: 0, duration: 0.2, ease: 'back.out(2)' })
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setProduct(null)
    setNotFound(false)
    setBarcode('')
    setScanMode(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const stockColor = (s) => s === 0 ? '#ef4444' : s <= 5 ? '#f59e0b' : '#4ade80'

  return (
    <div ref={ref} className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Escáner de stock</h1>
          <p className="page-subtitle">Escanea con la pistola o escribe el EAN · Enter para buscar</p>
        </div>
        {history.length > 0 && (
          <button className="btn-ghost" onClick={() => setHistory([])}>Limpiar historial</button>
        )}
      </div>

      <div className="scanner-grid">
        {/* ── ZONA DE ESCANEO ── */}
        <div className="scanner-zone">
          <div className="scanner-input-wrap">
            <IconBarcode />
            <input
              ref={inputRef}
              className="scanner-input"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => { if (scanMode) setTimeout(() => inputRef.current?.focus(), 100) }}
              placeholder="Apunta y escanea…"
              autoComplete="off"
              spellCheck={false}
            />
            {barcode && (
              <button className="scanner-clear" onClick={() => { setBarcode(''); inputRef.current?.focus() }}>✕</button>
            )}
          </div>

          {/* Producto no encontrado */}
          {notFound && !product && (
            <div className="scanner-not-found">
              <span className="scanner-nf-icon">⊘</span>
              <div>
                <p className="scanner-nf-title">Producto no encontrado</p>
                <p className="scanner-nf-sub">
                  El código escaneado no existe. <Link to="/admin/products/new">Crear producto</Link>
                </p>
              </div>
              <button className="btn-ghost" style={{ marginLeft: 'auto' }} onClick={reset}>Reintentar</button>
            </div>
          )}

          {/* Producto encontrado */}
          {product && (
            <div ref={resultRef} className="scanner-result">
              <div className="scanner-result-header">
                {product.image_url
                  ? <img src={product.image_url} alt={product.name} className="scanner-result-img" />
                  : <div className="scanner-result-placeholder">{product.name[0]}</div>
                }
                <div className="scanner-result-info">
                  <p className="scanner-result-name">{product.name}</p>
                  <p className="scanner-result-meta">
                    {product.brand && <span>{product.brand}</span>}
                    {product.categories?.name && <span>{product.categories.name}</span>}
                  </p>
                </div>
                <div className="scanner-result-stock">
                  <span className="stock-updated" style={{ color: stockColor(product.stock), fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>
                    {product.stock}
                  </span>
                  <span style={{ fontSize: 11, color: '#555' }}>en stock</span>
                </div>
              </div>

              <div className="scanner-controls">
                <div className="scanner-quick-btns">
                  {QUICK_DELTAS.map((d) => (
                    <button
                      key={d}
                      className={`scanner-quick-btn ${d < 0 ? 'scanner-quick-btn--neg' : ''}`}
                      onClick={() => applyDelta(d)}
                      disabled={saving}
                    >
                      {d > 0 ? `+${d}` : d}
                    </button>
                  ))}
                </div>
                <div className="scanner-custom-delta">
                  <span style={{ fontSize: 12, color: '#555' }}>Personalizado</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="number"
                      className="scanner-delta-input"
                      value={delta}
                      onChange={(e) => setDelta(Number(e.target.value))}
                      onFocus={() => setScanMode(false)}
                      onBlur={() => setScanMode(true)}
                    />
                    <button className="btn-primary" onClick={() => applyDelta(delta)} disabled={saving || delta === 0}>
                      {saving ? '…' : 'Aplicar'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="scanner-result-actions">
                <Link to={`/admin/products/${product.id}`} className="btn-ghost" style={{ fontSize: 12 }}>
                  Editar producto
                </Link>
                <button className="btn-ghost" style={{ fontSize: 12 }} onClick={reset}>
                  Escanear otro
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── HISTORIAL ── */}
        <div className="scanner-history">
          <p className="section-title">Historial de sesión</p>
          {history.length === 0
            ? <p style={{ color: '#333', fontSize: 13 }}>Sin movimientos aún</p>
            : history.map((h, i) => (
              <div key={i} className="scanner-history-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="scanner-history-name">{h.name}</p>
                  <p className="scanner-history-time">{h.ts.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                </div>
                <div className="scanner-history-delta" style={{ color: h.delta > 0 ? '#4ade80' : '#ef4444' }}>
                  {h.delta > 0 ? `+${h.delta}` : h.delta}
                </div>
                <div className="scanner-history-stocks">
                  <span style={{ color: '#444' }}>{h.before}</span>
                  <span style={{ color: '#333', fontSize: 10 }}>→</span>
                  <span style={{ color: '#e8e8e8' }}>{h.after}</span>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

const IconBarcode = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flexShrink: 0, color: '#333' }}>
    <path d="M3 5v14M7 5v14M11 5v14M15 5v9M19 5v14M15 17v2" strokeLinecap="round" />
    <rect x="13" y="14" width="6" height="5" rx="1" />
  </svg>
)
