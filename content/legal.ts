import type { Localized } from '@/lib/i18n/localize'
import { l } from './types'

/**
 * Legal pages. Standard terms and privacy policy for WebXXL services.
 * Not a substitute for attorney review.
 * Add a policy by appending an entry; it renders at /{slug} via the shared LegalPage template
 * once a route file re-exports the template (see app/[locale]/(legal)).
 */
export type LegalSection = { heading: Localized; body: Localized }

export type LegalDocument = {
  slug: string
  title: Localized
  description: Localized
  lastUpdated: string | null
  sections: LegalSection[]
}

const pending = l(
  'This section is pending legal review. Final language will be published before launch.',
  'Esta sección está pendiente de revisión legal. El texto final se publicará antes del lanzamiento.',
)

export const legalDocuments: LegalDocument[] = [
  {
    slug: 'privacy',
    title: l('Privacy Policy', 'Política de privacidad'),
    description: l('How WebXXL handles information collected through this website.', 'Cómo WebXXL maneja la información recopilada en este sitio.'),
    lastUpdated: '2026-11-02',
    sections: [
      {
        heading: l('Information we collect', 'Información que recopilamos'),
        body: l(
          'We collect information you provide through contact and quote forms: your name, email address, phone number, and business details. Clients also provide billing and account information needed to deliver services. We automatically collect basic usage data such as pages visited, browser type, and device information. If you connect a social media account to our scheduler, we store the access credentials needed to publish the content you schedule.',
          'Recopilamos la información que proporcionas en formularios de contacto y cotización: tu nombre, correo electrónico, teléfono y datos de tu negocio. Los clientes también proporcionan información de facturación y cuenta necesaria para prestar los servicios. Recopilamos automáticamente datos básicos de uso, como páginas visitadas, tipo de navegador e información del dispositivo. Si conectas una cuenta de redes sociales a nuestro programador, almacenamos las credenciales de acceso necesarias para publicar el contenido que programes.',
        ),
      },
      {
        heading: l('How we use information', 'Cómo usamos la información'),
        body: l(
          'We use your information to operate this website, respond to your inquiries, deliver and improve our services, and send service-related messages. We do not sell your personal information to anyone.',
          'Usamos tu información para operar este sitio, responder a tus consultas, prestar y mejorar nuestros servicios y enviar mensajes relacionados con el servicio. No vendemos tu información personal a nadie.',
        ),
      },
      {
        heading: l('Cookies and analytics', 'Cookies y analítica'),
        body: l(
          'We use cookies and similar technologies to keep the site working, remember your preferences, and understand how visitors use the site through analytics tools. You can control cookies in your browser settings, though some site features may not work without them.',
          'Usamos cookies y tecnologías similares para mantener el sitio en funcionamiento, recordar tus preferencias y entender cómo los visitantes usan el sitio mediante herramientas de analítica. Puedes controlar las cookies desde la configuración de tu navegador, aunque algunas funciones del sitio podrían no funcionar sin ellas.',
        ),
      },
      {
        heading: l('Your choices', 'Tus opciones'),
        body: l(
          'You may ask us to access, correct, or delete your personal information, and you may opt out of marketing messages at any time by following the unsubscribe link or contacting us through our contact page.',
          'Puedes solicitarnos acceder, corregir o eliminar tu información personal, y puedes dejar de recibir mensajes de marketing en cualquier momento siguiendo el enlace para cancelar la suscripción o contactándonos desde nuestra página de contacto.',
        ),
      },
      { heading: l('Contact', 'Contacto'), body: l('Questions about this policy can be sent through our contact page.', 'Las preguntas sobre esta política pueden enviarse desde nuestra página de contacto.') },
    ],
  },
  {
    slug: 'terms',
    title: l('Terms of Service', 'Términos del servicio'),
    description: l('Terms that apply to use of this website and WebXXL services.', 'Términos aplicables al uso de este sitio y los servicios de WebXXL.'),
    lastUpdated: '2026-11-02',
    sections: [
      {
        heading: l('Use of this website', 'Uso de este sitio'),
        body: l(
          'This website is operated by WebXXL. You may browse it for information about our services. You agree not to misuse the site, attempt to disrupt it, scrape it aggressively, or use it for any unlawful purpose. We may change or remove content on this website at any time.',
          'Este sitio web es operado por WebXXL. Puedes navegar en él para informarte sobre nuestros servicios. Aceptas no usarlo indebidamente, intentar interrumpirlo, extraer datos de forma agresiva ni utilizarlo para fines ilegales. Podemos cambiar o eliminar contenido del sitio en cualquier momento.',
        ),
      },
      {
        heading: l('Services and agreements', 'Servicios y acuerdos'),
        body: l(
          'WebXXL provides websites, CRM, hosting, domains, and a social media scheduler for local businesses. Plans are billed monthly unless you choose annual billing. Current prices are shown on our pricing page: Launch $20 per month, Plus $50 per month, and Business $90 per month, plus a one-time $79 setup fee, waived when you pay annually. Annual billing includes two months free. Every plan includes a 30-day money-back guarantee. Website ownership transfers to you after 12 paid months. To deliver our services, you agree to provide the content, access, and approvals we reasonably request.',
          'WebXXL ofrece sitios web, CRM, hosting, dominios y un programador de redes sociales para negocios locales. Los planes se facturan mensualmente, salvo que elijas la facturación anual. Los precios actuales se muestran en nuestra página de precios: Launch $20 al mes, Plus $50 al mes y Business $90 al mes, más un cargo único de $79 por configuración, exento con pago anual. La facturación anual incluye dos meses gratis. Todos los planes incluyen garantía de devolución de 30 días. La propiedad del sitio web se transfiere a ti después de 12 meses pagados. Para prestar nuestros servicios, aceptas proporcionar el contenido, acceso y aprobaciones que razonablemente solicitemos.',
        ),
      },
      {
        heading: l('Intellectual property', 'Propiedad intelectual'),
        body: l(
          'WebXXL owns its platform, templates, tools, and the software behind your website and scheduler. You own your business content: your text, images, logo, and trademarks. By providing materials to us, you grant WebXXL a license to use them only to build, host, and promote your website and services.',
          'WebXXL es propietaria de su plataforma, plantillas, herramientas y el software detrás de tu sitio web y programador. Tú eres propietario de tu contenido comercial: tus textos, imágenes, logotipo y marcas. Al proporcionarnos materiales, concedes a WebXXL una licencia para usarlos únicamente para crear, alojar y promover tu sitio web y servicios.',
        ),
      },
      {
        heading: l('Limitation of liability', 'Limitación de responsabilidad'),
        body: l(
          'Our services are provided as-is. We do not guarantee specific business results, rankings, or lead volumes. To the maximum extent permitted by law, the total liability of WebXXL for any claim related to our services is limited to the fees you paid for the service in question.',
          'Nuestros servicios se proporcionan tal cual. No garantizamos resultados comerciales, posiciones ni volúmenes de clientes potenciales específicos. En la máxima medida permitida por la ley, la responsabilidad total de WebXXL por cualquier reclamación relacionada con nuestros servicios se limita a las tarifas que pagaste por el servicio en cuestión.',
        ),
      },
    ],
  },
  {
    slug: 'accessibility',
    title: l('Accessibility', 'Accesibilidad'),
    description: l('Our approach to building an accessible website.', 'Nuestro enfoque para crear un sitio accesible.'),
    lastUpdated: null,
    sections: [
      { heading: l('Our commitment', 'Nuestro compromiso'), body: l('We design this website with semantic structure, keyboard navigation, readable contrast and support for reduced motion.', 'Diseñamos este sitio con estructura semántica, navegación por teclado, contraste legible y soporte para movimiento reducido.') },
      { heading: l('Conformance status', 'Estado de conformidad'), body: pending },
      { heading: l('Feedback', 'Comentarios'), body: l('If you encounter a barrier on this website, please let us know through our contact page.', 'Si encuentras una barrera en este sitio, avísanos desde nuestra página de contacto.') },
    ],
  },
]

export function getLegalDocument(slug: string): LegalDocument | undefined {
  return legalDocuments.find((d) => d.slug === slug)
}
