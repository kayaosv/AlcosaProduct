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

export const Privacidad = () => (
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
          POLÍTICA DE PRIVACIDAD.
        </h1>

        <Section title="01 · Responsable del tratamiento">
          <p>
            <strong>Vapers Alcosa</strong>, con domicilio en Avd. de Ildefonso Marañón Lavín,
            Nº 9, Local 2, 41019 Sevilla, NIF 30269335R, es la responsable del tratamiento de los
            datos personales que nos facilitas a través de este sitio web.
          </p>
        </Section>

        <Section title="02 · Qué datos tratamos y para qué">
          <p>
            Cuando completas el formulario de pedido en el checkout, tratamos tu nombre,
            teléfono, email y, opcionalmente, tu usuario de Instagram y notas del pedido. Estos
            datos se usan exclusivamente para:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Gestionar y tramitar tu reserva de pedido.</li>
            <li>Contactarte (por teléfono o Instagram) para confirmar disponibilidad y avisarte cuando el pedido esté listo para recoger en tienda.</li>
          </ul>
          <p>No utilizamos tus datos con fines de marketing salvo que lo hayas consentido expresamente por otra vía.</p>
        </Section>

        <Section title="03 · Base legal">
          <p>
            El tratamiento se basa en la ejecución de una relación precontractual/contractual
            (art. 6.1.b RGPD): nos facilitas tus datos para poder gestionar el pedido que nos
            solicitas.
          </p>
        </Section>

        <Section title="04 · Destinatarios y encargados de tratamiento">
          <p>
            No cedemos tus datos a terceros con fines comerciales. Tus datos se almacenan en la
            infraestructura de nuestros proveedores tecnológicos de alojamiento web y base de
            datos, que actúan como encargados de tratamiento conforme al art. 28 RGPD bajo
            contrato con nosotros. [COMPLETAR: confirmar si estos proveedores implican una
            transferencia internacional de datos fuera del Espacio Económico Europeo y, en tal
            caso, las garantías aplicadas].
          </p>
        </Section>

        <Section title="05 · Plazo de conservación">
          <p>
            Conservamos tus datos mientras dure la gestión de tu pedido y, posteriormente,
            durante los plazos legalmente exigibles para atender posibles responsabilidades
            (fiscales, de consumo, etc.).
          </p>
        </Section>

        <Section title="06 · Tus derechos">
          <p>
            Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición,
            limitación y portabilidad escribiendo a [COMPLETAR: email] o llamando al 682 72 57
            80. También tienes derecho a presentar una reclamación ante la Agencia Española de
            Protección de Datos (
            <a
              href="https://www.aepd.es"
              target="_blank"
              rel="noopener noreferrer"
              data-cursor="link"
              className="underline underline-offset-4"
            >
              www.aepd.es
            </a>
            ) si consideras que el tratamiento no se ajusta a la normativa.
          </p>
        </Section>

        <Section title="07 · Menores de edad">
          <p>
            Por la naturaleza de los productos que comercializamos (vapeo/nicotina), este sitio
            no está dirigido a menores de edad y no recogemos conscientemente datos de menores.
          </p>
        </Section>

        <Section title="08 · Seguridad">
          <p>
            Tus datos de pedido solo son accesibles desde nuestro panel de administración,
            protegido por control de acceso a nivel de base de datos: ningún visitante puede
            consultar pedidos ajenos.
          </p>
        </Section>

        <p className="mt-10 text-[12px]" style={{ color: 'rgba(23,45,109,0.5)' }}>
          Véase también nuestro{' '}
          <Link to="/aviso-legal" data-cursor="link" className="underline underline-offset-4">
            Aviso Legal
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
