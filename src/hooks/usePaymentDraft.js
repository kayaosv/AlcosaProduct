import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

// Reemplaza a useStripeCheckout.js — en vez de crear una sesión de
// Stripe, valida precio/stock reales en el servidor (create_payment_draft,
// ver supabase/transfer-payment.sql) y guarda un borrador. El pedido real
// recién se crea cuando el dueño confirma el comprobante a mano desde
// /admin/pending-payments (confirm_payment_draft).
export const usePaymentDraft = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const createDraft = async ({ customer, items, notes }) => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase.rpc('create_payment_draft', {
        p_customer_name: customer.name,
        p_customer_email: customer.email,
        p_customer_phone: customer.phone,
        p_customer_address: customer.address,
        p_notes: notes || null,
        p_items: items.map((i) => ({
          product_id: i.productId,
          variant_id: i.variantId ?? null,
          quantity: i.quantity,
        })),
      })

      if (rpcError) throw rpcError

      const result = Array.isArray(data) ? data[0] : data
      if (!result) throw new Error('No se pudo iniciar el pago')

      setLoading(false)
      return { draftId: result.draft_id, total: result.total }
    } catch (e) {
      setError(e.message || 'Error al iniciar el pago')
      setLoading(false)
      return null
    }
  }

  return { createDraft, loading, error }
}
