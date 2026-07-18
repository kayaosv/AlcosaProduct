import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import JsBarcode from 'jsbarcode'
import { fetchProductById, updateProduct } from '../../hooks/useAdminProducts.js'
import { useProductVariants } from '../../hooks/useProductVariants.js'
import { generateUniqueBarcode } from '../../lib/barcode.js'

export const ProductLabel = () => {
  const { id } = useParams()
  const svgRef = useRef(null)
  const variantSvgRefs = useRef({})
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [generatingVariantId, setGeneratingVariantId] = useState(null)

  const { variants, update: updateVariant } = useProductVariants(id)
  const hasVariants = variants.length > 0

  useEffect(() => {
    let cancelled = false
    fetchProductById(id)
      .then((p) => { if (!cancelled) setProduct(p) })
      .catch((err) => setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (!hasVariants && product?.barcode && svgRef.current) {
      JsBarcode(svgRef.current, product.barcode, {
        format: 'EAN13',
        width: 2,
        height: 60,
        fontSize: 14,
        margin: 8,
      })
    }
  }, [product?.barcode, hasVariants])

  // Cada variante es una unidad fisica distinta (sabor/mg/color/Ω) con
  // su propio codigo -- se dibuja un barcode por variante en vez de uno
  // solo para todo el producto.
  useEffect(() => {
    if (!hasVariants) return
    variants.forEach((v) => {
      const el = variantSvgRefs.current[v.id]
      if (v.barcode && el) {
        JsBarcode(el, v.barcode, { format: 'EAN13', width: 2, height: 60, fontSize: 14, margin: 8 })
      }
    })
  }, [hasVariants, variants])

  // Reintenta con otro codigo si choca con el UNIQUE de products.barcode
  // (colision es muy improbable con 10 digitos al azar, pero el rango es
  // finito, asi que no dejamos el reintento al azar).
  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      await generateUniqueBarcode(async (code) => {
        const updated = await updateProduct(id, { barcode: code })
        setProduct(updated)
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleGenerateVariant = async (variantId) => {
    setGeneratingVariantId(variantId)
    setError(null)
    try {
      await generateUniqueBarcode((code) => updateVariant(variantId, { barcode: code }))
    } catch (err) {
      setError(err.message)
    } finally {
      setGeneratingVariantId(null)
    }
  }

  if (loading) return <div className="page-content"><p style={{ color: '#444' }}>Cargando…</p></div>
  if (!product) return <div className="page-content"><p style={{ color: '#444' }}>Producto no encontrado.</p></div>

  const displayPrice = product.is_on_sale && product.sale_price ? product.sale_price : product.price

  // Mismo criterio que stockPricing.js: la variante hereda precio/oferta
  // del producto si no tiene los suyos propios.
  const variantPrice = (v) => {
    const price = v.price ?? product.price
    const sale = v.sale_price ?? (v.price == null ? product.sale_price : null)
    return (product.is_on_sale && sale != null) ? sale : price
  }

  const canPrint = hasVariants ? variants.some((v) => v.barcode) : !!product.barcode

  return (
    <div className="page-content">
      <div className="page-header no-print">
        <div>
          <div className="breadcrumb">
            <Link to="/admin/products">Productos</Link>
            <span>/</span>
            <span>Etiqueta</span>
          </div>
          <h1 className="page-title">Etiqueta — {product.name}</h1>
        </div>
        <div className="header-actions">
          <Link to={`/admin/products/${id}`} className="btn-ghost">Volver</Link>
          {canPrint && (
            <button type="button" className="btn-primary" onClick={() => window.print()}>Imprimir</button>
          )}
        </div>
      </div>

      {error && <p className="admin-login-error no-print" style={{ marginBottom: 16 }}>{error}</p>}

      {hasVariants ? (
        <div className="label-print-grid">
          {variants.map((v) => (
            <div key={v.id} className="label-print">
              <p className="label-name">{product.name}</p>
              <p className="label-brand">{v.label}</p>
              {v.barcode ? (
                <svg ref={(el) => { variantSvgRefs.current[v.id] = el }} />
              ) : (
                <div className="label-empty no-print">
                  <p>Sin código todavía.</p>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => handleGenerateVariant(v.id)}
                    disabled={generatingVariantId === v.id}
                  >
                    {generatingVariantId === v.id ? 'Generando…' : 'Generar código propio'}
                  </button>
                </div>
              )}
              {variantPrice(v) != null && (
                <p className="label-price">{Number(variantPrice(v)).toFixed(2)} €</p>
              )}
            </div>
          ))}
        </div>
      ) : !product.barcode ? (
        <div className="label-empty no-print">
          <p>Este producto no tiene código de barras todavía.</p>
          <button type="button" className="btn-primary" onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generando…' : 'Generar código propio'}
          </button>
        </div>
      ) : (
        <div className="label-print">
          <p className="label-name">{product.name}</p>
          {product.brand && <p className="label-brand">{product.brand}</p>}
          <svg ref={svgRef} />
          {displayPrice != null && (
            <p className="label-price">{Number(displayPrice).toFixed(2)} €</p>
          )}
        </div>
      )}
    </div>
  )
}
