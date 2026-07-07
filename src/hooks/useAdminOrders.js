import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

export const ORDER_STATUSES = ['pending', 'preparing', 'shipped', 'delivered', 'cancelled']

export const STATUS_META = {
  pending:    { label: 'Pendiente',  color: '#f59e0b', next: 'preparing' },
  preparing:  { label: 'Preparando', color: '#3b82f6', next: 'shipped' },
  shipped:    { label: 'Enviado',    color: '#6366f1', next: 'delivered' },
  delivered:  { label: 'Entregado',  color: '#22c55e', next: null },
  cancelled:  { label: 'Cancelado',  color: '#ef4444', next: null },
}

const LIST_SELECT = `
  id, customer_name, customer_email, customer_phone, customer_address,
  status, total, notes, created_at,
  order_items(id)
`

const DETAIL_SELECT = `
  id, customer_name, customer_email, customer_phone, customer_address,
  status, total, notes, created_at,
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

  return { orders, loading, error, refetch: fetchAll }
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
