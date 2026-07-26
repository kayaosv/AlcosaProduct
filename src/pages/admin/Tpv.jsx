import { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { supabase } from '../../lib/supabase.js'
import { PosTicket } from '../../components/dom/admin/PosTicket.jsx'
import { applyDesechablesTiers } from '../../lib/promoTiers.js'

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code']

const hasCamera = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
const hasBarcodeDetector = () =>
  typeof window !== 'undefined' && 'BarcodeDetector' in window

// Misma resolucion de precio que create_pos_sale()/create_order() en
// el server (variante propia -> variante principal -> precio base) -
// esto es solo para mostrar un precio antes de cobrar, la validacion
// real (y el precio que efectivamente se cobra) la hace el RPC con
// FOR UPDATE en el momento de la venta.
const resolveVariantPrice = (product, variant, primaryVariant) => {
  if (variant?.price != null || variant?.sale_price != null) {
    return Number(variant.sale_price ?? variant.price)
  }
  if (primaryVariant && (primaryVariant.price != null || primaryVariant.sale_price != null)) {
    return Number(primaryVariant.sale_price ?? primaryVariant.price)
  }
  return Number((product.is_on_sale && product.sale_price) ? product.sale_price : product.price ?? 0)
}

export const Tpv = () => {
  const ref = useRef(null)
  const inputRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const detectorRef = useRef(null)

  const [barcode, setBarcode] = useState('')
  const [cart, setCart] = useState([])
  const [notFound, setNotFound] = useState(false)
  const [cameraMode, setCameraMode] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [paymentType, setPaymentType] = useState(null)
  const [charging, setCharging] = useState(false)
  const [lastSale, setLastSale] = useState(null)

  useGSAP(() => {
    gsap.from('.tpv-scanner', { y: 16, opacity: 0, duration: 0.4, ease: 'power3.out' })
    gsap.from('.tpv-cart', { y: 16, opacity: 0, duration: 0.4, delay: 0.1, ease: 'power3.out' })
  }, { scope: ref })

  useEffect(() => {
    if (!cameraMode && !lastSale) inputRef.current?.focus()
  }, [cameraMode, lastSale])

  useEffect(() => {
    if (cameraMode || lastSale) return
    const capture = () => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', capture, true)
    return () => window.removeEventListener('keydown', capture, true)
  }, [cameraMode, lastSale])

  useEffect(() => () => stopCamera(), [])

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
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
        navigator.vibrate?.(80)
        stopCamera()
        setCameraMode(false)
        await lookup(codes[0].rawValue)
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
      setTimeout(startCamera, 100)
    }
  }

  const addToCart = (line) => {
    setCart((prev) => {
      const key = `${line.productId}:${line.variantId ?? 'base'}`
      const existing = prev.find((l) => l.key === key)
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l))
      }
      return [...prev, { ...line, key, quantity: 1 }]
    })
  }

  const lookup = useCallback(async (code) => {
    const clean = (code ?? '').trim()
    if (!clean) return
    setNotFound(false)

    // Igual que StockScanner.jsx: primero se busca por codigo de
    // VARIANTE (sabor/mg/color/Ω propio), si no aparece se busca por
    // codigo del producto base.
    const { data: variantHit } = await supabase
      .from('product_variants')
      .select(`
        id, label, stock, price, sale_price, is_primary, product_id,
        products(id, name, price, sale_price, is_on_sale, categories(id, kind, promo_tiers))
      `)
      .eq('barcode', clean)
      .maybeSingle()

    if (variantHit?.products) {
      const { data: primary } = variantHit.is_primary
        ? { data: variantHit }
        : await supabase
            .from('product_variants')
            .select('price, sale_price')
            .eq('product_id', variantHit.product_id)
            .eq('is_primary', true)
            .maybeSingle()

      addToCart({
        productId: variantHit.product_id,
        variantId: variantHit.id,
        name: variantHit.products.name,
        variantLabel: variantHit.label,
        unitPrice: resolveVariantPrice(variantHit.products, variantHit, primary),
        maxStock: variantHit.stock,
        categoryId: variantHit.products.categories?.id ?? null,
        categoryKind: variantHit.products.categories?.kind ?? null,
        promoTiers: variantHit.products.categories?.promo_tiers ?? null,
      })
      setBarcode('')
      return
    }

    const { data: product } = await supabase
      .from('products')
      .select('id, name, price, sale_price, is_on_sale, stock, categories(id, kind, promo_tiers)')
      .eq('barcode', clean)
      .maybeSingle()

    if (!product) {
      setNotFound(true)
      gsap.from('.tpv-not-found', { y: 8, opacity: 0, duration: 0.25, ease: 'power2.out' })
      return
    }

    addToCart({
      productId: product.id,
      variantId: null,
      name: product.name,
      variantLabel: null,
      unitPrice: resolveVariantPrice(product, null, null),
      maxStock: product.stock,
      categoryId: product.categories?.id ?? null,
      categoryKind: product.categories?.kind ?? null,
      promoTiers: product.categories?.promo_tiers ?? null,
    })
    setBarcode('')
  }, [])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      lookup(barcode)
    }
  }

  const changeQty = (key, delta) => {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l))
        .filter((l) => l.quantity > 0)
    )
  }

  const removeLine = (key) => setCart((prev) => prev.filter((l) => l.key !== key))

  // Ajuste por tramo de volumen (desechables) — mismo calculo que
  // apply_desechables_tier() en el server, ver src/lib/promoTiers.js.
  // El vendedor tiene que ver el precio ya con el tramo aplicado antes
  // de cobrar en el datafono fisico, no despues.
  const displayCart = useMemo(() => applyDesechablesTiers(cart), [cart])
  const total = displayCart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)

  const charge = async () => {
    if (cart.length === 0 || !paymentType || charging) return
    setCharging(true)
    try {
      const { data, error } = await supabase.rpc('create_pos_sale', {
        p_items: cart.map((l) => ({
          product_id: l.productId,
          variant_id: l.variantId,
          quantity: l.quantity,
        })),
        p_payment_type: paymentType,
      })
      if (error) throw error

      const sale = Array.isArray(data) ? data[0] : data
      const soldItems = displayCart
      const soldPaymentType = paymentType

      setLastSale({
        orderId: sale.order_id,
        total: sale.total,
        paymentType: soldPaymentType,
        items: soldItems,
        createdAt: new Date(),
      })
      setCart([])
      setPaymentType(null)

      // Fire-and-forget: la venta ya quedo confirmada y el stock ya se
      // descontó, esto solo intenta la factura de Odoo en paralelo sin
      // bloquear la pantalla (ver supabase/functions/odoo-sync).
      supabase.functions.invoke('odoo-sync', { body: { order_id: sale.order_id } }).catch(() => {})
    } catch (err) {
      alert(`No se pudo cobrar la venta: ${err.message}`)
    } finally {
      setCharging(false)
    }
  }

  const newSale = () => {
    setLastSale(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  if (lastSale) {
    return (
      <div ref={ref} className="page-content">
        <PosTicket sale={lastSale} onNewSale={newSale} />
      </div>
    )
  }

  return (
    <div ref={ref} className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">TPV</h1>
          <p className="page-subtitle">Pistola EAN · Enter para agregar{hasCamera() ? ' · o usa la cámara' : ''}</p>
        </div>
        {hasCamera() && (
          <button
            className={`camera-btn ${cameraMode ? 'camera-btn--active' : ''}`}
            onClick={toggleCamera}
          >
            {cameraMode ? 'Cerrar cámara' : '📷 Cámara'}
          </button>
        )}
      </div>

      <div className="tpv-grid">
        <div className="tpv-scanner scanner-zone">
          {cameraMode ? (
            <div className="scanner-camera-wrap">
              <video ref={videoRef} className="scanner-camera-video" playsInline muted />
              {cameraError && <p className="scanner-nf-sub">{cameraError}</p>}
            </div>
          ) : (
            <div className="scanner-input-wrap">
              <input
                ref={inputRef}
                className="scanner-input"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escaneá o escribí el código de barras…"
                autoFocus
              />
            </div>
          )}

          {notFound && (
            <div className="scanner-not-found tpv-not-found">
              <span className="scanner-nf-icon">⚠</span>
              <div>
                <p className="scanner-nf-title">Código no encontrado</p>
                <p className="scanner-nf-sub">Ningún producto o variante tiene ese código de barras.</p>
              </div>
            </div>
          )}
        </div>

        <div className="tpv-cart">
          {cart.length === 0 ? (
            <p className="tpv-cart-empty">El carrito está vacío — escaneá un producto para empezar.</p>
          ) : (
            <div className="tpv-cart-lines">
              {displayCart.map((l) => (
                <div key={l.key} className="tpv-cart-line">
                  <div className="tpv-cart-line-info">
                    <p className="tpv-cart-line-name">{l.name}</p>
                    {l.variantLabel && <p className="tpv-cart-line-variant">{l.variantLabel}</p>}
                    <p className="tpv-cart-line-price">{l.unitPrice.toFixed(2)} € / u</p>
                  </div>
                  <div className="tpv-cart-line-qty">
                    <button onClick={() => changeQty(l.key, -1)}>−</button>
                    <span>{l.quantity}</span>
                    <button onClick={() => changeQty(l.key, 1)}>+</button>
                  </div>
                  <div className="tpv-cart-line-subtotal">
                    {(l.unitPrice * l.quantity).toFixed(2)} €
                  </div>
                  <button className="tpv-cart-line-remove" onClick={() => removeLine(l.key)} aria-label="Quitar">✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="tpv-cart-total">
            <span>Total</span>
            <span>{total.toFixed(2)} €</span>
          </div>

          <div className="tpv-payment-select">
            <button
              className={`tpv-payment-btn ${paymentType === 'efectivo' ? 'tpv-payment-btn--active' : ''}`}
              onClick={() => setPaymentType('efectivo')}
            >
              💶 Efectivo
            </button>
            <button
              className={`tpv-payment-btn ${paymentType === 'tarjeta' ? 'tpv-payment-btn--active' : ''}`}
              onClick={() => setPaymentType('tarjeta')}
            >
              💳 Tarjeta
            </button>
          </div>

          <button
            className="btn-primary tpv-charge-btn"
            disabled={cart.length === 0 || !paymentType || charging}
            onClick={charge}
          >
            {charging ? 'Cobrando…' : `Cobrar ${total.toFixed(2)} €`}
          </button>
        </div>
      </div>
    </div>
  )
}
