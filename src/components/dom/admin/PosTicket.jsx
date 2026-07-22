// Ticket imprimible de una venta del TPV — via window.print() a 80mm
// (impresora térmica POS80 Unika, configurada como impresora estándar
// del sistema en el equipo del mostrador). No es una factura legal:
// eso lo emite Odoo (ver supabase/functions/odoo-sync) una vez esté
// activado — esto es el comprobante interno/de cortesía para el
// cliente en el momento de la venta.

const PAYMENT_LABEL = { efectivo: 'Efectivo', tarjeta: 'Tarjeta' }

const formatDateTime = (d) =>
  d.toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

export const PosTicket = ({ sale, onNewSale }) => {
  const shortId = sale.orderId.slice(0, 8).toUpperCase()

  return (
    <div className="tpv-ticket-wrap">
      <div className="tpv-ticket-actions">
        <button className="btn-primary" onClick={() => window.print()}>Imprimir ticket</button>
        <button className="btn-ghost" onClick={onNewSale}>Nueva venta</button>
      </div>

      <div className="tpv-ticket">
        <p className="tpv-ticket-business">Vapers Alcosa</p>
        <p className="tpv-ticket-meta">NIF 30269335R</p>
        <p className="tpv-ticket-meta">Avd. de Ildefonso Marañón Lavín, Nº 9, Local 2</p>
        <p className="tpv-ticket-meta">41019 Sevilla</p>

        <div className="tpv-ticket-divider" />

        <p className="tpv-ticket-meta">Pedido #{shortId}</p>
        <p className="tpv-ticket-meta">{formatDateTime(sale.createdAt)}</p>

        <div className="tpv-ticket-divider" />

        {sale.items.map((l) => (
          <div key={l.key} className="tpv-ticket-line">
            <div className="tpv-ticket-line-top">
              <span>{l.quantity} × {l.name}{l.variantLabel ? ` — ${l.variantLabel}` : ''}</span>
              <span>{(l.unitPrice * l.quantity).toFixed(2)} €</span>
            </div>
          </div>
        ))}

        <div className="tpv-ticket-divider" />

        <div className="tpv-ticket-total">
          <span>TOTAL</span>
          <span>{Number(sale.total).toFixed(2)} €</span>
        </div>
        <p className="tpv-ticket-meta">Pago: {PAYMENT_LABEL[sale.paymentType] ?? sale.paymentType}</p>

        <div className="tpv-ticket-divider" />
        <p className="tpv-ticket-footer">Gracias por tu compra</p>
        <p className="tpv-ticket-footer tpv-ticket-footer--small">
          Este comprobante no es una factura oficial.
        </p>
      </div>
    </div>
  )
}
