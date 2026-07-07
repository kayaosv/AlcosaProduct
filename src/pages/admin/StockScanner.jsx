import { useRef, useState, useEffect, useCallback } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'

const QUICK_DELTAS = [1, 5, 10, -1, -5]
const BARCODE_FORMATS = ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code']

const hasCamera = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
const hasBarcodeDetector = () =>
  typeof window !== 'undefined' && 'BarcodeDetector' in window

export const StockScanner = () => {
  const ref        = useRef(null)
  const inputRef   = useRef(null)
  const resultRef  = useRef(null)
  const videoRef   = useRef(null)
  const streamRef  = useRef(null)
  const rafRef     = useRef(null)
  const detectorRef = useRef(null)
  const lastKeyTimeRef = useRef(0)

  const [barcode, setBarcode]     = useState('')
  const [product, setProduct]     = useState(null)
  const [variants, setVariants]   = useState([])
  const [selectedVariantId, setSelectedVariantId] = useState(null)
  const [notFound, setNotFound]   = useState(false)
  const [delta, setDelta]         = useState(1)
  const [saving, setSaving]       = useState(false)
  const [history, setHistory]     = useState([])
  const [scanMode, setScanMode]   = useState(true)
  const [cameraMode, setCameraMode] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [scanning, setScanning]   = useState(false)

  useGSAP(() => {
    gsap.from('.scanner-zone',    { y: 16, opacity: 0, duration: 0.4, ease: 'power3.out' })
    gsap.from('.scanner-history', { y: 16, opacity: 0, duration: 0.4, delay: 0.15, ease: 'power3.out' })
  }, { scope: ref })

  // Keep keyboard input focused when not in camera mode
  useEffect(() => {
    if (!cameraMode && scanMode) inputRef.current?.focus()
  }, [scanMode, product, cameraMode])

  // Global keydown capture for barcode gun (desktop)
  useEffect(() => {
    if (!scanMode || cameraMode) return
    const capture = (e) => {
      if (document.activeElement === inputRef.current) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', capture, true)
    return () => window.removeEventListener('keydown', capture, true)
  }, [scanMode, cameraMode])

  // Stop camera on unmount
  useEffect(() => () => stopCamera(), [])

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setScanning(false)
  }

  const startCamera = async () => {
    setCameraError(null)
    if (!hasBarcodeDetector()) {
      setCameraError('Tu navegador no soporta detección de códigos. Usa Chrome en Android o Safari iOS 16.4+')
      return
    }
    try {
      detectorRef.current = new window.BarcodeDetector({ formats: BARCODE_FORMATS })
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setScanning(true)
      scanLoop()
    } catch (err) {
      setCameraError(`No se pudo acceder a la cámara: ${err.message}`)
    }
  }

  const scanLoop = async () => {
    if (!videoRef.current || !detectorRef.current) return
    try {
      const codes = await detectorRef.current.detect(videoRef.current)
      if (codes.length > 0) {
        const raw = codes[0].rawValue
        navigator.vibrate?.(80)
        stopCamera()
        setCameraMode(false)
        await lookup(raw)
        return
      }
    } catch (_) {}
    rafRef.current = requestAnimationFrame(scanLoop)
  }

  const toggleCamera = () => {
    if (cameraMode) {
      stopCamera()
      setCameraMode(false)
      setCameraError(null)
    } else {
      setCameraMode(true)
      setProduct(null)
      setNotFound(false)
      setTimeout(startCamera, 100)
    }
  }

  const lookup = useCallback(async (code) => {
    const clean = (code ?? '').trim()
    if (!clean) return
    setNotFound(false)
    setProduct(null)
    setVariants([])
    setSelectedVariantId(null)
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

    // Productos con variantes guardan el stock real por variante, no en
    // products.stock (mismo motivo que en la ficha pública y el checkout
    // de variantes) — hay que traerlas para poder pedir cuál se repuso.
    const { data: variantRows } = await supabase
      .from('product_variants')
      .select('id, label, stock, sort_order')
      .eq('product_id', data.id)
      .order('sort_order')
    setVariants(variantRows ?? [])

    requestAnimationFrame(() => {
      if (resultRef.current)
        gsap.from(resultRef.current, { y: 10, opacity: 0, duration: 0.3, ease: 'power2.out' })
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

  const hasVariants = variants.length > 0
  const selectedVariant = hasVariants ? (variants.find((v) => v.id === selectedVariantId) ?? null) : null
  const effectiveStock = hasVariants ? (selectedVariant?.stock ?? null) : (product?.stock ?? null)

  const applyDelta = async (amount) => {
    if (!product || saving) return
    if (hasVariants && !selectedVariant) return
    const currentStock = hasVariants ? selectedVariant.stock : product.stock
    const newStock = Math.max(0, currentStock + amount)
    setSaving(true)
    try {
      if (hasVariants) {
        const { error } = await supabase.from('product_variants').update({ stock: newStock }).eq('id', selectedVariant.id)
        if (error) throw error
        setVariants((vs) => vs.map((v) => (v.id === selectedVariant.id ? { ...v, stock: newStock } : v)))
      } else {
        const { error } = await supabase.from('products').update({ stock: newStock }).eq('id', product.id)
        if (error) throw error
        setProduct((p) => ({ ...p, stock: newStock }))
      }
      setHistory((h) => [
        {
          id: product.id,
          name: product.name,
          variantLabel: hasVariants ? selectedVariant.label : null,
          before: currentStock,
          after: newStock,
          delta: amount,
          ts: new Date(),
        },
        ...h.slice(0, 19),
      ])
      gsap.from('.stock-updated', { scale: 0.9, opacity: 0, duration: 0.2, ease: 'back.out(2)' })
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setProduct(null)
    setVariants([])
    setSelectedVariantId(null)
    setNotFound(false)
    setBarcode('')
    setScanMode(true)
    stopCamera()
    setCameraMode(false)
    setCameraError(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const stockColor = (s) => s === 0 ? '#ef4444' : s <= 5 ? '#f59e0b' : '#4ade80'

  return (
    <div ref={ref} className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Escáner de stock</h1>
          <p className="page-subtitle">Pistola EAN · Enter para buscar{hasCamera() ? ' · o usa la cámara' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {hasCamera() && (
            <button
              className={`camera-btn ${cameraMode ? 'camera-btn--active' : ''}`}
              onClick={toggleCamera}
            >
              <IconCamera />
              {cameraMode ? 'Cerrar cámara' : 'Escanear con cámara'}
            </button>
          )}
          {history.length > 0 && (
            <button className="btn-ghost" onClick={() => setHistory([])}>Limpiar historial</button>
          )}
        </div>
      </div>

      <div className="scanner-grid">
        {/* ── ZONA DE ESCANEO ── */}
        <div className="scanner-zone">

          {/* Modo cámara */}
          {cameraMode && (
            <div style={{ marginBottom: 16 }}>
              {cameraError ? (
                <div className="scanner-not-found" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                  <p className="scanner-nf-title">Cámara no disponible</p>
                  <p className="scanner-nf-sub">{cameraError}</p>
                  <button className="btn-ghost" onClick={() => { setCameraMode(false); setCameraError(null) }}>Usar pistola</button>
                </div>
              ) : (
                <div className="camera-wrap">
                  <video ref={videoRef} className="camera-video" playsInline muted />
                  <div className="camera-aim">
                    <div className="camera-aim-box" />
                  </div>
                  <span className="camera-hint">
                    {scanning ? 'Apunta al código de barras…' : 'Iniciando cámara…'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Modo pistola / teclado */}
          {!cameraMode && (
            <div className="scanner-input-wrap">
              <IconBarcode />
              <input
                ref={inputRef}
                className="scanner-input"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => { if (scanMode && !cameraMode) inputRef.current?.focus() }}
                placeholder="Apunta y escanea…"
                autoComplete="off"
                spellCheck={false}
              />
              {barcode && (
                <button className="scanner-clear" onClick={() => { setBarcode(''); inputRef.current?.focus() }}>✕</button>
              )}
            </div>
          )}

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
                  <span className="stock-updated" style={{ color: effectiveStock == null ? '#555' : stockColor(effectiveStock), fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>
                    {effectiveStock == null ? '—' : effectiveStock}
                  </span>
                  <span style={{ fontSize: 11, color: '#555' }}>
                    {hasVariants && !selectedVariant ? 'elige variante' : 'en stock'}
                  </span>
                </div>
              </div>

              {hasVariants && (
                <div style={{ margin: '4px 0 16px' }}>
                  <p style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    Elige variante
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {variants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariantId(v.id)}
                        style={{
                          padding: '6px 12px',
                          fontSize: 12,
                          borderRadius: 6,
                          border: `1px solid ${v.id === selectedVariantId ? '#e53935' : '#2a2a2a'}`,
                          background: v.id === selectedVariantId ? '#e53935' : 'transparent',
                          color: v.id === selectedVariantId ? '#fff' : '#aaa',
                          cursor: 'pointer',
                        }}
                      >
                        {v.label} <span style={{ opacity: 0.7 }}>({v.stock})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(!hasVariants || selectedVariant) && (
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
              )}

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
                  <p className="scanner-history-name">{h.name}{h.variantLabel ? ` · ${h.variantLabel}` : ''}</p>
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

const IconCamera = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 0 2-2l2-3h10l2 3a2 2 0 0 0 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
)
