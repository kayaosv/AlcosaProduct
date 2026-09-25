import { describe, it, expect } from 'vitest'
import { activeVariants, primaryVariant, needsVariantPick, productThumb } from './posVariants.js'

const shades = {
  image_url: null,
  product_variants: [
    { id: 'high', label: 'HIGH', is_primary: true, is_active: true, image_url: 'high.jpg' },
    { id: 'low', label: 'LOW', is_primary: false, is_active: true, image_url: null },
    { id: 'old', label: 'OLD', is_primary: false, is_active: false },
  ],
}

describe('posVariants', () => {
  it('pide elegir variante con 2+ variantes activas (regresión: se agregaba HIGH sola)', () => {
    expect(needsVariantPick(shades)).toBe(true)
  })

  it('no pide elegir con una sola variante activa ni sin variantes', () => {
    expect(needsVariantPick({ product_variants: [shades.product_variants[0], shades.product_variants[2]] })).toBe(false)
    expect(needsVariantPick({ product_variants: [] })).toBe(false)
    expect(needsVariantPick({})).toBe(false)
  })

  it('ignora variantes inactivas', () => {
    expect(activeVariants(shades).map((v) => v.id)).toEqual(['high', 'low'])
  })

  it('principal = is_primary, si no la primera', () => {
    expect(primaryVariant(activeVariants(shades)).id).toBe('high')
    expect(primaryVariant([{ id: 'a' }, { id: 'b' }]).id).toBe('a')
    expect(primaryVariant([])).toBeNull()
  })

  it('miniatura: foto del producto, si no la de la variante principal', () => {
    expect(productThumb({ ...shades, image_url: 'p.jpg' })).toBe('p.jpg')
    expect(productThumb(shades)).toBe('high.jpg')
    expect(productThumb({ product_variants: [] })).toBeNull()
  })
})
