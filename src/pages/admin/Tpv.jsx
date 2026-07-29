import { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { PosTicket } from '../../components/dom/admin/PosTicket.jsx'
import { applyDesechablesTiers } from '../../lib/promoTiers.js'
import { useBarcodeScanner, hasCamera } from '../../hooks/useBarcodeScanner.js'

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
  const [paymentType, setPaymentType] = useState(null)
  const [charging, setCharging] = useState(false)
  const [lastSale, setLastSale] = useState(null)

  useGSAP(() => {
    gsap.from('.tpv-scanner', { y: 16, opacity: 0, duration: 0.4, ease: 'power3.out' })
    gsap.from('.tpv-cart', { y: 16, opacity: 0, duration: 0.4, delay: 0.1, ease: 'power3.out' })
  }, { scope: ref })

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

      addToCart(buildLineFromVariant(variantHit, primary))
      return
    }

    const { data: product } = await supabase
      .from('products')
      .select(`
        id, name, price, sale_price, is_on_sale, stock, categories(id, kind, promo_tiers),
        product_variants(id, label, price, sale_price, stock, is_primary, is_active)
      `)
      .eq('barcode', clean)
      .maybeSingle()

    if (!product) {
      setNotFound(true)
      gsap.from('.tpv-not-found', { y: 8, opacity: 0, duration: 0.25, ease: 'power2.out' })
      return
    }

    // El codigo escaneado puede ser el del PRODUCTO (impreso en el
    // envase) aunque el producto tenga variantes con su propio precio/
    // stock real — products.price/stock quedan en 0 a proposito en ese
    // caso (ver stockPricing.js). Sin este chequeo se agregaba al
    // carrito con precio 0 en vez de resolver la variante principal.
    const activeVariants = (product.product_variants ?? []).filter((v) => v.is_active !== false)
    if (activeVariants.length) {
      const primary = activeVariants.find((v) => v.is_primary) ?? activeVariants[0]
      addToCart(buildLineFromVariant({ ...primary, product_id: product.id, products: product }, primary))
      return
    }

    addToCart(buildLineFromProduct(product))
  }, [])

  const scanner = useBarcodeScanner(lookup, { active: !lastSale })

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
            <div className="scanner-camera-wrap">
              <video ref={scanner.videoRef} className="scanner-camera-video" playsInline muted />
              {scanner.cameraError && <p className="scanner-nf-sub">{scanner.cameraError}</p>}
            </div>
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
