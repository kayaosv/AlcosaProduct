import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

// Borradores de pago por transferencia/Bizum aún no confirmados por el
// dueño — ver supabase/transfer-payment.sql. No son pedidos todavía (no
// hay fila en `orders`), por eso viven en su propio hook en vez de
// useAdminOrders.js.
export const usePendingPaymentDrafts = () => {
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('checkout_drafts')
      .select('id, customer_name, customer_email, customer_phone, customer_address, notes, items, total, created_at')
      .is('consumed_at', null)
      .order('created_at', { ascending: false })

    if (err) {
      setError(err)
      setDrafts([])
    } else {
      setDrafts(data ?? [])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return { drafts, loading, error, refetch: fetchAll }
}

export const confirmPaymentDraft = async (draftId) => {
  const { data, error } = await supabase.rpc('confirm_payment_draft', { p_draft_id: draftId })
  if (error) throw error
  const result = Array.isArray(data) ? data[0] : data
  return { orderId: result.order_id, total: result.total }
}

// Lightweight count for the sidebar badge, mismo patron que usePendingOrdersCount.
export const usePendingPaymentDraftsCount = () => {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const { count: c } = await supabase
        .from('checkout_drafts')
        .select('id', { count: 'exact', head: true })
        .is('consumed_at', null)
      if (!cancelled) setCount(c ?? 0)
    }
    run()
    const interval = setInterval(run, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return count
}
