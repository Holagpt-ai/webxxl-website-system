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
    'Choose the plan that fits your business. All plans include website, CRM, hosting, domain management and support.',
    'Elige el plan que se adapte a tu negocio. Todos los planes incluyen sitio web, CRM, hosting, gestión de dominio y soporte.',
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
    'Every plan includes a custom website, built-in CRM, hosting, domain management and real support. No long-term contracts.',
    'Cada plan incluye un sitio web a medida, CRM integrado, hosting, gestión de dominio y soporte real. Sin contratos a largo plazo.',
  ),
  includedTitle: l('Included in every plan', 'Incluido en todos los planes'),
  included: [
    { icon: 'template', title: l('Custom website', 'Sitio web a medida'), description: l('Designed for your industry and optimized for leads.', 'Diseñado para tu industria y optimizado para captar clientes.') },
    { icon: 'users', title: l('Built-in CRM', 'CRM integrado'), description: l('Every lead lands in one organized place.', 'Cada prospecto llega a un solo lugar organizado.') },
    { icon: 'server', title: l('Managed hosting', 'Hosting gestionado'), description: l('Fast, secure and monitored for you.', 'Rápido, seguro y monitoreado por nosotros.') },
    { icon: 'globe', title: l('Domain management', 'Gestión de dominio'), description: l('DNS, renewals and email records handled.', 'DNS, renovaciones y registros de correo gestionados.') },
    { icon: 'shield', title: l('Security & backups', 'Seguridad y respaldos'), description: l('SSL, updates and routine backups.', 'SSL, actualizaciones y respaldos periódicos.') },
    { icon: 'headphones', title: l('Real support', 'Soporte real'), description: l('A team that knows your business.', 'Un equipo que conoce tu negocio.') },
  ] satisfies FeatureItem[],
  faq: [
    { question: l('Are there long-term contracts?', '¿Hay contratos a largo plazo?'), answer: l('No. Plans are month-to-month after launch. We earn your business every month.', 'No. Los planes son mes a mes después del lanzamiento. Nos ganamos tu confianza cada mes.') },
    { question: l('Is there a setup fee?', '¿Hay una tarifa de configuración?'), answer: l('Some projects include a one-time setup fee depending on scope. We confirm any fee in writing before work begins.', 'Algunos proyectos incluyen una tarifa única según el alcance. Confirmamos cualquier tarifa por escrito antes de comenzar.') },
    { question: l('Can I change plans later?', '¿Puedo cambiar de plan después?'), answer: l('Yes. You can upgrade or adjust your plan as your business grows.', 'Sí. Puedes mejorar o ajustar tu plan a medida que crece tu negocio.') },
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
    'Questions about a project, pricing or support? Send us a message and a real person will respond within one business day.',
    '¿Preguntas sobre un proyecto, precios o soporte? Envíanos un mensaje y una persona real te responderá en un día hábil.',
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
    ['We review your details within one business day.', 'You get a strategy call invite at a time that works for you.', 'We share a clear plan, timeline and price — no obligation.'],
    ['Revisamos tus datos en un día hábil.', 'Recibes una invitación a una llamada estratégica en el horario que prefieras.', 'Te compartimos un plan, plazos y precio claros, sin compromiso.'],
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
