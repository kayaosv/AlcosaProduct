import { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { PosTicket } from '../../components/dom/admin/PosTicket.jsx'
import { applyDesechablesTiers } from '../../lib/promoTiers.js'
import { useBarcodeScanner, hasCamera } from '../../hooks/useBarcodeScanner.js'
import { lookupByBarcode } from '../../lib/barcodeLookup.js'
import { ScannerCameraControls } from '../../components/dom/admin/ScannerCameraControls.jsx'

const VARIANT_SELECT = `
  id, label, stock, price, sale_price, is_primary, product_id,
  products(id, name, price, sale_price, is_on_sale, categories(id, kind, promo_tiers))
`
const PRODUCT_SELECT = `
  id, name, price, sale_price, is_on_sale, stock, categories(id, kind, promo_tiers),
  product_variants(id, label, price, sale_price, stock, is_primary, is_active)
`

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

const buildLineFromVariant = (variantRow, primary) => ({
  productId: variantRow.product_id,
  variantId: variantRow.id,
  name: variantRow.products.name,
  variantLabel: variantRow.label,
  unitPrice: resolveVariantPrice(variantRow.products, variantRow, primary),
  maxStock: variantRow.stock,
  categoryId: variantRow.products.categories?.id ?? null,
  categoryKind: variantRow.products.categories?.kind ?? null,
  promoTiers: variantRow.products.categories?.promo_tiers ?? null,
})

const buildLineFromProduct = (product) => ({
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

export const Tpv = () => {
  const ref = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()

  const [cart, setCart] = useState([])
  const [notFound, setNotFound] = useState(false)
  const [scannedCode, setScannedCode] = useState('')
  const [paymentType, setPaymentType] = useState(null)
  const [charging, setCharging] = useState(false)
  const [lastSale, setLastSale] = useState(null)

  // "Venta rápida" — vender algo que no está cargado en el catálogo,
  // igual que en kayaosv/Stylo019: crea un producto mínimo oculto
  // (is_active:false, sin categoría — no pasa por el editor completo ni
  // sus moldes) con el stock justo de esta venta, y lo agrega al
  // carrito. Queda registrado como cualquier otra venta (orders/
  // order_items, visible en Pedidos y Analítica) — no es una línea
  // "libre" aparte del resto del sistema.
  const [quickAdd, setQuickAdd] = useState(null) // { code: string | null }
  const [quickName, setQuickName] = useState('')
  const [quickPrice, setQuickPrice] = useState('')
  const [quickQty, setQuickQty] = useState('1')
  const [quickCodeInput, setQuickCodeInput] = useState('') // solo si quickAdd.code es null
  const [quickSaving, setQuickSaving] = useState(false)
  const [quickError, setQuickError] = useState(null)

  // Descuento/precio manual por línea — para rebajarle a alguien en el
  // mostrador sin tener que ir a bajarle el precio al producto en
  // general. discountStep.catalogPrice es el precio efectivo actual de
  // esa línea (ya con el tramo de desechables aplicado si corresponde,
  // sin el manual) — la referencia contra la que se valida el tope.
  const [discountStep, setDiscountStep] = useState(null) // { key, catalogPrice }
  const [discountValue, setDiscountValue] = useState('')

  useGSAP(() => {
    gsap.from('.tpv-scanner', { y: 16, opacity: 0, duration: 0.4, ease: 'power3.out' })
    gsap.from('.tpv-cart', { y: 16, opacity: 0, duration: 0.4, delay: 0.1, ease: 'power3.out' })
  }, { scope: ref })

  const addToCart = (line) => {
    setCart((prev) => {
      const key = line.packId ? `pack:${line.packId}` : `${line.productId}:${line.variantId ?? 'base'}`
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
    setScannedCode(clean)

    const hit = await lookupByBarcode(clean, { variantSelect: VARIANT_SELECT, productSelect: PRODUCT_SELECT })

    if (hit?.type === 'variant') {
      const variantHit = hit.variant
      const { data: primary } = variantHit.is_primary
        ? { data: variantHit }
        : await supabase
            .from('product_variants')
            .select('price, sale_price')
            .eq('product_id', variantHit.product_id)
            .eq('is_primary', true)
            .maybeSingle()

      addToCart(buildLineFromVariant(variantHit, primary))
      return
    }

    if (hit?.type === 'product') {
      addProductRecord(hit.product)
      return
    }

    setNotFound(true)
    gsap.from('.tpv-not-found', { y: 8, opacity: 0, duration: 0.25, ease: 'power2.out' })
  }, [])

  // El codigo escaneado (o el producto elegido por nombre) puede ser el
  // del PRODUCTO (impreso en el envase) aunque el producto tenga
  // variantes con su propio precio/stock real — products.price/stock
  // quedan en 0 a proposito en ese caso (ver stockPricing.js). Sin este
  // chequeo se agregaba al carrito con precio 0 en vez de resolver la
  // variante principal. Compartido entre el escaneo de codigo y el
  // buscador por nombre.
  const addProductRecord = useCallback((product) => {
    const activeVariants = (product.product_variants ?? []).filter((v) => v.is_active !== false)
    if (activeVariants.length) {
      const primary = activeVariants.find((v) => v.is_primary) ?? activeVariants[0]
      addToCart(buildLineFromVariant({ ...primary, product_id: product.id, products: product }, primary))
      return
    }
    addToCart(buildLineFromProduct(product))
  }, [])

  const scanner = useBarcodeScanner(lookup, { active: !lastSale })

  // Buscador por nombre — el escaner cubre codigo de barras/camara, pero
  // no siempre el producto tiene codigo o el vendedor lo tiene a mano.
  // Mismo campo de busqueda (nombre/marca/codigo) que ya usa
  // /admin/products, adaptado para agregar directo al carrito.
  const [nameQuery, setNameQuery] = useState('')
  const [nameResults, setNameResults] = useState([])
  const [searchingName, setSearchingName] = useState(false)

  useEffect(() => {
    const q = nameQuery.trim()
    if (q.length < 2) {
      setNameResults([])
      setSearchingName(false)
      return
    }
    let cancelled = false
    setSearchingName(true)
    const timer = setTimeout(async () => {
      const [{ data: products }, { data: packs }] = await Promise.all([
        supabase
          .from('products')
          .select(`
            id, name, brand, price, sale_price, is_on_sale, stock, categories(id, kind, promo_tiers),
            product_variants(id, label, price, sale_price, stock, is_primary, is_active)
          `)
          .eq('is_active', true)
          .ilike('name', `%${q}%`)
          .order('name')
          .limit(6),
        supabase.from('packs').select('id, name, price').eq('is_active', true).ilike('name', `%${q}%`).order('name').limit(3),
      ])
      if (!cancelled) {
        setNameResults([
          ...(products ?? []).map((p) => ({ type: 'product', data: p })),
          ...(packs ?? []).map((p) => ({ type: 'pack', data: p })),
        ])
        setSearchingName(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [nameQuery])

  const addFromNameSearch = (result) => {
    if (result.type === 'pack') {
      const pack = result.data
      addToCart({
        productId: null, variantId: null, packId: pack.id,
        name: pack.name, variantLabel: null,
        unitPrice: Number(pack.price), maxStock: null,
        categoryId: null, categoryKind: null, promoTiers: null,
      })
    } else {
      addProductRecord(result.data)
    }
    setNameQuery('')
    setNameResults([])
  }

  const openQuickAdd = () => {
    const code = (notFound ? scannedCode : scanner.barcode).trim()
    setQuickAdd({ code: code || null })
    setQuickName('')
    setQuickPrice('')
    setQuickQty('1')
    setQuickCodeInput('')
    setQuickError(null)
    setNotFound(false)
    scanner.setBarcode('')
  }

  const saveQuickAdd = async () => {
    const name = quickName.trim()
    const price = Number(quickPrice)
    const qty = Math.max(1, Math.floor(Number(quickQty) || 1))
    if (!name) {
      setQuickError('Escribí una descripción.')
      return
    }
    if (!Number.isFinite(price) || price <= 0) {
      setQuickError('El precio tiene que ser mayor que 0.')
      return
    }
    setQuickSaving(true)
    setQuickError(null)
    const barcode = quickAdd.code || quickCodeInput.trim() || null
    // category_id null a propósito — es un producto oculto de venta
    // puntual, no pasa por el editor completo ni sus moldes por
    // categoría (ver specs/tpv-venta-rapida.md). stock = la cantidad
    // exacta de esta venta, para que create_pos_sale la descuente igual
    // que a cualquier producto real.
    const { data, error } = await supabase
      .from('products')
      .insert({ name, price, stock: qty, category_id: null, is_active: false, barcode })
      .select()
      .single()
    setQuickSaving(false)
    if (error) {
      setQuickError(error.code === '23505' ? 'Ese código de barras ya está en uso.' : `No se pudo guardar: ${error.message}`)
      return
    }
    setCart((prev) => [
      ...prev,
      {
        key: `${data.id}:base`, productId: data.id, variantId: null,
        name: data.name, variantLabel: null, unitPrice: price, maxStock: qty,
        categoryId: null, categoryKind: null, promoTiers: null, quantity: qty,
      },
    ])
    setQuickAdd(null)
  }

  // Handoff desde StockScanner.jsx ("+ Añadir a venta") - un producto/
  // variante ya identificado por id, no por codigo de barras, se agrega
  // directo al carrito al entrar a esta pantalla. Se limpia el state de
  // navegacion enseguida para que un refresh o volver atras no lo
  // vuelva a agregar.
  useEffect(() => {
    const incoming = location.state?.addToCart
    if (!incoming) return
    ;(async () => {
      if (incoming.variantId) {
        const { data: variantHit } = await supabase
          .from('product_variants')
          .select(`
            id, label, stock, price, sale_price, is_primary, product_id,
            products(id, name, price, sale_price, is_on_sale, categories(id, kind, promo_tiers))
          `)
          .eq('id', incoming.variantId)
          .maybeSingle()
        if (!variantHit?.products) return
        const { data: primary } = variantHit.is_primary
          ? { data: variantHit }
          : await supabase
              .from('product_variants')
              .select('price, sale_price')
              .eq('product_id', variantHit.product_id)
              .eq('is_primary', true)
              .maybeSingle()
        addToCart(buildLineFromVariant(variantHit, primary))
      } else {
        const { data: product } = await supabase
          .from('products')
          .select('id, name, price, sale_price, is_on_sale, stock, categories(id, kind, promo_tiers)')
          .eq('id', incoming.productId)
          .maybeSingle()
        if (product) addToCart(buildLineFromProduct(product))
      }
    })()
    navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  // de cobrar en el datafono fisico, no despues. Se calcula sobre el
  // carrito crudo (sin manualPrice) para que un descuento manual en una
  // linea no distorsione el conteo de unidades del tramo en las demas.
  const tieredCart = useMemo(() => applyDesechablesTiers(cart), [cart])
  const displayCart = useMemo(
    () => tieredCart.map((l) => (l.manualPrice != null ? { ...l, unitPrice: l.manualPrice } : l)),
    [tieredCart],
  )
  const total = displayCart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)

  const openDiscount = (key) => {
    const line = tieredCart.find((l) => l.key === key)
    if (!line) return
    setDiscountStep({ key, catalogPrice: line.unitPrice })
    setDiscountValue((cart.find((l) => l.key === key)?.manualPrice ?? line.unitPrice).toFixed(2))
  }

  const applyDiscount = () => {
    if (!discountStep) return
    const value = Number(discountValue)
    if (!Number.isFinite(value) || value < 0 || value > discountStep.catalogPrice) return
    setCart((prev) => prev.map((l) => (l.key === discountStep.key ? { ...l, manualPrice: value } : l)))
    setDiscountStep(null)
  }

  const clearDiscount = () => {
    if (!discountStep) return
    setCart((prev) => prev.map((l) => (l.key === discountStep.key ? { ...l, manualPrice: null } : l)))
    setDiscountStep(null)
  }

  const charge = async () => {
    if (cart.length === 0 || !paymentType || charging) return
    setCharging(true)
    try {
      const { data, error } = await supabase.rpc('create_pos_sale', {
        p_items: cart.map((l) => ({
          product_id: l.productId,
          variant_id: l.variantId,
          pack_id: l.packId ?? null,
          quantity: l.quantity,
          manual_price: l.manualPrice ?? null,
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
    setTimeout(() => scanner.inputRef.current?.focus(), 50)
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
            className={`camera-btn ${scanner.cameraMode ? 'camera-btn--active' : ''}`}
            onClick={scanner.toggleCamera}
          >
            {scanner.cameraMode ? 'Cerrar cámara' : '📷 Cámara'}
          </button>
        )}
      </div>

      <div className="tpv-grid">
        <div className="tpv-scanner scanner-zone">
          {scanner.cameraMode ? (
            scanner.cameraError ? (
              <div className="scanner-not-found" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                <p className="scanner-nf-title">Cámara no disponible</p>
                <p className="scanner-nf-sub">{scanner.cameraError}</p>
                <button className="btn-ghost" onClick={scanner.toggleCamera}>Usar pistola</button>
              </div>
            ) : (
              <div className="camera-wrap">
                <video ref={scanner.videoRef} className="camera-video" playsInline muted />
                <ScannerCameraControls scanner={scanner} />
                <div className="camera-aim">
                  <div className="camera-aim-box" />
                </div>
                <span className="camera-hint">
                  {scanner.noDetection
                    ? 'No se reconoce — si el código está en una superficie curva, girá el envase para aplanarlo hacia la cámara'
                    : scanner.scanning
                    ? 'Apuntá al código de barras…'
                    : 'Iniciando cámara…'}
                </span>
              </div>
            )
          ) : (
            <div className="scanner-input-wrap">
              <input
                ref={scanner.inputRef}
                className="scanner-input"
                value={scanner.barcode}
                onChange={(e) => scanner.setBarcode(e.target.value)}
                onKeyDown={scanner.handleKeyDown}
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

          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: 12, marginTop: 10 }}
            onClick={openQuickAdd}
          >
            + Venta rápida (producto no registrado)
          </button>

          <div className="tpv-name-search">
            <div className="scanner-input-wrap">
              <input
                className="scanner-input tpv-name-search-input"
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
                placeholder="…o buscá por nombre"
              />
              {nameQuery && (
                <button type="button" className="scanner-clear" onClick={() => setNameQuery('')}>✕</button>
              )}
            </div>
            {nameQuery.trim().length >= 2 && (
              <div className="tpv-name-results">
                {searchingName ? (
                  <p className="tpv-name-results-empty">Buscando…</p>
                ) : nameResults.length === 0 ? (
                  <p className="tpv-name-results-empty">Sin resultados.</p>
                ) : (
                  nameResults.map((r) => (
                    <button
                      key={r.type === 'pack' ? `pack:${r.data.id}` : r.data.id}
                      type="button"
                      className="tpv-name-result"
                      onClick={() => addFromNameSearch(r)}
                    >
                      <span className="tpv-name-result-name">
                        {r.type === 'pack' ? `🎁 ${r.data.name}` : r.data.name}
                      </span>
                      {r.type === 'pack' ? (
                        <span className="tpv-name-result-brand">{Number(r.data.price).toFixed(2)} €</span>
                      ) : (
                        r.data.brand && <span className="tpv-name-result-brand">{r.data.brand}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
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
                    <p className="tpv-cart-line-price">
                      {l.unitPrice.toFixed(2)} € / u
                      {l.manualPrice != null && <span style={{ color: '#4ade80' }}> · rebajado</span>}
                    </p>
                  </div>
                  <div className="tpv-cart-line-qty">
                    <button onClick={() => changeQty(l.key, -1)}>−</button>
                    <span>{l.quantity}</span>
                    <button onClick={() => changeQty(l.key, 1)}>+</button>
                  </div>
                  <div className="tpv-cart-line-subtotal">
                    {(l.unitPrice * l.quantity).toFixed(2)} €
                  </div>
                  {!l.packId && (
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 12, padding: '4px 8px' }}
                      title="Editar precio / aplicar descuento"
                      onClick={() => openDiscount(l.key)}
                    >
                      %
                    </button>
                  )}
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

      {discountStep && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', padding: 20 }}
          onClick={() => setDiscountStep(null)}
        >
          <div
            style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 10, padding: 24, maxWidth: 340, width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>Precio de esta línea</h3>
            <p style={{ fontSize: 12, color: '#666', margin: '0 0 16px' }}>
              Precio actual: {discountStep.catalogPrice.toFixed(2)} €
            </p>
            <input
              type="number"
              step="0.01"
              min="0"
              max={discountStep.catalogPrice}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              autoFocus
              className="scanner-input"
              style={{ width: '100%', marginBottom: 12 }}
            />
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {[10, 20, 30].map((pct) => (
                <button
                  key={pct}
                  className="btn-ghost"
                  style={{ fontSize: 12 }}
                  onClick={() => setDiscountValue((discountStep.catalogPrice * (1 - pct / 100)).toFixed(2))}
                >
                  −{pct}%
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={applyDiscount}>Aplicar</button>
              <button className="btn-ghost" onClick={clearDiscount}>Sin descuento</button>
            </div>
          </div>
        </div>
      )}

      {quickAdd && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', padding: 20 }}
          onClick={() => setQuickAdd(null)}
        >
          <div
            style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 10, padding: 24, maxWidth: 360, width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>Venta rápida</h3>
            <p style={{ fontSize: 12, color: '#666', margin: '0 0 16px' }}>
              {quickAdd.code
                ? `Código ${quickAdd.code} — no existe en el catálogo. `
                : ''}
              Queda cargado como producto oculto (no se muestra en la web), disponible para vender ahora.
            </p>
            <input
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              placeholder="Descripción (ej: Bufanda gris)"
              autoFocus
              className="scanner-input"
              style={{ width: '100%', marginBottom: 10 }}
            />
            {!quickAdd.code && (
              <input
                value={quickCodeInput}
                onChange={(e) => setQuickCodeInput(e.target.value)}
                placeholder="Código de barras (opcional)"
                className="scanner-input"
                style={{ width: '100%', marginBottom: 10 }}
              />
            )}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                type="number" step="0.01" min="0"
                value={quickPrice}
                onChange={(e) => setQuickPrice(e.target.value)}
                placeholder="Precio €"
                className="scanner-input"
                style={{ flex: 1 }}
              />
              <input
                type="number" step="1" min="1"
                value={quickQty}
                onChange={(e) => setQuickQty(e.target.value)}
                placeholder="Cantidad"
                className="scanner-input"
                style={{ width: 90 }}
              />
            </div>
            {quickError && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{quickError}</p>}
            <button className="btn-primary" style={{ width: '100%' }} disabled={quickSaving} onClick={saveQuickAdd}>
              {quickSaving ? 'Guardando…' : 'Agregar al carrito'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
