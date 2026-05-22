import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from '../components/dom/RootLayout.jsx'
import { Home } from '../pages/Home.jsx'
import { Catalog } from '../pages/Catalog.jsx'
import { Product } from '../pages/Product.jsx'
import { Cart } from '../pages/Cart.jsx'
import { Checkout } from '../pages/Checkout.jsx'
import { AdminLayout } from '../pages/admin/AdminLayout.jsx'
import { Dashboard } from '../pages/admin/Dashboard.jsx'
import { Products } from '../pages/admin/Products.jsx'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'catalog', element: <Catalog /> },
      { path: 'product/:id', element: <Product /> },
      { path: 'cart', element: <Cart /> },
      { path: 'checkout', element: <Checkout /> },
    ],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'products', element: <Products /> },
    ],
  },
])
