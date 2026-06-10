import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from '../components/dom/RootLayout.jsx'
import { Home } from '../pages/Home.jsx'
import { Catalog } from '../pages/Catalog.jsx'
import { Product } from '../pages/Product.jsx'
import { Cart } from '../pages/Cart.jsx'
import { Checkout } from '../pages/Checkout.jsx'
import { AdminLayout } from '../pages/admin/AdminLayout.jsx'
import { Login } from '../pages/admin/Login.jsx'
import { Dashboard } from '../pages/admin/Dashboard.jsx'
import { Products } from '../pages/admin/Products.jsx'
import { ProductEditor } from '../pages/admin/ProductEditor.jsx'
import { Orders } from '../pages/admin/Orders.jsx'
import { OrderDetail } from '../pages/admin/OrderDetail.jsx'
import { Categories } from '../pages/admin/Categories.jsx'
import { Wholesale } from '../pages/admin/Wholesale.jsx'
import { Analytics } from '../pages/admin/Analytics.jsx'
import { StockScanner } from '../pages/admin/StockScanner.jsx'

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
  { path: '/admin/login', element: <Login /> },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'products', element: <Products /> },
      { path: 'products/:id', element: <ProductEditor /> },
      { path: 'orders', element: <Orders /> },
      { path: 'orders/:id', element: <OrderDetail /> },
      { path: 'categories', element: <Categories /> },
      { path: 'wholesale', element: <Wholesale /> },
      { path: 'analytics', element: <Analytics /> },
      { path: 'stock-scanner', element: <StockScanner /> },
    ],
  },
])
