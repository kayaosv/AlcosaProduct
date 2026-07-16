import { ORDER_STATUSES, STATUS_META } from '../../../hooks/useAdminOrders.js'

// Select nativo disfrazado de pill de color (punto + flecha, sin la
// flecha nativa del navegador) - salta directo a cualquier estado en
// un solo cambio, en vez de avanzar de a un paso. Mismo patron que el
// dashboard de pedidos de Perfumito14 (app/admin/pedidos/page.tsx):
// el color no es "exito/fracaso" sino urgencia (rojo = requiere accion
// ya, ambar = en preparacion, celeste = listo y esperando, verde =
// ciclo completo, gris = fuera de flujo).
export const OrderStatusSelect = ({ status, disabled, onChange, size = 'md' }) => {
  const meta = STATUS_META[status] ?? { label: status, color: '#666' }
  return (
    <div
      className={`order-status-select ${size === 'sm' ? 'order-status-select--sm' : ''}`}
      style={{ '--status-color': meta.color }}
    >
      <span className="order-status-select-dot" />
      <select
        value={status}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="order-status-select-input"
      >
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>{STATUS_META[s].label}</option>
        ))}
      </select>
      <span className="order-status-select-chevron">▾</span>
    </div>
  )
}
