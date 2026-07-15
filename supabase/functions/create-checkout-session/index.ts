// Vapers Alcosa — crea una Stripe Checkout Session para pago online.
//
// Coexiste con create_order() (reserva, paga en tienda) - esta funcion
// es solo para la opcion "pagar ahora online" del checkout. Nunca
// confia en precios/stock que manda el cliente: los revalida contra la
// base real via get_checkout_line() (supabase/stripe-checkout.sql).
// El pedido en si NO se crea aqui, ni se descuenta stock aqui - eso
// pasa recien cuando Stripe confirma el pago (ver stripe-webhook), por
// eso el carrito se guarda de momento en checkout_drafts.

import Stripe from "npm:stripe@^17"
import { createClient } from "npm:@supabase/supabase-js@2"

// Dominios desde los que se permite iniciar un pago - el "origin" lo
// manda el cliente para construir la url de vuelta tras pagar
// (success_url/cancel_url), asi que se valida contra una lista blanca
// en vez de confiar en el ciegamente (evita que alguien use este
// endpoint para generar un link de pago real que redirija a un dominio
// ajeno tras cobrar).
const ALLOWED_ORIGIN_SUFFIXES = [
  ".vercel.app",
  "vapersalcosa19.com",
  "localhost:5173",
  "localhost:4173",
]

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

const isAllowedOrigin = (origin: string) => {
  try {
    const { host, hostname } = new URL(origin)
    return ALLOWED_ORIGIN_SUFFIXES.some((s) => hostname === s || hostname.endsWith(s) || host === s)
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })

  try {
    const { customer, notes, items, origin } = await req.json()

    if (!customer?.name || !customer?.email || !customer?.phone) {
      return json({ error: "Faltan datos del cliente" }, 400)
    }
    if (!Array.isArray(items) || items.length === 0) {
      return json({ error: "El carrito está vacío" }, 400)
    }
    if (!origin || !isAllowedOrigin(origin)) {
      return json({ error: "Origen no permitido" }, 400)
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
    const draftItems: { product_id: string; variant_id: string | null; quantity: number }[] = []

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        return json({ error: "Línea de pedido inválida" }, 400)
      }

      const { data, error } = await supabase
        .rpc("get_checkout_line", { p_product_id: item.productId, p_variant_id: item.variantId ?? null })
        .single()

      if (error) throw error
      if (!data?.is_available) {
        return json({ error: `"${data?.product_name ?? "Producto"}" ya no está disponible` }, 409)
      }
      if (data.available_stock < item.quantity) {
        return json({ error: `Solo quedan ${data.available_stock} unidades de "${data.product_name}"` }, 409)
      }

      const label = data.variant_label ? `${data.product_name} — ${data.variant_label}` : data.product_name

      lineItems.push({
        quantity: item.quantity,
        price_data: {
          currency: "eur",
          unit_amount: Math.round(Number(data.unit_price) * 100),
          product_data: { name: label },
        },
      })

      draftItems.push({
        product_id: item.productId,
        variant_id: item.variantId ?? null,
        quantity: item.quantity,
      })
    }

    const { data: draft, error: draftError } = await supabase
      .from("checkout_drafts")
      .insert({
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        customer_address: customer.address ?? null,
        notes: notes ?? null,
        items: draftItems,
      })
      .select("id")
      .single()

    if (draftError) throw draftError

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!)

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customer.email,
      line_items: lineItems,
      metadata: { draft_id: draft.id },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout`,
    })

    return json({ url: session.url })
  } catch (err) {
    console.error(err)
    return json({ error: "No se pudo iniciar el pago, inténtalo de nuevo" }, 500)
  }
})
