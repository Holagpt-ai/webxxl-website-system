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
    lastUpdated: '2026-11-17',
    sections: [
      {
        heading: l('Information we collect', 'Información que recopilamos'),
        body: l(
          'We collect information you provide through contact and quote forms: your name, email address, phone number, and business details. Clients also provide billing and account information needed to deliver services, including payment details processed by our payment provider. We automatically collect basic usage data such as pages visited, browser type, device information, and approximate location derived from your IP address. If you connect a social media account to our scheduler, we access the account information described in the "TikTok and connected social accounts" section below.',
          'Recopilamos la información que proporcionas en formularios de contacto y cotización: tu nombre, correo electrónico, teléfono y datos de tu negocio. Los clientes también proporcionan información de facturación y cuenta necesaria para prestar los servicios, incluidos los datos de pago procesados por nuestro proveedor de pagos. Recopilamos automáticamente datos básicos de uso, como páginas visitadas, tipo de navegador, información del dispositivo y ubicación aproximada derivada de tu dirección IP. Si conectas una cuenta de redes sociales a nuestro programador, accedemos a la información de la cuenta descrita en la sección "TikTok y cuentas sociales conectadas" a continuación.',
        ),
      },
      {
        heading: l('TikTok and connected social accounts', 'TikTok y cuentas sociales conectadas'),
        body: l(
          'When you connect a social media account to our scheduler, we access only the information you authorize through that platform. For TikTok, we use Login Kit and the Content Posting API, with your permission, to access: your account identifier, display name, and avatar; your follower, like, and video counts; your public video list and their view, like, comment, and share counts; and the videos and captions you choose to publish. We use this information only to identify the connected account, show your statistics, and upload and publish the content you approve, using the privacy settings you select. We never publish to your account without your approval. We store the access tokens TikTok issues, encrypted, only while the account stays connected. We do not sell TikTok data, use it for advertising, or share it with third parties, except with TikTok itself to perform the publishing you requested, or when required by law. You can disconnect your TikTok account at any time in the scheduler, or revoke our access in TikTok under Settings and privacy, then Security, then Manage app permissions. When you disconnect or revoke access, we delete the stored tokens and TikTok account data within 30 days. Content already published on TikTok remains there unless you delete it in TikTok.',
          'Cuando conectas una cuenta de redes sociales a nuestro programador, accedemos únicamente a la información que autorizas a través de esa plataforma. Para TikTok, usamos Login Kit y la Content Posting API, con tu permiso, para acceder a: tu identificador de cuenta, nombre visible y avatar; tus conteos de seguidores, me gusta y videos; tu lista pública de videos y sus conteos de vistas, me gusta, comentarios y compartidos; y los videos y subtítulos que elijas publicar. Usamos esta información solo para identificar la cuenta conectada, mostrar tus estadísticas y subir y publicar el contenido que apruebes, con la configuración de privacidad que elijas. Nunca publicamos en tu cuenta sin tu aprobación. Almacenamos los tokens de acceso que emite TikTok, cifrados, solo mientras la cuenta permanezca conectada. No vendemos los datos de TikTok, no los usamos para publicidad ni los compartimos con terceros, excepto con TikTok para realizar la publicación que solicitaste, o cuando lo exige la ley. Puedes desconectar tu cuenta de TikTok en cualquier momento desde el programador, o revocar nuestro acceso en TikTok en Configuración y privacidad, luego Seguridad, luego Administrar permisos de aplicaciones. Cuando desconectas o revocas el acceso, eliminamos los tokens almacenados y los datos de tu cuenta de TikTok dentro de 30 días. El contenido ya publicado en TikTok permanece allí a menos que lo elimines en TikTok.',
        ),
      },
      {
        heading: l('How we use information', 'Cómo usamos la información'),
        body: l(
          'We use your information to operate this website, respond to your inquiries, deliver and improve our services, process payments, send service-related messages, and prevent misuse of our services. We do not sell your personal information to anyone, and we do not use connected social media data for advertising.',
          'Usamos tu información para operar este sitio, responder a tus consultas, prestar y mejorar nuestros servicios, procesar pagos, enviar mensajes relacionados con el servicio y prevenir el uso indebido de nuestros servicios. No vendemos tu información personal a nadie, y no usamos los datos de redes sociales conectadas para publicidad.',
        ),
      },
      {
        heading: l('How we share information', 'Cómo compartimos la información'),
        body: l(
          'We share your information only as needed to run our services: with the providers that host our website and scheduler, with the payment provider that processes your billing, and with the social media platforms you connect, solely to publish the content you approve. We do not sell your personal information. We may disclose information if required by law or to protect our rights, your safety, or the safety of others.',
          'Compartimos tu información solo cuando es necesario para operar nuestros servicios: con los proveedores que alojan nuestro sitio web y programador, con el proveedor de pagos que procesa tu facturación, y con las plataformas de redes sociales que conectes, únicamente para publicar el contenido que apruebes. No vendemos tu información personal. Podemos divulgar información si lo exige la ley o para proteger nuestros derechos, tu seguridad o la seguridad de otros.',
        ),
      },
      {
        heading: l('Data security', 'Seguridad de los datos'),
        body: l(
          'We protect your information with encryption in transit and at rest, access controls that limit who can reach it, and secure storage for the access tokens that connect your social accounts. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.',
          'Protegemos tu información con cifrado en tránsito y en reposo, controles de acceso que limitan quién puede acceder a ella, y almacenamiento seguro para los tokens de acceso que conectan tus cuentas sociales. Ningún método de transmisión o almacenamiento es completamente seguro, y no podemos garantizar una seguridad absoluta.',
        ),
      },
      {
        heading: l('Data retention', 'Retención de datos'),
        body: l(
          'We keep contact and billing records for as long as needed to provide our services and as long as accounting and tax law requires. We keep scheduler access tokens and connected social account data only while the account stays connected, and we delete them within 30 days after you disconnect, revoke access, or ask us to delete them. Content already published on a social platform is controlled by that platform and must be deleted there.',
          'Conservamos los registros de contacto y facturación durante el tiempo necesario para prestar nuestros servicios y durante el tiempo que exijan las leyes contables y fiscales. Conservamos los tokens de acceso del programador y los datos de cuentas sociales conectadas solo mientras la cuenta permanezca conectada, y los eliminamos dentro de los 30 días posteriores a que desconectes, revoques el acceso o nos pidas eliminarlos. El contenido ya publicado en una plataforma social está controlado por esa plataforma y debe eliminarse allí.',
        ),
      },
      {
        heading: l('Your rights and choices', 'Tus derechos y opciones'),
        body: l(
          'You may ask us to access, correct, or delete your personal information, and to receive a copy of the personal information we hold about you. You may opt out of marketing messages at any time by following the unsubscribe link or contacting us through our contact page. To exercise any of these rights, contact us through our contact page and we will respond within 30 days.',
          'Puedes solicitarnos acceder, corregir o eliminar tu información personal, y recibir una copia de la información personal que tenemos sobre ti. Puedes dejar de recibir mensajes de marketing en cualquier momento siguiendo el enlace para cancelar la suscripción o contactándonos desde nuestra página de contacto. Para ejercer cualquiera de estos derechos, contáctanos desde nuestra página de contacto y responderemos dentro de 30 días.',
        ),
      },
      {
        heading: l('Children’s privacy', 'Privacidad de menores'),
        body: l(
          'Our services are intended for businesses and adults. We do not knowingly collect personal information from children under 13. If you believe a child has provided personal information to us, please contact us through our contact page and we will delete it.',
          'Nuestros servicios están dirigidos a negocios y adultos. No recopilamos intencionalmente información personal de menores de 13 años. Si crees que un menor nos ha proporcionado información personal, contáctanos desde nuestra página de contacto y la eliminaremos.',
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
        heading: l('Changes to this policy', 'Cambios a esta política'),
        body: l(
          'We may update this policy from time to time. We will post the updated policy on this page and update the "Last updated" date. If we make a material change to how we handle your information, we will notify you through the website or by email. Your continued use of our services after a change means you accept the updated policy.',
          'Podemos actualizar esta política de vez en cuando. Publicaremos la política actualizada en esta página y actualizaremos la fecha de "Última actualización". Si realizamos un cambio importante en la forma en que manejamos tu información, te lo notificaremos a través del sitio web o por correo electrónico. Tu uso continuado de nuestros servicios después de un cambio significa que aceptas la política actualizada.',
        ),
      },
      { heading: l('Contact', 'Contacto'), body: l('Questions about this policy can be sent through our contact page.', 'Las preguntas sobre esta política pueden enviarse desde nuestra página de contacto.') },
    ],
  },
  {
    slug: 'terms',
    title: l('Terms of Service', 'Términos del servicio'),
    description: l('Terms that apply to use of this website and WebXXL services.', 'Términos aplicables al uso de este sitio y los servicios de WebXXL.'),
    lastUpdated: '2026-11-17',
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
        heading: l('Social media scheduler', 'Programador de redes sociales'),
        body: l(
          'Our scheduler lets you connect your social media accounts, including TikTok, YouTube, Instagram, and Facebook, and plan and publish content to them. When you connect an account, you authorize us to publish the content you approve, using the privacy settings you select. You own your content and you are responsible for it: you must have the rights to everything you publish, and you must follow each platform’s terms of service and community guidelines, including TikTok’s. You may disconnect any account at any time. We are not responsible for a platform rejecting, delaying, or removing your content, or for changes a platform makes to its own rules.',
          'Nuestro programador te permite conectar tus cuentas de redes sociales, incluidas TikTok, YouTube, Instagram y Facebook, y planificar y publicar contenido en ellas. Cuando conectas una cuenta, nos autorizas a publicar el contenido que apruebes, con la configuración de privacidad que elijas. Tú eres propietario de tu contenido y responsable de él: debes tener los derechos sobre todo lo que publiques, y debes seguir los términos de servicio y las normas de la comunidad de cada plataforma, incluidos los de TikTok. Puedes desconectar cualquier cuenta en cualquier momento. No somos responsables de que una plataforma rechace, retrase o elimine tu contenido, ni de los cambios que una plataforma realice en sus propias reglas.',
        ),
      },
      {
        heading: l('Acceptable use', 'Uso aceptable'),
        body: l(
          'You agree not to use our services to publish unlawful, harmful, misleading, or infringing content, to harass or impersonate others, to violate any platform’s rules, or to misuse, disrupt, or attempt to gain unauthorized access to our systems. We may suspend or terminate your access if you violate these terms.',
          'Aceptas no usar nuestros servicios para publicar contenido ilegal, dañino, engañoso o que infrinja derechos, para acosar o suplantar a otros, para violar las reglas de ninguna plataforma, ni para usar indebidamente, interrumpir o intentar acceder sin autorización a nuestros sistemas. Podemos suspender o cancelar tu acceso si violas estos términos.',
        ),
      },
      {
        heading: l('Accounts, suspension, and termination', 'Cuentas, suspensión y cancelación'),
        body: l(
          'We may suspend or terminate your access to our services if you violate these terms, fail to pay, or misuse the service. You may cancel your plan at any time; because our plans are month-to-month with no long-term contract, cancellation takes effect at the end of your current billing period. When your access ends, we will handle your website and content as described in the "Services and agreements" section, and we will delete your scheduler access tokens as described in our Privacy Policy.',
          'Podemos suspender o cancelar tu acceso a nuestros servicios si violas estos términos, no pagas o usas el servicio indebidamente. Puedes cancelar tu plan en cualquier momento; como nuestros planes son mes a mes sin contrato a largo plazo, la cancelación entra en vigor al final de tu período de facturación actual. Cuando tu acceso termina, manejaremos tu sitio web y contenido como se describe en la sección "Servicios y acuerdos", y eliminaremos tus tokens de acceso del programador como se describe en nuestra Política de privacidad.',
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
        heading: l('Payment, refunds, and cancellation', 'Pagos, reembolsos y cancelación'),
        body: l(
          'Plans are billed monthly unless you choose annual billing. A one-time $79 setup fee applies, waived when you pay annually. Annual billing includes two months free. Every plan includes a 30-day money-back guarantee: if you cancel within 30 days of your first payment, we will refund that payment. After 30 days, fees already paid are non-refundable, and you may cancel at any time with no further charges after your current billing period ends. Website ownership transfers to you after 12 paid months, as described in the "Services and agreements" section.',
          'Los planes se facturan mensualmente, salvo que elijas la facturación anual. Se aplica un cargo único de $79 por configuración, exento con pago anual. La facturación anual incluye dos meses gratis. Todos los planes incluyen una garantía de devolución de 30 días: si cancelas dentro de los 30 días posteriores a tu primer pago, te reembolsaremos ese pago. Después de 30 días, las tarifas ya pagadas no son reembolsables, y puedes cancelar en cualquier momento sin más cargos después de que termine tu período de facturación actual. La propiedad del sitio web se transfiere a ti después de 12 meses pagados, como se describe en la sección "Servicios y acuerdos".',
        ),
      },
      {
        heading: l('Service availability and changes', 'Disponibilidad y cambios del servicio'),
        body: l(
          'Our services are provided on an "as-is" and "as available" basis. We may update, improve, or change our services, and we may perform maintenance that temporarily interrupts access. We do not guarantee specific business results, rankings, or lead volumes, and we do not guarantee uninterrupted or error-free service.',
          'Nuestros servicios se proporcionan "tal cual" y "según disponibilidad". Podemos actualizar, mejorar o cambiar nuestros servicios, y podemos realizar mantenimiento que interrumpa temporalmente el acceso. No garantizamos resultados comerciales, posiciones ni volúmenes de clientes potenciales específicos, ni garantizamos un servicio ininterrumpido o sin errores.',
        ),
      },
      {
        heading: l('Limitation of liability', 'Limitación de responsabilidad'),
        body: l(
          'Our services are provided as-is. We do not guarantee specific business results, rankings, or lead volumes. To the maximum extent permitted by law, the total liability of WebXXL for any claim related to our services is limited to the fees you paid for the service in question.',
          'Nuestros servicios se proporcionan tal cual. No garantizamos resultados comerciales, posiciones ni volúmenes de clientes potenciales específicos. En la máxima medida permitida por la ley, la responsabilidad total de WebXXL por cualquier reclamación relacionada con nuestros servicios se limita a las tarifas que pagaste por el servicio en cuestión.',
        ),
      },
      {
        heading: l('Governing law', 'Ley aplicable'),
        body: l(
          'These terms are governed by the laws of the State of Florida, without regard to conflict-of-law rules. Any dispute arising from these terms or our services will be resolved in the state or federal courts located in Florida.',
          'Estos términos se rigen por las leyes del Estado de Florida, sin tener en cuenta las normas sobre conflicto de leyes. Cualquier disputa derivada de estos términos o de nuestros servicios se resolverá en los tribunales estatales o federales ubicados en Florida.',
        ),
      },
      { heading: l('Contact', 'Contacto'), body: l('Questions about these terms can be sent through our contact page.', 'Las preguntas sobre estos términos pueden enviarse desde nuestra página de contacto.') },
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
