// Vapers Alcosa — sincroniza un pedido del TPV con Odoo (factura legal
// Verifactu). Se llama fire-and-forget desde Tpv.jsx justo despues de
// create_pos_sale() — la venta ya quedo confirmada y el stock ya se
// desconto en ese momento, esta funcion nunca bloquea ni revierte una
// venta si falla. El resultado (synced/error) queda en
// orders.odoo_sync_status, visible como badge en /admin/orders.
//
// TODO (pendiente de definir contra la instancia real de Odoo, una vez
// haya credenciales y certificado AEAT): decidir si el registro que se
// crea es un pos.order (mas correcto - pasa por el mismo circuito
// Verifactu que certifica el modulo Punto de Venta de Odoo) o un
// account.move / factura de cliente simple (mas facil de crear via API
// pero puede no pasar por el mismo camino certificado del POS). Por
// ahora este stub crea un account.move; revisar antes de depender de
// esto para facturas reales.

import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

type OdooRpcResult = { result?: unknown; error?: { message?: string; data?: { message?: string } } }

const odooCall = async (url: string, service: string, method: string, args: unknown[]) => {
  const res = await fetch(`${url.replace(/\/$/, "")}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args },
      id: crypto.randomUUID(),
    }),
  })

  const data: OdooRpcResult = await res.json()
  if (data.error) {
    throw new Error(data.error.data?.message ?? data.error.message ?? "Error desconocido de Odoo")
  }
  return data.result
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  const markError = async (orderId: string, message: string) => {
    await supabase
      .from("orders")
      .update({ odoo_sync_status: "error", odoo_sync_error: message })
      .eq("id", orderId)
  }

  // Se guarda fuera del try para que el catch pueda marcar el pedido
  // como error incluso si lo que fallo fue la llamada a Odoo, no el
  // parseo del body.
  let orderId: string | undefined

  try {
    const body = await req.json()
    orderId = body.order_id
    if (!orderId) return json({ error: "Falta order_id" }, 400)

    const odooUrl = Deno.env.get("ODOO_URL")
    const odooDb = Deno.env.get("ODOO_DB")
    const odooUser = Deno.env.get("ODOO_API_USER")
    const odooApiKey = Deno.env.get("ODOO_API_KEY")

    if (!odooUrl || !odooDb || !odooUser || !odooApiKey) {
      await markError(orderId, "Odoo no configurado todavía (faltan credenciales)")
      return json({ synced: false, error: "Odoo no configurado todavía" })
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, total, created_at, order_items(product_name, variant_label, product_price, quantity)")
      .eq("id", orderId)
      .single()

    if (orderError || !order) {
      await markError(orderId, orderError?.message ?? "Pedido no encontrado")
      return json({ synced: false, error: "Pedido no encontrado" })
    }

    const uid = await odooCall(odooUrl, "common", "login", [odooDb, odooUser, odooApiKey])
    if (!uid) throw new Error("Login de Odoo falló (credenciales inválidas)")

    const invoiceLines = (order.order_items ?? []).map((item: {
      product_name: string; variant_label: string | null; product_price: number; quantity: number
    }) => [0, 0, {
      name: item.variant_label ? `${item.product_name} — ${item.variant_label}` : item.product_name,
      quantity: item.quantity,
      price_unit: item.product_price,
    }])

    const invoiceId = await odooCall(odooUrl, "object", "execute_kw", [
      odooDb, uid, odooApiKey,
      "account.move", "create",
      [{
        move_type: "out_invoice",
        invoice_line_ids: invoiceLines,
      }],
    ])

    await supabase
      .from("orders")
      .update({ odoo_sync_status: "synced", odoo_invoice_id: String(invoiceId), odoo_sync_error: null })
      .eq("id", orderId)

    return json({ synced: true, odoo_invoice_id: invoiceId })
  } catch (err) {
    console.error("odoo-sync error:", err)
    const message = err instanceof Error ? err.message : "Error desconocido"
    if (orderId) await markError(orderId, message)
    return json({ synced: false, error: message })
  }
})
