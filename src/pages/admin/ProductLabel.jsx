import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import JsBarcode from 'jsbarcode'
import { fetchProductById, updateProduct } from '../../hooks/useAdminProducts.js'
import { generateInternalEAN13 } from '../../lib/barcode.js'

export const ProductLabel = () => {
  const { id } = useParams()
  const svgRef = useRef(null)
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchProductById(id)
      .then((p) => { if (!cancelled) setProduct(p) })
      .catch((err) => setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (product?.barcode && svgRef.current) {
      JsBarcode(svgRef.current, product.barcode, {
        format: 'EAN13',
        width: 2,
        height: 60,
        fontSize: 14,
        margin: 8,
      })
    }
  }, [product?.barcode])

  // Reintenta con otro codigo si choca con el UNIQUE de products.barcode
  // (colision es muy improbable con 10 digitos al azar, pero el rango es
  // finito, asi que no dejamos el reintento al azar).
  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const updated = await updateProduct(id, { barcode: generateInternalEAN13() })
        setProduct(updated)
        setGenerating(false)
        return
      } catch (err) {
        const isUniqueClash = /barcode/i.test(err.message) || /duplicate/i.test(err.message)
        if (!isUniqueClash) {
          setError(err.message)
          setGenerating(false)
          return
        }
      }
    }
    setError('No se pudo generar un código único tras varios intentos, prueba otra vez.')
    setGenerating(false)
  }

  if (loading) return <div className="page-content"><p style={{ color: '#444' }}>Cargando…</p></div>
  if (!product) return <div className="page-content"><p style={{ color: '#444' }}>Producto no encontrado.</p></div>

  const displayPrice = product.is_on_sale && product.sale_price ? product.sale_price : product.price

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
          {product.barcode && (
            <button type="button" className="btn-primary" onClick={() => window.print()}>Imprimir</button>
          )}
        </div>
      </div>

      {error && <p className="admin-login-error no-print" style={{ marginBottom: 16 }}>{error}</p>}

      {!product.barcode ? (
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
