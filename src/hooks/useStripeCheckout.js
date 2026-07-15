import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export const useStripeCheckout = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const payOnline = async ({ customer, items, notes }) => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          customer,
          notes: notes || null,
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId ?? null,
            quantity: i.quantity,
          })),
          origin: window.location.origin,
        },
      })

      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)
      if (!data?.url) throw new Error('No se pudo iniciar el pago')

      // Redirige a Stripe - la pagina se abandona aqui, no hace falta
      // apagar "loading" en el camino de exito.
      window.location.href = data.url
    } catch (e) {
      setError(e.message || 'Error al iniciar el pago')
      setLoading(false)
    }
  }

  return { payOnline, loading, error }
}
