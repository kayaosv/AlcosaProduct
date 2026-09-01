import { supabase } from './supabase.js'

// payment_method real en la base: 'pickup' (reserva, paga en tienda),
// 'stripe' (online), 'pos_efectivo' / 'pos_tarjeta' (TPV físico) — ver
// supabase/stripe-checkout.sql y supabase/pos-sale.sql.
export const CHANNELS = {
  pos_efectivo: 'TPV · Efectivo',
  pos_tarjeta: 'TPV · Tarjeta',
  stripe: 'Online · Stripe',
  pickup: 'Reserva en tienda',
}

export const channelLabel = (paymentMethod) => CHANNELS[paymentMethod] ?? paymentMethod ?? '—'

const SELECT = `
  id, customer_name, status, total, created_at, payment_method,
  odoo_sync_status,
  order_items(product_name, product_price, quantity, variant_label)
`

// dateFrom/dateTo: 'YYYY-MM-DD'. dateTo es inclusive (se le suma un día
// para el filtro `lt`, evita el off-by-one de comparar contra medianoche).
export const fetchOrdersForExport = async (dateFrom, dateTo) => {
  const toExclusive = new Date(`${dateTo}T00:00:00`)
  toExclusive.setDate(toExclusive.getDate() + 1)

  const { data, error } = await supabase
    .from('orders')
    .select(SELECT)
    .gte('created_at', `${dateFrom}T00:00:00`)
    .lt('created_at', toExclusive.toISOString())
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

// Filtra por canal activo + estado cancelado, misma lista de pedidos que
// va a alimentar tanto el resumen en pantalla como el export.
export const filterOrders = (orders, { channels, includeCancelled }) =>
  orders.filter((o) => {
    if (!channels[o.payment_method]) return false
    if (!includeCancelled && o.status === 'cancelled') return false
    return true
  })

// Una fila por línea de producto vendido — lo que se pide en el spec para
// que el gestor vea el detalle, no solo el total por pedido.
export const buildLineRows = (orders) =>
  orders.flatMap((o) =>
    (o.order_items ?? []).map((item) => {
      const created = new Date(o.created_at)
      return {
        fecha: created.toLocaleDateString('es-ES'),
        hora: created.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        pedido: o.id,
        canal: channelLabel(o.payment_method),
        estado: o.status,
        producto: item.product_name,
        variante: item.variant_label ?? '',
        cantidad: item.quantity,
        precioUnitario: Number(item.product_price ?? 0),
        subtotalLinea: Number(item.product_price ?? 0) * item.quantity,
        totalPedido: Number(o.total ?? 0),
        formaPago: channelLabel(o.payment_method),
        cliente: o.customer_name ?? '',
        odoo: o.odoo_sync_status ?? '—',
      }
    }),
  )

// Resumen por canal + gran total, para la vista previa en pantalla y la
// segunda hoja del Excel.
export const buildSummary = (orders) => {
  const byChannel = {}
  for (const o of orders) {
    const key = o.payment_method
    if (!byChannel[key]) byChannel[key] = { canal: channelLabel(key), pedidos: 0, total: 0 }
    byChannel[key].pedidos += 1
    byChannel[key].total += Number(o.total ?? 0)
  }
  const rows = Object.values(byChannel).sort((a, b) => b.total - a.total)
  const totalPedidos = orders.length
  const totalVentas = rows.reduce((s, r) => s + r.total, 0)
  const ticketPromedio = totalPedidos ? totalVentas / totalPedidos : 0
  return { rows, totalPedidos, totalVentas, ticketPromedio }
}

// Único punto donde se importa 'xlsx' — dynamic import a propósito (ver
// spec) para que la librería nunca entre al bundle inicial del admin,
// solo se descarga cuando el usuario efectivamente exporta.
export const downloadSalesExcel = async (orders, { dateFrom, dateTo }) => {
  const XLSX = await import('xlsx')

  const lineRows = buildLineRows(orders)
  const { rows: summaryRows, totalPedidos, totalVentas, ticketPromedio } = buildSummary(orders)

  const wb = XLSX.utils.book_new()

  const wsVentas = XLSX.utils.json_to_sheet(lineRows, {
    header: ['fecha', 'hora', 'pedido', 'canal', 'estado', 'producto', 'variante', 'cantidad', 'precioUnitario', 'subtotalLinea', 'totalPedido', 'formaPago', 'cliente', 'odoo'],
  })
  XLSX.utils.sheet_add_aoa(wsVentas, [[
    'Fecha', 'Hora', 'Pedido', 'Canal', 'Estado', 'Producto', 'Variante', 'Cantidad',
    'Precio unitario', 'Subtotal línea', 'Total pedido', 'Forma de pago', 'Cliente', 'Sync Odoo',
  ]], { origin: 'A1' })
  XLSX.utils.book_append_sheet(wb, wsVentas, 'Ventas')

  const wsResumen = XLSX.utils.json_to_sheet(
    summaryRows.map((r) => ({ canal: r.canal, pedidos: r.pedidos, total: r.total })),
    { header: ['canal', 'pedidos', 'total'] },
  )
  XLSX.utils.sheet_add_aoa(wsResumen, [['Canal', 'Pedidos', 'Total €']], { origin: 'A1' })
  XLSX.utils.sheet_add_aoa(wsResumen, [
    [],
    ['Total pedidos', totalPedidos],
    ['Total ventas €', Number(totalVentas.toFixed(2))],
    ['Ticket promedio €', Number(ticketPromedio.toFixed(2))],
  ], { origin: -1 })
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  XLSX.writeFile(wb, `ventas_${dateFrom}_${dateTo}.xlsx`)
}
