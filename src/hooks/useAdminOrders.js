import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

// 'ready' se llamaba 'shipped'/"Enviado" — no tiene sentido para una
// tienda que solo recoge en local, nunca envia nada. Renombrado sin
// migracion porque no habia pedidos reales en la base en ese momento
// (2026-07-16). Selector de estado ahora salta directo a cualquier
// valor (OrderStatusSelect) en vez de avanzar de a un paso, asi que ya
// no hace falta un campo "next".
export const ORDER_STATUSES = ['pending', 'preparing', 'ready', 'delivered', 'cancelled']

export const STATUS_META = {
  pending:    { label: 'Pendiente',        color: '#f59e0b' },
  preparing:  { label: 'Preparando',       color: '#3b82f6' },
  ready:      { label: 'Listo para recoger', color: '#06b6d4' },
  delivered:  { label: 'Entregado',        color: '#22c55e' },
  cancelled:  { label: 'Cancelado',        color: '#ef4444' },
}

const LIST_SELECT = `
  id, customer_name, customer_email, customer_phone, customer_address,
  status, total, notes, created_at, payment_method, payment_status,
  odoo_sync_status,
  order_items(id)
`

const DETAIL_SELECT = `
  id, customer_name, customer_email, customer_phone, customer_address,
  status, total, notes, created_at, payment_method, payment_status,
  odoo_sync_status, odoo_invoice_id, odoo_sync_error,
  order_items(id, product_id, product_name, product_price, quantity, variant_id, variant_label)
`

export const useAdminOrders = () => {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('orders')
      .select(LIST_SELECT)
      .order('created_at', { ascending: false })

    if (err) {
      setError(err)
      setOrders([])
    } else {
      setOrders(data ?? [])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // setOrders se expone para permitir updates optimistas (cambiar el
  // estado de un pedido en la UI al instante, con rollback si falla la
  // escritura) sin tener que refetchear toda la lista - ver
  // OrderStatusSelect / Orders.jsx.
  return { orders, loading, error, refetch: fetchAll, setOrders }
}

export const fetchOrderById = async (id) => {
  const { data, error } = await supabase
    .from('orders')
    .select(DETAIL_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export const updateOrderStatus = async (id, status) => {
  // Cancelar repone stock (ver supabase/cancel-order.sql) — cualquier
  // otro cambio de estado es un simple update, no toca inventario.
  if (status === 'cancelled') {
    const { error } = await supabase.rpc('cancel_order', { p_order_id: id })
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', id)
  if (error) throw error
}

// Lightweight count for badges (no items join)
export const usePendingOrdersCount = () => {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const { count: c } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
      if (!cancelled) setCount(c ?? 0)
    }
    run()
    const interval = setInterval(run, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return count
}
