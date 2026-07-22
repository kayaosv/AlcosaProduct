// Vapers Alcosa — webhook de Stripe: confirma el pago y recien ahi crea
// el pedido + descuenta stock (via create_paid_order, ver
// supabase/stripe-checkout.sql). Autenticacion propia por firma de
// Stripe (STRIPE_WEBHOOK_SECRET) - no lleva JWT de Supabase, por eso se
// despliega con verify_jwt=false.
//
// Idempotencia: Stripe puede reintentar la entrega del mismo evento.
// checkout_drafts.consumed_at es el guard principal; el UNIQUE de
// orders.stripe_session_id es el segundo por si dos entregas llegan casi
// a la vez.

import Stripe from "npm:stripe@^17"
import { createClient } from "npm:@supabase/supabase-js@2"

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature")
  const body = await req.text()

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!)
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature ?? "", webhookSecret)
  } catch (err) {
    console.error("Firma de webhook invalida:", err)
    return new Response("Firma inválida", { status: 400 })
  }

  if (event.type !== "checkout.session.completed") {
    return new Response("ok", { status: 200 })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const draftId = session.metadata?.draft_id
  if (!draftId) {
    console.error("checkout.session.completed sin metadata.draft_id:", session.id)
    return new Response("ok", { status: 200 })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  // Best-effort, nunca bloquea ni afecta la respuesta a Stripe — el
  // pedido ya esta creado y pagado independientemente de si Odoo
  // responde o no (mismo espiritu que odoo-sync desde el TPV, ver
  // supabase/functions/odoo-sync).
  const triggerOdooSync = async (orderId: string) => {
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/odoo-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        },
        body: JSON.stringify({ order_id: orderId }),
      })
    } catch (err) {
      console.error("No se pudo disparar odoo-sync:", err)
    }
  }

  const { data: draft, error: draftError } = await supabase
    .from("checkout_drafts")
    .select("*")
    .eq("id", draftId)
    .maybeSingle()

  if (draftError) {
    console.error("Error leyendo checkout_drafts:", draftError)
    return new Response("error", { status: 500 }) // reintentable por Stripe
  }
  if (!draft || draft.consumed_at) {
    // Draft desconocido o ya procesado (reintento de Stripe) - nada que hacer.
    return new Response("ok", { status: 200 })
  }

  const { data: orderData, error: orderError } = await supabase.rpc("create_paid_order", {
    p_customer_name: draft.customer_name,
    p_customer_email: draft.customer_email,
    p_customer_phone: draft.customer_phone,
    p_customer_address: draft.customer_address,
    p_notes: draft.notes,
    p_items: draft.items,
    p_stripe_session_id: session.id,
  })

  if (orderError) {
    const msg = orderError.message ?? ""

    if (/stripe_session_id|duplicate key/i.test(msg)) {
      // Otra entrega de este mismo evento ya creo el pedido - no es un fallo.
      await supabase.from("checkout_drafts").update({ consumed_at: new Date().toISOString() }).eq("id", draftId)
      return new Response("ok", { status: 200 })
    }

    if (/no está disponible|Solo quedan|no encontrad/i.test(msg)) {
      // Se cobro pero ya no hay stock real (venta fisica simultanea,
      // caso raro) - reembolsar automaticamente y dejar constancia en
      // orders para que el trigger de Telegram avise al vendedor.
      console.error("Conflicto de stock tras pago confirmado, reembolsando:", msg)
      try {
        if (session.payment_intent) {
          await stripe.refunds.create({ payment_intent: session.payment_intent as string })
        }
      } catch (refundErr) {
        console.error("Fallo el reembolso automático:", refundErr)
      }

      await supabase.from("orders").insert({
        customer_name: draft.customer_name,
        customer_email: draft.customer_email,
        customer_phone: draft.customer_phone,
        customer_address: draft.customer_address,
        notes: `Reembolso automático: stock insuficiente al confirmar el pago (sesión ${session.id}). ${msg}`,
        status: "cancelled",
        total: (session.amount_total ?? 0) / 100,
        payment_method: "stripe",
        payment_status: "refunded",
        stripe_session_id: session.id,
      })

      await supabase.from("checkout_drafts").update({ consumed_at: new Date().toISOString() }).eq("id", draftId)
      return new Response("ok", { status: 200 })
    }

    // Error inesperado (no de stock, no duplicado) - dejar que Stripe reintente.
    console.error("Error inesperado en create_paid_order:", msg)
    return new Response("error", { status: 500 })
  }

  await supabase.from("checkout_drafts").update({ consumed_at: new Date().toISOString() }).eq("id", draftId)

  const orderId = orderData?.[0]?.order_id
  if (orderId) await triggerOdooSync(orderId)

  return new Response("ok", { status: 200 })
})
