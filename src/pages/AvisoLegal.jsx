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

export const AvisoLegal = () => (
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
          AVISO LEGAL.
        </h1>

        <Section title="01 · Datos identificativos">
          <p>
            En cumplimiento del artículo 10 de la Ley 34/2002, de Servicios de la Sociedad de la
            Información y de Comercio Electrónico (LSSI-CE), se informa de los siguientes datos:
          </p>
          <p>
            <strong>Titular:</strong> Vapers Alcosa
            <br />
            <strong>NIF:</strong> 30269335R
            <br />
            <strong>Domicilio:</strong> Avd. de Ildefonso Marañón Lavín, Nº 9, Local 2, 41019
            Sevilla
            <br />
            <strong>Contacto:</strong> 682 72 57 80 · vapersalcosa019@gmail.com ·{' '}
            <a
              href="https://instagram.com/vapers.alcosa"
              target="_blank"
              rel="noopener noreferrer"
              data-cursor="link"
              className="underline underline-offset-4"
              style={{ color: 'var(--color-blue)' }}
            >
              @vapers.alcosa
            </a>
          </p>
        </Section>

        <Section title="02 · Objeto y actividad">
          <p>
            A través de este sitio web, Vapers Alcosa ofrece información sobre su catálogo de
            productos de vapeo, y permite tanto reservar un pedido para pagarlo y recogerlo en la
            tienda física como pagarlo online por adelantado (a través de Stripe) para su
            recogida posterior en la tienda física.
          </p>
          <p>
            El envío a domicilio no se gestiona de forma automatizada a través de este sitio web;
            cuando el cliente lo solicita tras su compra, se coordina de forma manual y se
            realiza a través de Correos o empresas de mensajería profesionales, que verifican la
            mayoría de edad del destinatario en el momento de la entrega.
          </p>
          <p>
            La venta de estos productos está restringida exclusivamente a personas mayores de
            edad, conforme a la normativa española aplicable a productos de vapeo (Ley 3/2014 y
            Real Decreto 579/2017).
          </p>
        </Section>

        <Section title="03 · Propiedad intelectual">
          <p>
            Los contenidos de este sitio web (textos, imágenes, diseño, marcas y logotipos) son
            titularidad de Vapers Alcosa o de terceros que han autorizado su uso, y están
            protegidos por la normativa de propiedad intelectual e industrial. Queda prohibida su
            reproducción total o parcial sin autorización expresa.
          </p>
        </Section>

        <Section title="04 · Legislación aplicable">
          <p>
            Las presentes condiciones se rigen por la legislación española. Para cualquier
            controversia derivada del acceso o uso de este sitio, las partes se someten a los
            juzgados y tribunales competentes conforme a la ley, sin perjuicio de los derechos
            que asistan a los consumidores según su domicilio.
          </p>
        </Section>

        <p className="mt-10 text-[12px]" style={{ color: 'rgba(23,45,109,0.5)' }}>
          Véase también nuestra{' '}
          <Link to="/privacidad" data-cursor="link" className="underline underline-offset-4">
            Política de Privacidad
          </Link>{' '}
          y{' '}
          <Link to="/cookies" data-cursor="link" className="underline underline-offset-4">
            Política de Cookies
          </Link>
          .
        </p>
      </div>
    </main>
    <Footer />
  </>
)
