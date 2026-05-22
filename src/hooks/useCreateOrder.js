import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export const useCreateOrder = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const createOrder = async ({ customer, items, notes }) => {
    setLoading(true)
    setError(null)

    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

    try {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name: customer.name,
          customer_email: customer.email,
          customer_phone: customer.phone,
          customer_address: customer.address,
          notes: notes || null,
          status: 'pending',
          total,
        })
        .select('id')
        .single()

      if (orderError) throw orderError

      const orderItems = items.map((i) => ({
        order_id: order.id,
        product_id: i.productId,
        product_name: i.name,
        product_price: i.price,
        quantity: i.quantity,
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) throw itemsError

      setLoading(false)
      return { id: order.id, total }
    } catch (e) {
      setError(e.message || 'Error al crear el pedido')
      setLoading(false)
      return null
    }
  }

  return { createOrder, loading, error }
}
