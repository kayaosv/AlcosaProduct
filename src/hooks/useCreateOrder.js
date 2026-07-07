import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export const useCreateOrder = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const createOrder = async ({ customer, items, notes }) => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase.rpc('create_order', {
        p_customer_name: customer.name,
        p_customer_email: customer.email,
        p_customer_phone: customer.phone,
        p_customer_address: customer.address,
        p_notes: notes || null,
        p_items: items.map((i) => ({
          product_id: i.productId,
          quantity: i.quantity,
          variant_id: i.variantId ?? null,
        })),
      })

      if (rpcError) throw rpcError

      const result = Array.isArray(data) ? data[0] : data
      if (!result) throw new Error('No se pudo crear el pedido')

      setLoading(false)
      return { id: result.order_id, total: result.total }
    } catch (e) {
      setError(e.message || 'Error al crear el pedido')
      setLoading(false)
      return null
    }
  }

  return { createOrder, loading, error }
}
