import { describe, it, expect } from 'vitest'
import { channelLabel, filterOrders, buildLineRows, buildSummary } from './salesExport.js'

const order = (overrides) => ({
  id: 'o1',
  customer_name: 'Cliente Test',
  status: 'delivered',
  total: 10,
  created_at: '2026-08-10T12:00:00Z',
  payment_method: 'pos_efectivo',
  odoo_sync_status: 'synced',
  order_items: [{ product_name: 'Producto A', product_price: 5, quantity: 2, variant_label: null }],
  ...overrides,
})

describe('channelLabel', () => {
  it('mapea los payment_method conocidos a su etiqueta', () => {
    expect(channelLabel('pos_efectivo')).toBe('TPV · Efectivo')
    expect(channelLabel('stripe')).toBe('Online · Stripe')
  })

  it('devuelve el valor crudo si no hay mapeo', () => {
    expect(channelLabel('algo_nuevo')).toBe('algo_nuevo')
  })
})

describe('filterOrders', () => {
  const orders = [
    order({ id: 'a', payment_method: 'pos_efectivo', status: 'delivered' }),
    order({ id: 'b', payment_method: 'stripe', status: 'delivered' }),
    order({ id: 'c', payment_method: 'pos_tarjeta', status: 'cancelled' }),
  ]

  it('excluye canales desactivados', () => {
    const result = filterOrders(orders, {
      channels: { pos_efectivo: true, stripe: false, pos_tarjeta: true, pickup: true },
      includeCancelled: true,
    })
    expect(result.map((o) => o.id)).toEqual(['a', 'c'])
  })

  it('excluye cancelados por defecto', () => {
    const result = filterOrders(orders, {
      channels: { pos_efectivo: true, stripe: true, pos_tarjeta: true, pickup: true },
      includeCancelled: false,
    })
    expect(result.map((o) => o.id)).toEqual(['a', 'b'])
  })

  it('incluye cancelados cuando se pide explícitamente', () => {
    const result = filterOrders(orders, {
      channels: { pos_efectivo: true, stripe: true, pos_tarjeta: true, pickup: true },
      includeCancelled: true,
    })
    expect(result.map((o) => o.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('buildLineRows', () => {
  it('genera una fila por línea de producto, no por pedido', () => {
    const orders = [
      order({
        id: 'o1',
        order_items: [
          { product_name: 'A', product_price: 5, quantity: 2, variant_label: null },
          { product_name: 'B', product_price: 3, quantity: 1, variant_label: 'Rojo' },
        ],
      }),
    ]
    const rows = buildLineRows(orders)
    expect(rows).toHaveLength(2)
    expect(rows[0].subtotalLinea).toBe(10)
    expect(rows[1].variante).toBe('Rojo')
    expect(rows[1].canal).toBe('TPV · Efectivo')
  })

  it('un pedido sin líneas no rompe y no agrega filas', () => {
    const rows = buildLineRows([order({ order_items: [] })])
    expect(rows).toHaveLength(0)
  })
})

describe('buildSummary', () => {
  it('agrupa por canal y calcula totales y ticket promedio', () => {
    const orders = [
      order({ id: 'a', payment_method: 'pos_efectivo', total: 10 }),
      order({ id: 'b', payment_method: 'pos_efectivo', total: 20 }),
      order({ id: 'c', payment_method: 'stripe', total: 15 }),
    ]
    const summary = buildSummary(orders)
    expect(summary.totalPedidos).toBe(3)
    expect(summary.totalVentas).toBe(45)
    expect(summary.ticketPromedio).toBeCloseTo(15)

    const efectivo = summary.rows.find((r) => r.canal === 'TPV · Efectivo')
    expect(efectivo.pedidos).toBe(2)
    expect(efectivo.total).toBe(30)
  })

  it('con cero pedidos no divide por cero', () => {
    const summary = buildSummary([])
    expect(summary.totalPedidos).toBe(0)
    expect(summary.totalVentas).toBe(0)
    expect(summary.ticketPromedio).toBe(0)
    expect(summary.rows).toEqual([])
  })
})
