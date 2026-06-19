import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '../../components/dom/admin/Sidebar.jsx'
import { ProtectedRoute } from './ProtectedRoute.jsx'
import '../../styles/admin.css'

export const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <ProtectedRoute>
      <div className="admin-layout">
        {sidebarOpen && (
          <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
        )}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="admin-main">
          <button
            className="sidebar-hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            <span /><span /><span />
          </button>
          <Outlet />
        </main>
      </div>
    </ProtectedRoute>
  )
}
