import { Hero } from '../components/dom/Hero.jsx'
import { Marquee } from '../components/dom/Marquee.jsx'
import { ProductsOverview } from '../components/dom/sections/ProductsOverview.jsx'
import { OxvaSection } from '../components/dom/sections/OxvaSection.jsx'
import { BestSellersSection } from '../components/dom/sections/BestSellersSection.jsx'
import { AboutSection } from '../components/dom/sections/AboutSection.jsx'
import { Footer } from '../components/dom/Footer.jsx'
import { useSeo } from '../hooks/useSeo.js'

export const Home = () => {
  useSeo({
    description: 'Tienda de vapeo en el Parque Alcosa (Sevilla). Negocio familiar — sales de nicotina, longfill, vapers, desechables y resistencias. Recogida en tienda o pago online por transferencia/Bizum.',
  })

  return (
    <main className="relative w-full overflow-x-hidden" style={{ background: 'var(--color-cream)' }}>
      <Hero />
      <ProductsOverview />
      <Marquee angle={-4} color="lime" />
      <OxvaSection />
      <BestSellersSection />
      <AboutSection />
      <Footer />
    </main>
  )
}
