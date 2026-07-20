import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth.js'
import { usePendingOrdersCount } from '../../../hooks/useAdminOrders.js'

const IconGrid = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
  </svg>
)
const IconBox = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
)
const IconTag = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
)
const IconTruck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="1" y="3" width="15" height="13" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
)
const IconCart = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
)
const IconChart = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
  </svg>
)
const IconBarcode = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 5v14M7 5v14M11 5v14M15 5v9M19 5v14M15 17v2" strokeLinecap="round" />
    <rect x="13" y="14" width="6" height="5" rx="1" />
  </svg>
)
const IconPOS = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="4" width="20" height="14" rx="2" />
    <line x1="2" y1="9" x2="22" y2="9" />
    <line x1="6" y1="13" x2="10" y2="13" />
    <line x1="6" y1="16" x2="8" y2="16" />
  </svg>
)
const IconExternalLink = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
  </svg>
)
const IconLogout = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: IconGrid, exact: true },
  { to: '/admin/tpv', label: 'TPV', icon: IconPOS },
  { to: '/admin/products', label: 'Productos', icon: IconBox },
  { to: '/admin/stock-scanner', label: 'Escáner stock', icon: IconBarcode },
  { to: '/admin/orders', label: 'Pedidos', icon: IconCart },
  { to: '/admin/categories', label: 'Categorías', icon: IconTag },
  { to: '/admin/wholesale', label: 'Mayorista', icon: IconTruck },
  { to: '/admin/analytics', label: 'Analytics', icon: IconChart },
]

export const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const pendingOrders = usePendingOrdersCount()

  const handleLogout = async () => {
    await signOut()
    navigate('/admin/login', { replace: true })
  }

  return (
    <aside className={`admin-sidebar ${isOpen ? 'admin-sidebar--open' : ''}`}>
      <div className="sidebar-logo">
        <div className="logo-mark">VA</div>
        <div className="logo-text">
          <span className="logo-title">Vapers Alcosa</span>
          <span className="logo-sub">Panel de gestión</span>
        </div>
        <button className="sidebar-close-btn" onClick={onClose} aria-label="Cerrar menú">✕</button>
      </div>

      <nav className="sidebar-nav">
        <span className="nav-group-label">General</span>
        {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => {
          const showBadge = to === '/admin/orders' && pendingOrders > 0
          return (
            <NavLink
              key={to}
              to={to}
              end={exact}
              onClick={onClose}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
            >
              <Icon />
              <span>{label}</span>
              {showBadge && <span className="nav-item-badge">{pendingOrders}</span>}
            </NavLink>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-store-link">
          <a href="/" target="_blank" rel="noreferrer">
            <IconExternalLink />
            <span>Ver tienda</span>
          </a>
        </div>
        {user && (
          <button type="button" onClick={handleLogout} className="sidebar-logout">
            <IconLogout />
            <span>Cerrar sesión</span>
          </button>
        )}
        <p className="sidebar-version">{user?.email ?? 'v0.1.0'}</p>
      </div>
    </aside>
  )
}
