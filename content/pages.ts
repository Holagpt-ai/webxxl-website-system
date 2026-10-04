import { l, type FaqItem, type FeatureItem } from './types'

/** Page-level copy for fixed pages. Collection pages (services, industries, etc.) live in their own registries. */

export const homePage = {
  seoTitle: l('Websites + CRM for Local Businesses', 'Sitios web + CRM para negocios locales'),
  pill: l('Websites + CRM for local businesses', 'Sitios web + CRM para negocios locales'),
  titleLead: l('Websites that grow your business —', 'Sitios web que hacen crecer tu negocio,'),
  titleAccent: l('with CRM built in.', 'con CRM incluido.'),
  description: l(
    'WebXXL provides everything local businesses need to get found, capture leads, and grow — websites, CRM, campaigns, hosting, domains, analytics and ongoing support.',
    'WebXXL ofrece todo lo que un negocio local necesita para ser encontrado, captar clientes potenciales y crecer: sitios web, CRM, campañas, hosting, dominios, analíticas y soporte continuo.',
  ),
  trust: l(
    ['No long-term contracts', 'Built for 20+ industries', 'Real people. Real support.'],
    ['Sin contratos a largo plazo', 'Para más de 20 industrias', 'Personas reales. Soporte real.'],
  ),
  annotation: l('Your website + a powerful CRM (one seamless system)', 'Tu sitio web + un CRM potente (un solo sistema)'),
  industriesEyebrow: l('Industries', 'Industrias'),
  industriesTitle: l('Built for the businesses that keep things moving.', 'Hecho para los negocios que mantienen todo en marcha.'),
  industriesCount: l('20+ Industries', 'Más de 20 industrias'),
  crmEyebrow: l('WebXXL CRM', 'CRM de WebXXL'),
  crmTitle: l('A CRM platform built for local business growth.', 'Una plataforma CRM creada para el crecimiento de negocios locales.'),
  crmDescription: l(
    'Manage your leads, customers, campaigns and communications in one easy-to-use platform — built right into every WebXXL website.',
    'Gestiona tus clientes potenciales, clientes, campañas y comunicaciones en una plataforma fácil de usar, integrada en cada sitio web de WebXXL.',
  ),
  crmBullets: l(
    ['Track leads and customers', 'Manage pipelines and follow-ups', 'Send SMS & email campaigns', 'View customer activity and history', 'Built with provider abstraction for future expansion'],
    ['Seguimiento de prospectos y clientes', 'Gestión de embudos y seguimientos', 'Campañas por SMS y correo', 'Actividad e historial de cada cliente', 'Arquitectura preparada para futuras integraciones'],
  ),
  hostingEyebrow: l('Hosting & Domains', 'Hosting y dominios'),
  hostingTitle: l('Reliable, secure, and fully managed.', 'Confiable, seguro y totalmente gestionado.'),
  hostingDescription: l(
    'WebXXL takes care of the technical stuff so you can focus on your business. Hosting, domains, business email, security and ongoing maintenance — all included.',
    'WebXXL se encarga de la parte técnica para que tú te enfoques en tu negocio. Hosting, dominios, correo empresarial, seguridad y mantenimiento continuo, todo incluido.',
  ),
  hostingItems: [
    { icon: 'server', title: l('Fast & Secure Hosting', 'Hosting rápido y seguro'), description: l('Managed hosting with SSL and a global CDN', 'Hosting gestionado con SSL y CDN global') },
    { icon: 'globe', title: l('Domain Management', 'Gestión de dominios'), description: l('Registration, DNS & renewals', 'Registro, DNS y renovaciones') },
    { icon: 'mail', title: l('Business Email', 'Correo empresarial'), description: l('Professional email @yourdomain', 'Correo profesional @tudominio') },
    { icon: 'wrench', title: l('Ongoing Maintenance', 'Mantenimiento continuo'), description: l('Updates, backups & security', 'Actualizaciones, respaldos y seguridad') },
    { icon: 'headphones', title: l('Expert Support', 'Soporte experto'), description: l('Real people, here to help', 'Personas reales, listas para ayudar') },
  ] satisfies FeatureItem[],
  caseStudiesDescription: l(
    'See how WebXXL helps local businesses grow with better websites, built-in CRM, and ongoing support.',
    'Descubre cómo WebXXL ayuda a negocios locales a crecer con mejores sitios web, CRM integrado y soporte continuo.',
  ),
  caseStudiesTitle: l('Real businesses. Real results.', 'Negocios reales. Resultados reales.'),
  pricingEyebrow: l('Pricing', 'Precios'),
  pricingTitle: l('Simple, transparent pricing.', 'Precios simples y transparentes.'),
  pricingDescription: l(
    'One-time website build packages with custom design, mobile-responsive pages and SEO foundations. No subscription required.',
    'Paquetes de sitio web con pago único, con diseño personalizado, páginas adaptables a móviles y bases de SEO. Sin suscripción.',
  ),
  howEyebrow: l('How it works', 'Cómo funciona'),
  howTitle: l('From first call to a growing pipeline.', 'De la primera llamada a un flujo constante de clientes.'),
}

export const solutionsPage = {
  eyebrow: l('Solutions', 'Soluciones'),
  title: l('One partner for your website, CRM and growth.', 'Un solo aliado para tu sitio web, CRM y crecimiento.'),
  description: l(
    'Every WebXXL solution works together. Start with what you need today and add more as your business grows — no rebuilds, no juggling vendors.',
    'Todas las soluciones de WebXXL funcionan juntas. Empieza con lo que necesitas hoy y agrega más a medida que creces, sin rehacer nada ni coordinar proveedores.',
  ),
}

export const industriesPage = {
  eyebrow: l('Industries', 'Industrias'),
  title: l('Websites and CRM built for your industry.', 'Sitios web y CRM creados para tu industria.'),
  description: l(
    'We build for the way your business actually works — the services you sell, the questions customers ask, and how leads turn into booked jobs.',
    'Construimos según cómo funciona realmente tu negocio: los servicios que vendes, las preguntas de tus clientes y cómo los prospectos se convierten en trabajos agendados.',
  ),
  notListedTitle: l('Don’t see your industry?', '¿No ves tu industria?'),
  notListedBody: l(
    'Our platform adapts to almost any local or service business. Tell us about yours and we will show you what it looks like.',
    'Nuestra plataforma se adapta a casi cualquier negocio local o de servicios. Cuéntanos sobre el tuyo y te mostraremos cómo se vería.',
  ),
}

export const caseStudiesPage = {
  eyebrow: l('Case Studies', 'Casos de éxito'),
  title: l('Real businesses. Real results.', 'Negocios reales. Resultados reales.'),
  description: l(
    'A look at how we plan, design and launch websites with CRM built in. Example projects are clearly labeled until verified client results are published.',
    'Un vistazo a cómo planificamos, diseñamos y lanzamos sitios web con CRM integrado. Los proyectos de ejemplo están claramente identificados hasta publicar resultados verificados.',
  ),
}

export const blogPage = {
  eyebrow: l('Blog', 'Blog'),
  title: l('Growth tips for local businesses.', 'Consejos de crecimiento para negocios locales.'),
  description: l(
    'Practical guides on websites, lead capture, CRM and local marketing — written for owners, not developers.',
    'Guías prácticas sobre sitios web, captación de clientes, CRM y marketing local, escritas para dueños de negocio, no para programadores.',
  ),
  sampleNotice: l('Sample article — placeholder content for layout review.', 'Artículo de muestra: contenido provisional para revisión de diseño.'),
}

export const pricingPage = {
  eyebrow: l('Pricing', 'Precios'),
  title: l('Simple, transparent pricing.', 'Precios simples y transparentes.'),
  description: l(
    'One-time website build packages. Pay once for a custom, mobile-responsive website built and deployed for your business.',
    'Paquetes de sitio web con pago único. Paga una sola vez por un sitio web a medida, adaptable a móviles, creado y publicado para tu negocio.',
  ),
  includedTitle: l('Included in every package', 'Incluido en todos los paquetes'),
  included: [
    { icon: 'template', title: l('Custom design', 'Diseño personalizado'), description: l('Tailored to your business and industry.', 'Adaptado a tu negocio y a tu industria.') },
    { icon: 'monitor', title: l('Mobile responsive', 'Adaptable a móviles'), description: l('Looks and works great on every screen.', 'Se ve y funciona bien en cualquier pantalla.') },
    { icon: 'mail', title: l('Lead capture', 'Captación de prospectos'), description: l('Contact forms that turn visitors into leads.', 'Formularios que convierten visitantes en prospectos.') },
    { icon: 'search', title: l('SEO foundations', 'Bases de SEO'), description: l('XML sitemap and on-page SEO setup.', 'Mapa del sitio XML y configuración de SEO on-page.') },
    { icon: 'file', title: l('Semantic HTML', 'HTML semántico'), description: l('Standards-compliant, accessible markup.', 'Código conforme a estándares y accesible.') },
    { icon: 'rocket', title: l('Vercel deployment', 'Despliegue en Vercel'), description: l('Launched on fast, modern infrastructure.', 'Publicado en una infraestructura rápida y moderna.') },
  ] satisfies FeatureItem[],
  faq: [
    { question: l('Is this a monthly subscription?', '¿Es una suscripción mensual?'), answer: l('No. Startup, Business and Elite are one-time website build fees. Ongoing services such as hosting, CRM or maintenance are offered separately.', 'No. Startup, Business y Elite son tarifas únicas por la creación del sitio. Los servicios continuos como hosting, CRM o mantenimiento se ofrecen por separado.') },
    { question: l('How fast is turnaround?', '¿Qué tan rápida es la entrega?'), answer: l('Typically 48–72 hours for Startup and 7–14 business days for Elite, after we receive your required content and assets.', 'Normalmente 48–72 horas para Startup y 7–14 días hábiles para Elite, después de recibir tu contenido y recursos requeridos.') },
    { question: l('Can I upgrade from Startup to Elite?', '¿Puedo pasar de Startup a Elite?'), answer: l('Yes. Talk to us and we will scope the upgrade for your business.', 'Sí. Habla con nosotros y definiremos el alcance de la mejora para tu negocio.') },
    { question: l('Do I own my domain?', '¿Soy dueño de mi dominio?'), answer: l('Yes. Your domain is registered in your business name, and we manage it on your behalf.', 'Sí. Tu dominio se registra a nombre de tu negocio y nosotros lo gestionamos por ti.') },
  ] satisfies FaqItem[],
}

export const aboutPage = {
  eyebrow: l('About WebXXL', 'Sobre WebXXL'),
  title: l('We build the systems local businesses grow on.', 'Construimos los sistemas sobre los que crecen los negocios locales.'),
  description: l(
    'WebXXL combines website design, CRM and managed infrastructure into one partner — so owners can spend less time on technology and more time serving customers.',
    'WebXXL combina diseño web, CRM e infraestructura gestionada en un solo aliado, para que los dueños dediquen menos tiempo a la tecnología y más a sus clientes.',
  ),
  imageAlt: l('The WebXXL team collaborating on a client website in a bright studio', 'El equipo de WebXXL colaborando en el sitio web de un cliente en un estudio luminoso'),
  missionTitle: l('Our mission', 'Nuestra misión'),
  mission: l(
    'Local businesses are the backbone of every community, yet most are stuck with outdated websites, scattered leads and vendors who disappear after launch. We exist to give them the same quality of tools the biggest brands use — without the complexity or the enterprise price tag.',
    'Los negocios locales son la base de cada comunidad, pero muchos tienen sitios web desactualizados, prospectos dispersos y proveedores que desaparecen tras el lanzamiento. Existimos para darles herramientas de la misma calidad que usan las grandes marcas, sin la complejidad ni el precio empresarial.',
  ),
  valuesTitle: l('What we believe', 'En qué creemos'),
  values: [
    { icon: 'target', title: l('Results over decoration', 'Resultados antes que decoración'), description: l('A beautiful site matters only if it brings in customers. Every decision starts there.', 'Un sitio bonito solo importa si trae clientes. Cada decisión parte de ahí.') },
    { icon: 'users', title: l('Real partnership', 'Colaboración real'), description: l('You get a team that knows your business, not a ticket queue.', 'Tienes un equipo que conoce tu negocio, no una fila de tickets.') },
    { icon: 'shield', title: l('Honest by default', 'Honestidad ante todo'), description: l('Clear pricing, no long-term lock-in, and no inflated promises.', 'Precios claros, sin permanencia forzada y sin promesas exageradas.') },
    { icon: 'rocket', title: l('Built to grow', 'Hecho para crecer'), description: l('Our platform is modular, so adding features never means starting over.', 'Nuestra plataforma es modular: agregar funciones nunca significa empezar de cero.') },
  ] satisfies FeatureItem[],
  platformTitle: l('One platform, not a patchwork', 'Una plataforma, no un rompecabezas'),
  platformBody: l(
    'Website, CRM, campaigns, hosting and domains share one foundation. That means fewer logins, fewer vendors, and data that actually connects — from the first website visit to the booked job.',
    'Sitio web, CRM, campañas, hosting y dominios comparten una misma base. Eso significa menos accesos, menos proveedores y datos que realmente se conectan, desde la primera visita hasta el trabajo agendado.',
  ),
}

export const contactPage = {
  eyebrow: l('Contact', 'Contacto'),
  title: l('Let’s talk about your business.', 'Hablemos de tu negocio.'),
  description: l(
    'Questions about a project, pricing or support? Send us a message and a real person from the WebXXL team will follow up.',
    '¿Preguntas sobre un proyecto, precios o soporte? Envíanos un mensaje y una persona real del equipo WebXXL te dará seguimiento.',
  ),
  formTitle: l('Send us a message', 'Envíanos un mensaje'),
  directTitle: l('Other ways to reach us', 'Otras formas de contactarnos'),
  hoursLabel: l('Hours', 'Horario'),
  emailLabel: l('Email', 'Correo'),
  phoneLabel: l('Phone', 'Teléfono'),
  startTitle: l('Ready to start a project?', '¿Listo para iniciar un proyecto?'),
  startBody: l('Use our project planner to share details before your strategy call.', 'Usa nuestro planificador para compartir detalles antes de tu llamada estratégica.'),
}

export const getStartedPage = {
  eyebrow: l('Get Started', 'Comenzar'),
  sideTitle: l('What happens next', 'Qué sigue'),
  sideSteps: l(
    ['We review your project details.', 'You get a strategy call invite at a time that works for you.', 'We share a clear plan, timeline and price — no obligation.'],
    ['Revisamos los detalles de tu proyecto.', 'Recibes una invitación a una llamada estratégica en el horario que prefieras.', 'Te compartimos un plan, plazos y precio claros, sin compromiso.'],
  ),
}

export const supportPage = {
  eyebrow: l('Help Center', 'Centro de ayuda'),
  title: l('How can we help?', '¿Cómo podemos ayudarte?'),
  description: l(
    'Answers to common questions about your website, CRM, hosting, domains and billing. Can’t find what you need? Our team is one message away.',
    'Respuestas a preguntas frecuentes sobre tu sitio web, CRM, hosting, dominios y facturación. ¿No encuentras lo que buscas? Nuestro equipo está a un mensaje de distancia.',
  ),
  contactTitle: l('Still need help?', '¿Aún necesitas ayuda?'),
  contactBody: l('Existing clients can also reach their project lead directly from the client portal.', 'Los clientes actuales también pueden contactar a su líder de proyecto desde el portal de clientes.'),
}
