import { describe, it, expect, vi, beforeEach } from 'vitest'

const maybeSingle = vi.fn()
const eq = vi.fn(() => ({ maybeSingle }))
const select = vi.fn(() => ({ eq }))
const from = vi.fn(() => ({ select }))

vi.mock('./supabase.js', () => ({
  supabase: { from: (...args) => from(...args) },
}))

const { lookupByBarcode } = await import('./barcodeLookup.js')

describe('lookupByBarcode', () => {
  beforeEach(() => {
    maybeSingle.mockReset()
    from.mockClear()
  })

  it('devuelve null sin consultar nada si el código está vacío', async () => {
    const result = await lookupByBarcode('   ', { variantSelect: 'a', productSelect: 'b' })
    expect(result).toBeNull()
    expect(from).not.toHaveBeenCalled()
  })

  it('resuelve por variante cuando encuentra un match con producto embebido', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id: 'v1', products: { id: 'p1' } } })
    const result = await lookupByBarcode('123', { variantSelect: 'a', productSelect: 'b' })
    expect(result).toEqual({ type: 'variant', variant: { id: 'v1', products: { id: 'p1' } } })
    expect(from).toHaveBeenCalledWith('product_variants')
  })

  it('cae al producto base si no hay variante con ese código', async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: null }) // sin variante
      .mockResolvedValueOnce({ data: { id: 'p1', name: 'Producto' } }) // producto base
    const result = await lookupByBarcode('123', { variantSelect: 'a', productSelect: 'b' })
    expect(result).toEqual({ type: 'product', product: { id: 'p1', name: 'Producto' } })
    expect(from).toHaveBeenNthCalledWith(1, 'product_variants')
    expect(from).toHaveBeenNthCalledWith(2, 'products')
  })

  it('devuelve null si ni la variante ni el producto existen', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null }).mockResolvedValueOnce({ data: null })
    const result = await lookupByBarcode('999', { variantSelect: 'a', productSelect: 'b' })
    expect(result).toBeNull()
  })
})
