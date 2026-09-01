import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from '../components/dom/RootLayout.jsx'
import { Home } from '../pages/Home.jsx'

// Code-splitting via las rutas: solo Home/RootLayout se cargan de
// entrada (lo minimo para pintar la tienda pública). El resto de
// paginas publicas (Checkout, legales, etc.) y TODO el panel admin
// (layout incluido: Sidebar, ProtectedRoute, admin.css, Dashboard,
// editor de productos, TPV, analytics...) se descargan solo cuando se
// navega a ellas - antes AdminLayout en sí se importaba de forma
// estatica (aunque sus hijas ya eran lazy), asi que un cliente que solo
// visita la home descargaba igual el layout+CSS del panel admin sin
// usarlo nunca.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      {
        path: 'catalog',
        lazy: () => import('../pages/Catalog.jsx').then((m) => ({ Component: m.Catalog })),
      },
      {
        path: 'product/:id',
        lazy: () => import('../pages/Product.jsx').then((m) => ({ Component: m.Product })),
      },
      {
        path: 'cart',
        lazy: () => import('../pages/Cart.jsx').then((m) => ({ Component: m.Cart })),
      },
      {
        path: 'checkout',
        lazy: () => import('../pages/Checkout.jsx').then((m) => ({ Component: m.Checkout })),
      },
      {
        path: 'checkout/success',
        lazy: () => import('../pages/CheckoutSuccess.jsx').then((m) => ({ Component: m.CheckoutSuccess })),
      },
      {
        path: 'aviso-legal',
        lazy: () => import('../pages/AvisoLegal.jsx').then((m) => ({ Component: m.AvisoLegal })),
      },
      {
        path: 'privacidad',
        lazy: () => import('../pages/Privacidad.jsx').then((m) => ({ Component: m.Privacidad })),
      },
      {
        path: 'cookies',
        lazy: () => import('../pages/Cookies.jsx').then((m) => ({ Component: m.Cookies })),
      },
    ],
  },
  {
    path: '/admin/login',
    lazy: () => import('../pages/admin/Login.jsx').then((m) => ({ Component: m.Login })),
  },
  {
    path: '/admin',
    lazy: () => import('../pages/admin/AdminLayout.jsx').then((m) => ({ Component: m.AdminLayout })),
    children: [
      {
        index: true,
        lazy: () => import('../pages/admin/Dashboard.jsx').then((m) => ({ Component: m.Dashboard })),
      },
      {
        path: 'tpv',
        lazy: () => import('../pages/admin/Tpv.jsx').then((m) => ({ Component: m.Tpv })),
      },
      {
        path: 'products',
        lazy: () => import('../pages/admin/Products.jsx').then((m) => ({ Component: m.Products })),
      },
      {
        path: 'products/:id',
        lazy: () => import('../pages/admin/ProductEditor.jsx').then((m) => ({ Component: m.ProductEditor })),
      },
      {
        path: 'products/:id/label',
        lazy: () => import('../pages/admin/ProductLabel.jsx').then((m) => ({ Component: m.ProductLabel })),
      },
      {
        path: 'orders',
        lazy: () => import('../pages/admin/Orders.jsx').then((m) => ({ Component: m.Orders })),
      },
      {
        path: 'orders/:id',
        lazy: () => import('../pages/admin/OrderDetail.jsx').then((m) => ({ Component: m.OrderDetail })),
      },
      {
        path: 'categories',
        lazy: () => import('../pages/admin/Categories.jsx').then((m) => ({ Component: m.Categories })),
      },
      {
        path: 'wholesale',
        lazy: () => import('../pages/admin/Wholesale.jsx').then((m) => ({ Component: m.Wholesale })),
      },
      {
        path: 'analytics',
        lazy: () => import('../pages/admin/Analytics.jsx').then((m) => ({ Component: m.Analytics })),
      },
      {
        path: 'reports',
        lazy: () => import('../pages/admin/Reports.jsx').then((m) => ({ Component: m.Reports })),
      },
      {
        path: 'stock-scanner',
        lazy: () => import('../pages/admin/StockScanner.jsx').then((m) => ({ Component: m.StockScanner })),
      },
      {
        path: 'settings',
        lazy: () => import('../pages/admin/Settings.jsx').then((m) => ({ Component: m.Settings })),
      },
    ],
  },
])
