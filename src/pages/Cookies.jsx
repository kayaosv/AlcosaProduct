import { Link } from 'react-router-dom'
import { Footer } from '../components/dom/Footer.jsx'

const Section = ({ title, children }) => (
  <div className="mt-10">
    <h2
      className="text-[11px] tracking-[0.25em] uppercase mb-4"
      style={{ color: 'var(--color-navy)', fontWeight: 700 }}
    >
      {title}
    </h2>
    <div className="text-[15px] leading-relaxed space-y-3" style={{ color: 'rgba(23,45,109,0.8)' }}>
      {children}
    </div>
  </div>
)

export const Cookies = () => (
  <>
    <main className="min-h-screen pt-32 pb-24 px-6 md:px-10" style={{ background: 'var(--color-cream)' }}>
      <div className="max-w-2xl">
        <span
          className="text-[11px] tracking-[0.25em] uppercase"
          style={{ color: 'var(--color-blue)' }}
        >
          Legal
        </span>
        <h1
          className="mt-4 leading-[0.9]"
          style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 900,
            color: 'var(--color-navy)',
            letterSpacing: '-0.04em',
          }}
        >
          POLÍTICA DE COOKIES.
        </h1>

        <Section title="01 · Qué usamos hoy">
          <p>
            Esta web no utiliza cookies de analítica, publicidad ni redes sociales. El único
            almacenamiento que usamos en tu navegador es una entrada técnica (
            <code className="text-[13px]" style={{ color: 'var(--color-navy)' }}>vapers-cart</code>
            ) guardada mediante <em>localStorage</em>, que recuerda los productos de tu carrito
            mientras navegas por el catálogo.
          </p>
          <p>
            Este almacenamiento es estrictamente necesario para el funcionamiento de la tienda
            (no podríamos ofrecerte un carrito de compra sin él) y está exento del deber de
            solicitar tu consentimiento, conforme al artículo 22.2 de la LSSI-CE. No identifica
            quién eres ni se comparte con nadie: solo vive en tu propio dispositivo.
          </p>
        </Section>

        <Section title="02 · Qué no usamos">
          <p>
            No instalamos Google Analytics, Meta/Facebook Pixel, ni ninguna cookie de
            seguimiento o publicitaria. Por eso este sitio no muestra un banner de consentimiento
            de cookies: no es necesario cuando no se usan cookies no esenciales.
          </p>
        </Section>

        <Section title="03 · Si esto cambia">
          <p>
            Si en el futuro incorporamos herramientas de analítica o publicidad, actualizaremos
            esta política para detallarlas y, antes de activarlas, te pediremos tu consentimiento
            expreso mediante un panel de configuración.
          </p>
        </Section>

        <Section title="04 · Cómo puedes borrarlo">
          <p>
            Puedes eliminar el contenido de tu carrito guardado en cualquier momento borrando los
            datos de navegación de este sitio desde los ajustes de tu navegador, o vaciando el
            carrito directamente desde la web.
          </p>
        </Section>

        <p className="mt-10 text-[12px]" style={{ color: 'rgba(23,45,109,0.5)' }}>
          Véase también nuestro{' '}
          <Link to="/aviso-legal" data-cursor="link" className="underline underline-offset-4">
            Aviso Legal
          </Link>{' '}
          y{' '}
          <Link to="/privacidad" data-cursor="link" className="underline underline-offset-4">
            Política de Privacidad
          </Link>
          .
        </p>
      </div>
    </main>
    <Footer />
  </>
)
