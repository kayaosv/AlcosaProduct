import { Outlet } from 'react-router-dom'
import { Sidebar } from '../../components/dom/admin/Sidebar.jsx'
import { ProtectedRoute } from './ProtectedRoute.jsx'
import '../../styles/admin.css'

export const AdminLayout = () => (
  <ProtectedRoute>
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  </ProtectedRoute>
)
