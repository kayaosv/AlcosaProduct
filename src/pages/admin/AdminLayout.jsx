import { Outlet, Link } from 'react-router-dom'

export const AdminLayout = () => (
  <div className="min-h-screen flex">
    <aside className="w-64 bg-dark text-cream p-6">
      <h2 className="text-lg mb-6">Admin</h2>
      <nav className="flex flex-col gap-2">
        <Link to="/admin">Dashboard</Link>
        <Link to="/admin/products">Productos</Link>
      </nav>
    </aside>
    <main className="flex-1 p-8">
      <Outlet />
    </main>
  </div>
)
