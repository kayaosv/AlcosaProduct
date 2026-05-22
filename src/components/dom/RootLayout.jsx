import { Outlet } from 'react-router-dom'
import { Nav } from './Nav.jsx'
import { CustomCursor } from './CustomCursor.jsx'
import { CartDrawer } from './CartDrawer.jsx'

export const RootLayout = () => (
  <>
    <CustomCursor />
    <Nav />
    <Outlet />
    <CartDrawer />
  </>
)
