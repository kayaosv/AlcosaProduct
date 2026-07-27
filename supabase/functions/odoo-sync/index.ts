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
//
// action: 'credit_note' (2026-07-27, probado y corregido contra la
// instancia real) — Verifactu prohibe modificar o borrar una factura
// ya PUBLICADA/posted (la cadena de hash exige que quede intacta). Si
// un pedido que ya tenia factura sincronizada se cancela, hay dos
// casos segun el estado real de esa factura en Odoo:
//   - draft (el estado normal hoy, mientras Verifactu/AEAT no esten
//     activados - odoo-sync nunca las postea): nunca paso por la
//     cadena de hash, asi que se puede borrar directamente sin
//     problema, no hace falta nota de credito.
//   - posted (una vez el cliente active Verifactu de verdad): aqui si
//     aplica la regla estricta - se crea una nota de credito enlazada
//     via el wizard nativo de Odoo (account.move.reversal), nunca se
//     toca la original. Mismo mecanismo que el boton "Añadir nota de
//     credito" de la UI de Odoo - requiere pasar active_model/
//     active_ids por CONTEXTO en la llamada RPC (asi es como el wizard
//     sabe que factura revertir; pasarlo como valor normal de campo se
//     ignora en silencio).
// Se dispara desde updateOrderStatus() en useAdminOrders.js justo
// despues de que cancel_order() reponga el stock — mismo patron
// fire-and-forget que la sincronizacion al crear.

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

  const markInvoiceError = async (orderId: string, message: string) => {
    await supabase
      .from("orders")
      .update({ odoo_sync_status: "error", odoo_sync_error: message })
      .eq("id", orderId)
  }

  const markCreditNoteError = async (orderId: string, message: string) => {
    await supabase
      .from("orders")
      .update({ odoo_credit_note_status: "error", odoo_credit_note_error: message })
      .eq("id", orderId)
  }

  // Se guardan fuera del try para que el catch pueda marcar el error
  // correcto incluso si lo que fallo fue la llamada a Odoo, no el
  // parseo del body.
  let orderId: string | undefined
  let action: "invoice" | "credit_note" = "invoice"

  try {
    const body = await req.json()
    orderId = body.order_id
    action = body.action === "credit_note" ? "credit_note" : "invoice"
    if (!orderId) return json({ error: "Falta order_id" }, 400)

    const odooUrl = Deno.env.get("ODOO_URL")
    const odooDb = Deno.env.get("ODOO_DB")
    const odooUser = Deno.env.get("ODOO_API_USER")
    const odooApiKey = Deno.env.get("ODOO_API_KEY")

    if (!odooUrl || !odooDb || !odooUser || !odooApiKey) {
      const message = "Odoo no configurado todavía (faltan credenciales)"
      if (action === "credit_note") await markCreditNoteError(orderId, message)
      else await markInvoiceError(orderId, message)
      return json({ synced: false, error: message })
    }

    const uid = await odooCall(odooUrl, "common", "login", [odooDb, odooUser, odooApiKey])
    if (!uid) throw new Error("Login de Odoo falló (credenciales inválidas)")

    if (action === "credit_note") {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("id, odoo_invoice_id, odoo_sync_status")
        .eq("id", orderId)
        .single()

      if (orderError || !order) {
        throw new Error(orderError?.message ?? "Pedido no encontrado")
      }

      // No habia factura real que revertir (se cancelo antes de
      // facturar, o Odoo no estaba configurado en ese momento) - no es
      // un error, simplemente no hay nada que hacer del lado de Odoo.
      if (order.odoo_sync_status !== "synced" || !order.odoo_invoice_id) {
        await supabase
          .from("orders")
          .update({ odoo_credit_note_status: "not_required" })
          .eq("id", orderId)
        return json({ synced: true, skipped: true })
      }

      const [originalMove] = await odooCall(odooUrl, "object", "execute_kw", [
        odooDb, uid, odooApiKey,
        "account.move", "read",
        [[Number(order.odoo_invoice_id)], ["journal_id", "company_id", "state"]],
      ]) as [{ journal_id: [number, string] | false; company_id: [number, string] | false; state: string }]

      // Mientras Veri*Factu/AEAT no esten activados, odoo-sync crea las
      // facturas en borrador (draft) a proposito - sin certificado no
      // hay nada que "postear" de verdad. Un asiento en draft NUNCA
      // paso por la cadena Verifactu (no se hasheo ni se declaro), asi
      // que borrarlo directamente es perfectamente legal - la regla de
      // "solo nota de credito, nunca editar/borrar" es especificamente
      // sobre asientos ya PUBLICADOS (posted). Odoo mismo lo confirma:
      // intentar revertir un draft falla con "primero debe publicarlo"
      // (probado contra la instancia real 2026-07-27). Una vez el
      // cliente active de verdad Verifactu (facturas quedan posted),
      // este camino deja de aplicar y siempre entra por el de abajo.
      if (originalMove?.state === "draft") {
        await odooCall(odooUrl, "object", "execute_kw", [
          odooDb, uid, odooApiKey,
          "account.move", "unlink", [[Number(order.odoo_invoice_id)]],
        ])
        await supabase
          .from("orders")
          .update({
            odoo_sync_status: "pending",
            odoo_invoice_id: null,
            odoo_credit_note_status: "not_required",
            odoo_credit_note_error: null,
          })
          .eq("id", orderId)
        return json({ synced: true, draft_invoice_deleted: true })
      }

      // A partir de aca, la factura ya esta publicada (posted) - aqui
      // si aplica la regla de Verifactu de no tocarla nunca, solo
      // reflejar la cancelacion con una nota de credito enlazada.
      const journalId = originalMove?.journal_id ? originalMove.journal_id[0] : false
      const companyId = originalMove?.company_id ? originalMove.company_id[0] : false

      // El wizard de reversion exige journal_id Y company_id explicitos,
      // y ademas requiere el contexto active_model/active_ids (asi es
      // como Odoo sabe que factura debe revertir - pasarla como valor
      // normal del campo move_ids no funciona, la ignora en silencio;
      // confirmado contra la instancia real 2026-07-27). Mismo mecanismo
      // que el boton "Añadir nota de credito" de la UI de Odoo.
      const reversalContext = { context: { active_model: "account.move", active_ids: [Number(order.odoo_invoice_id)] } }
      const reversalWizardId = await odooCall(odooUrl, "object", "execute_kw", [
        odooDb, uid, odooApiKey,
        "account.move.reversal", "create",
        [{
          reason: "Pedido cancelado en Vapers Alcosa",
          journal_id: journalId,
          company_id: companyId,
        }],
        reversalContext,
      ])

      await odooCall(odooUrl, "object", "execute_kw", [
        odooDb, uid, odooApiKey,
        "account.move.reversal", "reverse_moves", [[reversalWizardId]],
        reversalContext,
      ])

      // El propio wizard guarda los asientos que acaba de crear en
      // `new_move_ids` - mas fiable que interpretar el valor de retorno
      // de reverse_moves() (una accion de UI cuya forma exacta varia).
      const [wizardAfter] = await odooCall(odooUrl, "object", "execute_kw", [
        odooDb, uid, odooApiKey,
        "account.move.reversal", "read",
        [[reversalWizardId], ["new_move_ids"]],
      ]) as [{ new_move_ids: number[] }]
      const creditNoteId = wizardAfter?.new_move_ids?.[0]
      if (creditNoteId == null) {
        throw new Error("La reversión se ejecutó pero no se encontró el asiento de la nota de crédito")
      }

      await supabase
        .from("orders")
        .update({
          odoo_credit_note_status: "synced",
          odoo_credit_note_id: String(creditNoteId),
          odoo_credit_note_error: null,
        })
        .eq("id", orderId)

      return json({ synced: true, odoo_credit_note_id: creditNoteId })
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, total, created_at, order_items(product_name, variant_label, product_price, quantity)")
      .eq("id", orderId)
      .single()

    if (orderError || !order) {
      await markInvoiceError(orderId, orderError?.message ?? "Pedido no encontrado")
      return json({ synced: false, error: "Pedido no encontrado" })
    }

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
    if (orderId) {
      if (action === "credit_note") await markCreditNoteError(orderId, message)
      else await markInvoiceError(orderId, message)
    }
    return json({ synced: false, error: message })
  }
})
