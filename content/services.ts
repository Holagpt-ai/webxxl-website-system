import type { IconName } from '@/lib/icons'
import type { Localized } from '@/lib/i18n/localize'
import { l, type ContentItem, type FaqItem, type FeatureItem } from './types'

export type ServiceVisual = 'website' | 'crm' | 'campaigns' | 'analytics' | 'infrastructure'

export type Service = {
  slug: string
  icon: IconName
  enabled: boolean
  name: Localized
  shortDescription: Localized
  eyebrow: Localized
  heroTitle: Localized
  heroDescription: Localized
  visual: ServiceVisual
  benefits: ContentItem[]
  problems: ContentItem[]
  features: FeatureItem[]
  process?: ContentItem[]
  industries: string[]
  relatedServices: string[]
  faq: FaqItem[]
  seo?: { title?: Localized; description?: Localized }
}

/**
 * Add a service by appending an object here. A page is generated at
 * /solutions/{slug} (and /es/solutions/{slug}) automatically and it appears in navigation.
 */
export const services: Service[] = [
  {
    slug: 'website-design',
    icon: 'monitor',
    enabled: true,
    name: l('Website Design', 'Diseño web'),
    shortDescription: l('Modern, high-converting websites tailored to your industry.', 'Sitios modernos y de alta conversión adaptados a tu industria.'),
    eyebrow: l('Website design', 'Diseño web'),
    heroTitle: l('A website designed to win customers, not just look good.', 'Un sitio web diseñado para ganar clientes, no solo para verse bien.'),
    heroDescription: l(
      'We design and build fast, mobile-first websites structured around your services, service areas and the way your customers decide — connected to CRM from day one.',
      'Diseñamos y construimos sitios rápidos y pensados para móviles, organizados según tus servicios, zonas y la forma en que deciden tus clientes, conectados al CRM desde el primer día.',
    ),
    visual: 'website',
    benefits: [
      { title: l('Built to convert', 'Hecho para convertir'), description: l('Clear calls to action, quote forms and click-to-call on every page.', 'Llamadas a la acción claras, cotizaciones y clic para llamar en cada página.') },
      { title: l('Industry-ready structure', 'Estructura por industria'), description: l('Page layouts designed for how your industry sells.', 'Diseños de página pensados para cómo vende tu industria.') },
      { title: l('Connected by default', 'Conectado por defecto'), description: l('Every lead flows straight into WebXXL CRM.', 'Cada contacto llega directo a WebXXL CRM.') },
    ],
    problems: [
      { title: l('Outdated design', 'Diseño anticuado'), description: l('An old site makes a great business look unreliable.', 'Un sitio viejo hace que un gran negocio parezca poco confiable.') },
      { title: l('Hard to use on phones', 'Difícil de usar en móviles'), description: l('Most visitors arrive on mobile and leave when it is clumsy.', 'La mayoría llega desde el móvil y se va si es incómodo.') },
      { title: l('No clear next step', 'Sin siguiente paso claro'), description: l('Visitors cannot tell how to book, call or request a quote.', 'Los visitantes no saben cómo reservar, llamar o cotizar.') },
    ],
    features: [
      { icon: 'template', title: l('Custom design', 'Diseño a medida'), description: l('Branded layouts, not generic templates.', 'Diseños con tu marca, no plantillas genéricas.') },
      { icon: 'gauge', title: l('Fast & mobile-first', 'Rápido y móvil primero'), description: l('Optimized for speed and every screen size.', 'Optimizado para velocidad y cualquier pantalla.') },
      { icon: 'search', title: l('Search-ready pages', 'Páginas listas para búsqueda'), description: l('Semantic structure, metadata and service-area pages.', 'Estructura semántica, metadatos y páginas por zona.') },
      { icon: 'languages', title: l('Multilingual options', 'Opciones multilingües'), description: l('English and Spanish versions from one system.', 'Versiones en inglés y español desde un solo sistema.') },
    ],
    industries: ['hvac', 'plumbing', 'roofing', 'dental', 'legal', 'restaurants'],
    relatedServices: ['landing-pages', 'lead-capture', 'hosting'],
    faq: [
      { question: l('How long does a website take?', '¿Cuánto tarda un sitio web?'), answer: l('Timelines depend on scope. We confirm a schedule during your strategy call before any work starts.', 'Depende del alcance. Confirmamos un cronograma en tu llamada estratégica antes de empezar.') },
      { question: l('Do I own my content?', '¿Soy dueño de mi contenido?'), answer: l('Yes. Your content, images and domain belong to your business.', 'Sí. Tu contenido, imágenes y dominio pertenecen a tu negocio.') },
    ],
  },
  {
    slug: 'website-redesign',
    icon: 'refresh',
    enabled: true,
    name: l('Website Redesign', 'Rediseño web'),
    shortDescription: l('Turn an outdated site into a modern lead engine.', 'Convierte un sitio anticuado en un generador de clientes.'),
    eyebrow: l('Website redesign', 'Rediseño web'),
    heroTitle: l('Keep what works. Rebuild what does not.', 'Conserva lo que funciona. Reconstruye lo que no.'),
    heroDescription: l(
      'We audit your current website, preserve valuable content and search presence, and rebuild it on a modern, connected platform.',
      'Auditamos tu sitio actual, conservamos el contenido y posicionamiento valiosos, y lo reconstruimos en una plataforma moderna y conectada.',
    ),
    visual: 'website',
    benefits: [
      { title: l('Careful migration', 'Migración cuidadosa'), description: l('We map existing pages and URLs so nothing important is lost.', 'Mapeamos páginas y URLs existentes para no perder nada importante.') },
      { title: l('Modern experience', 'Experiencia moderna'), description: l('A faster, clearer site that works on every device.', 'Un sitio más rápido y claro que funciona en todo dispositivo.') },
      { title: l('New capabilities', 'Nuevas capacidades'), description: l('Add CRM, campaigns and analytics during the rebuild.', 'Agrega CRM, campañas y analítica durante la reconstrucción.') },
    ],
    problems: [
      { title: l('Slow and fragile', 'Lento y frágil'), description: l('Old plugins and themes break and slow everything down.', 'Plugins y temas viejos fallan y lo hacen todo lento.') },
      { title: l('Hard to update', 'Difícil de actualizar'), description: l('Simple changes require a developer every time.', 'Cambios simples requieren un desarrollador cada vez.') },
      { title: l('Disconnected leads', 'Contactos desconectados'), description: l('Form submissions go to an inbox and get lost.', 'Los formularios van a un correo y se pierden.') },
    ],
    features: [
      { icon: 'search', title: l('Site audit', 'Auditoría del sitio'), description: l('Review of content, structure and performance.', 'Revisión de contenido, estructura y rendimiento.') },
      { icon: 'workflow', title: l('Redirect mapping', 'Mapeo de redirecciones'), description: l('Old URLs redirect to their new home.', 'Las URLs antiguas redirigen a su nueva ubicación.') },
      { icon: 'template', title: l('Refreshed design', 'Diseño renovado'), description: l('Modern design aligned with your brand.', 'Diseño moderno alineado con tu marca.') },
      { icon: 'users', title: l('CRM connection', 'Conexión al CRM'), description: l('Forms now feed your pipeline automatically.', 'Los formularios alimentan tu embudo automáticamente.') },
    ],
    industries: ['remodeling', 'real-estate', 'financial-services', 'med-spas'],
    relatedServices: ['website-design', 'analytics', 'maintenance'],
    faq: [
      { question: l('Will I lose my search rankings?', '¿Perderé mi posicionamiento?'), answer: l('We plan redirects and preserve key content to minimize disruption, though no one can guarantee rankings.', 'Planificamos redirecciones y conservamos contenido clave para minimizar el impacto, aunque nadie puede garantizar posiciones.') },
      { question: l('Can you move my site from another platform?', '¿Pueden mover mi sitio desde otra plataforma?'), answer: l('Yes. We migrate content from most common website platforms.', 'Sí. Migramos contenido desde la mayoría de plataformas comunes.') },
    ],
  },
  {
    slug: 'crm',
    icon: 'users',
    enabled: true,
    name: l('CRM', 'CRM'),
    shortDescription: l('Built-in CRM to manage leads, customers and follow-ups.', 'CRM integrado para gestionar contactos, clientes y seguimientos.'),
    eyebrow: l('WebXXL CRM', 'WebXXL CRM'),
    heroTitle: l('The CRM that comes with your website.', 'El CRM que viene con tu sitio web.'),
    heroDescription: l(
      'Manage leads, customers, pipelines, campaigns and conversations in one place — connected directly to your WebXXL website.',
      'Gestiona contactos, clientes, embudos, campañas y conversaciones en un solo lugar, conectado directamente a tu sitio WebXXL.',
    ),
    visual: 'crm',
    benefits: [
      { title: l('No setup headaches', 'Sin complicaciones'), description: l('Your website and CRM are connected from launch.', 'Tu sitio y CRM están conectados desde el lanzamiento.') },
      { title: l('See every lead', 'Ve cada contacto'), description: l('Know where leads come from and what happened next.', 'Sabe de dónde vienen y qué pasó después.') },
      { title: l('Follow up faster', 'Responde más rápido'), description: l('Reminders and messaging keep your team on track.', 'Recordatorios y mensajes mantienen a tu equipo al día.') },
    ],
    problems: [
      { title: l('Spreadsheets and sticky notes', 'Hojas de cálculo y notas'), description: l('Customer info scattered across tools and people.', 'Información de clientes dispersa entre herramientas y personas.') },
      { title: l('Missed follow-ups', 'Seguimientos olvidados'), description: l('Leads go cold because no one knew to call back.', 'Los contactos se enfrían porque nadie devolvió la llamada.') },
      { title: l('Complex CRMs', 'CRMs complejos'), description: l('Enterprise tools are expensive and hard to adopt.', 'Las herramientas empresariales son caras y difíciles de adoptar.') },
    ],
    features: [
      { icon: 'contact', title: l('Contacts & history', 'Contactos e historial'), description: l('A timeline of every interaction.', 'Una línea de tiempo de cada interacción.') },
      { icon: 'kanban', title: l('Pipelines & deals', 'Embudos y negocios'), description: l('Visual stages from new lead to won.', 'Etapas visuales de nuevo contacto a cerrado.') },
      { icon: 'message', title: l('SMS & email', 'SMS y correo'), description: l('Message customers from one inbox.', 'Escribe a clientes desde una sola bandeja.') },
      { icon: 'calendar', title: l('Appointments', 'Citas'), description: l('Track booked jobs and consultations.', 'Sigue trabajos y consultas agendadas.') },
    ],
    industries: ['hvac', 'med-spas', 'real-estate', 'legal', 'dental', 'automotive'],
    relatedServices: ['lead-capture', 'campaigns', 'analytics'],
    faq: [
      { question: l('Is the CRM included in every plan?', '¿El CRM está en todos los planes?'), answer: l('Core CRM access is included in every plan. Advanced features vary by plan.', 'El acceso base está incluido en todos los planes. Las funciones avanzadas varían según el plan.') },
      { question: l('Can I import existing contacts?', '¿Puedo importar mis contactos?'), answer: l('Yes. We help import contacts from spreadsheets and common tools during onboarding.', 'Sí. Te ayudamos a importar contactos desde hojas de cálculo y herramientas comunes.') },
    ],
  },
  {
    slug: 'lead-capture',
    icon: 'filter',
    enabled: true,
    name: l('Lead Capture', 'Captación de clientes'),
    shortDescription: l('Turn more visitors into leads with forms, chat and automation.', 'Convierte más visitantes en contactos con formularios, chat y automatización.'),
    eyebrow: l('Lead capture', 'Captación de clientes'),
    heroTitle: l('Turn visitors into conversations.', 'Convierte visitantes en conversaciones.'),
    heroDescription: l(
      'Quote forms, booking requests and click-to-call placed where visitors are ready to act — with every submission routed to your CRM.',
      'Formularios de cotización, solicitudes de reserva y clic para llamar donde el visitante está listo para actuar, con cada envío directo a tu CRM.',
    ),
    visual: 'crm',
    benefits: [
      { title: l('More inquiries', 'Más consultas'), description: l('Remove friction between interest and contact.', 'Elimina la fricción entre el interés y el contacto.') },
      { title: l('Better lead quality', 'Mejor calidad'), description: l('Ask the right questions up front.', 'Haz las preguntas correctas desde el inicio.') },
      { title: l('Instant routing', 'Ruteo instantáneo'), description: l('Leads reach the right person immediately.', 'Los contactos llegan a la persona indicada al instante.') },
    ],
    problems: [
      { title: l('Contact page only', 'Solo una página de contacto'), description: l('One buried form is not enough.', 'Un formulario escondido no es suficiente.') },
      { title: l('Unqualified leads', 'Contactos no calificados'), description: l('Time wasted on inquiries you cannot serve.', 'Tiempo perdido en consultas que no puedes atender.') },
      { title: l('Slow response', 'Respuesta lenta'), description: l('Leads contact competitors while waiting.', 'Los contactos buscan a la competencia mientras esperan.') },
    ],
    features: [
      { icon: 'file', title: l('Smart forms', 'Formularios inteligentes'), description: l('Multi-step quote and booking forms.', 'Formularios de cotización y reserva por pasos.') },
      { icon: 'zap', title: l('Instant alerts', 'Alertas instantáneas'), description: l('Email and SMS notifications for new leads.', 'Notificaciones por correo y SMS de nuevos contactos.') },
      { icon: 'target', title: l('Source tracking', 'Rastreo de origen'), description: l('Know which page or campaign drove each lead.', 'Sabe qué página o campaña generó cada contacto.') },
      { icon: 'workflow', title: l('Automations', 'Automatizaciones'), description: l('Auto-replies and follow-up sequences.', 'Respuestas automáticas y secuencias de seguimiento.') },
    ],
    industries: ['roofing', 'pest-control', 'landscaping', 'electricians'],
    relatedServices: ['crm', 'landing-pages', 'campaigns'],
    faq: [
      { question: l('Do forms work on mobile?', '¿Los formularios funcionan en móvil?'), answer: l('Yes. Every form is designed mobile-first.', 'Sí. Cada formulario está diseñado primero para móvil.') },
      { question: l('Is spam filtered?', '¿Se filtra el spam?'), answer: l('Forms include spam-resistant measures to reduce junk submissions.', 'Los formularios incluyen medidas contra el spam.') },
    ],
  },
  {
    slug: 'campaigns',
    icon: 'send',
    enabled: true,
    name: l('Campaigns', 'Campañas'),
    shortDescription: l('Send SMS and email campaigns to win more business.', 'Envía campañas por SMS y correo para ganar más negocio.'),
    eyebrow: l('Campaigns', 'Campañas'),
    heroTitle: l('Stay top of mind with the customers you already have.', 'Mantente presente con los clientes que ya tienes.'),
    heroDescription: l(
      'Send seasonal promotions, reminders and follow-ups by SMS and email — using the customer data already in your CRM.',
      'Envía promociones de temporada, recordatorios y seguimientos por SMS y correo, usando los datos que ya están en tu CRM.',
    ),
    visual: 'campaigns',
    benefits: [
      { title: l('Repeat business', 'Negocio recurrente'), description: l('Remind past customers when it is time to book again.', 'Recuerda a clientes anteriores cuando toca volver a reservar.') },
      { title: l('Simple to send', 'Fácil de enviar'), description: l('Templates and segments without a marketing team.', 'Plantillas y segmentos sin un equipo de marketing.') },
      { title: l('Measurable', 'Medible'), description: l('See sends, clicks and replies in one view.', 'Ve envíos, clics y respuestas en una vista.') },
    ],
    problems: [
      { title: l('Forgotten customers', 'Clientes olvidados'), description: l('Past customers never hear from you again.', 'Los clientes anteriores nunca vuelven a saber de ti.') },
      { title: l('Scattered tools', 'Herramientas dispersas'), description: l('Separate apps for email, texts and contacts.', 'Apps separadas para correo, mensajes y contactos.') },
      { title: l('No visibility', 'Sin visibilidad'), description: l('No idea which messages actually work.', 'Sin idea de qué mensajes funcionan.') },
    ],
    features: [
      { icon: 'mail', title: l('Email campaigns', 'Campañas por correo'), description: l('Branded templates for promotions and news.', 'Plantillas con tu marca para promociones y novedades.') },
      { icon: 'message', title: l('SMS campaigns', 'Campañas por SMS'), description: l('Short, timely texts customers actually read.', 'Mensajes breves y oportunos que sí se leen.') },
      { icon: 'users', title: l('Segments', 'Segmentos'), description: l('Target by service, location or last visit.', 'Segmenta por servicio, ubicación o última visita.') },
      { icon: 'chart', title: l('Campaign reports', 'Informes de campaña'), description: l('Track sends, clicks and responses.', 'Sigue envíos, clics y respuestas.') },
    ],
    industries: ['med-spas', 'restaurants', 'dental', 'automotive', 'hvac'],
    relatedServices: ['crm', 'analytics', 'lead-capture'],
    faq: [
      { question: l('Do customers need to opt in?', '¿Los clientes deben aceptar?'), answer: l('Yes. Campaigns are designed around consent and unsubscribe requirements.', 'Sí. Las campañas se basan en consentimiento y opción de baja.') },
      { question: l('Are message costs included?', '¿Los costos de envío están incluidos?'), answer: l('Messaging volumes and any usage costs are confirmed per plan during onboarding.', 'Los volúmenes y costos de uso se confirman por plan durante la incorporación.') },
    ],
  },
  {
    slug: 'hosting',
    icon: 'server',
    enabled: true,
    name: l('Hosting', 'Hosting'),
    shortDescription: l('Fast, secure and reliable hosting included.', 'Hosting rápido, seguro y confiable incluido.'),
    eyebrow: l('Managed hosting', 'Hosting gestionado'),
    heroTitle: l('Hosting you never have to think about.', 'Hosting en el que nunca tendrás que pensar.'),
    heroDescription: l(
      'Your WebXXL website runs on managed infrastructure with SSL, a global CDN, backups and monitoring handled for you.',
      'Tu sitio WebXXL funciona en infraestructura gestionada con SSL, CDN global, respaldos y monitoreo a cargo nuestro.',
    ),
    visual: 'infrastructure',
    benefits: [
      { title: l('Fast everywhere', 'Rápido en todas partes'), description: l('Content served from a global edge network.', 'Contenido servido desde una red global.') },
      { title: l('Secure by default', 'Seguro por defecto'), description: l('SSL certificates and security updates included.', 'Certificados SSL y actualizaciones de seguridad incluidos.') },
      { title: l('Fully managed', 'Totalmente gestionado'), description: l('No servers, plugins or updates to manage.', 'Sin servidores, plugins ni actualizaciones que gestionar.') },
    ],
    problems: [
      { title: l('Cheap shared hosting', 'Hosting compartido barato'), description: l('Slow pages and unpredictable downtime.', 'Páginas lentas y caídas impredecibles.') },
      { title: l('Security worries', 'Preocupaciones de seguridad'), description: l('Outdated software leaves sites exposed.', 'El software desactualizado deja sitios expuestos.') },
      { title: l('Who do I call?', '¿A quién llamo?'), description: l('Hosting support that does not know your site.', 'Soporte de hosting que no conoce tu sitio.') },
    ],
    features: [
      { icon: 'lock', title: l('SSL included', 'SSL incluido'), description: l('HTTPS on every page.', 'HTTPS en cada página.') },
      { icon: 'globe', title: l('Global CDN', 'CDN global'), description: l('Fast loading for visitors everywhere.', 'Carga rápida para visitantes en todo lugar.') },
      { icon: 'backup', title: l('Backups', 'Respaldos'), description: l('Regular backups of your site.', 'Respaldos regulares de tu sitio.') },
      { icon: 'activity', title: l('Monitoring', 'Monitoreo'), description: l('We watch availability so you do not have to.', 'Vigilamos la disponibilidad por ti.') },
    ],
    industries: ['clinical-research', 'outpatient-medical', 'legal', 'financial-services'],
    relatedServices: ['domains', 'maintenance', 'analytics'],
    faq: [
      { question: l('Can I host an existing site with you?', '¿Puedo alojar un sitio existente?'), answer: l('Hosting is designed for sites built on the WebXXL platform. We can rebuild or migrate your existing site.', 'El hosting está pensado para sitios en la plataforma WebXXL. Podemos reconstruir o migrar tu sitio actual.') },
      { question: l('Is there an uptime guarantee?', '¿Hay garantía de disponibilidad?'), answer: l('Service levels are defined in your agreement. We monitor availability continuously.', 'Los niveles de servicio se definen en tu acuerdo. Monitoreamos la disponibilidad continuamente.') },
    ],
  },
  {
    slug: 'domains',
    icon: 'globe',
    enabled: true,
    name: l('Domains', 'Dominios'),
    shortDescription: l('Domain registration and management made easy.', 'Registro y gestión de dominios sin complicaciones.'),
    eyebrow: l('Domains', 'Dominios'),
    heroTitle: l('Your domain, handled properly.', 'Tu dominio, bien gestionado.'),
    heroDescription: l(
      'Register, transfer and manage domains alongside your website, with DNS and renewals taken care of.',
      'Registra, transfiere y gestiona dominios junto a tu sitio, con DNS y renovaciones resueltos.',
    ),
    visual: 'infrastructure',
    benefits: [
      { title: l('One place', 'Un solo lugar'), description: l('Domain, website and email managed together.', 'Dominio, sitio y correo gestionados juntos.') },
      { title: l('No surprise expirations', 'Sin vencimientos sorpresa'), description: l('Renewals tracked so your site stays online.', 'Renovaciones controladas para que tu sitio siga en línea.') },
      { title: l('DNS done right', 'DNS bien configurado'), description: l('Records configured by people who know them.', 'Registros configurados por quienes los conocen.') },
    ],
    problems: [
      { title: l('Lost logins', 'Accesos perdidos'), description: l('Domains registered years ago by someone else.', 'Dominios registrados hace años por otra persona.') },
      { title: l('Confusing DNS', 'DNS confuso'), description: l('One wrong record can take email offline.', 'Un registro incorrecto puede dejar el correo sin servicio.') },
      { title: l('Expired domains', 'Dominios vencidos'), description: l('A missed renewal takes the whole business offline.', 'Una renovación olvidada deja todo el negocio fuera de línea.') },
    ],
    features: [
      { icon: 'search', title: l('Registration', 'Registro'), description: l('Find and register the right domain.', 'Encuentra y registra el dominio correcto.') },
      { icon: 'refresh', title: l('Transfers', 'Transferencias'), description: l('Move existing domains under one roof.', 'Reúne tus dominios en un solo lugar.') },
      { icon: 'network', title: l('DNS management', 'Gestión de DNS'), description: l('Records for website, email and verification.', 'Registros para sitio, correo y verificación.') },
      { icon: 'mail', title: l('Business email', 'Correo empresarial'), description: l('Professional email at your domain.', 'Correo profesional con tu dominio.') },
    ],
    industries: ['general-contractors', 'home-builders', 'interior-design', 'painting'],
    relatedServices: ['hosting', 'website-design', 'maintenance'],
    faq: [
      { question: l('Who owns the domain?', '¿Quién es dueño del dominio?'), answer: l('Your business does. We manage it on your behalf.', 'Tu negocio. Nosotros lo gestionamos en tu nombre.') },
      { question: l('Can I transfer my domain later?', '¿Puedo transferir mi dominio después?'), answer: l('Yes, subject to standard registry transfer rules.', 'Sí, según las reglas estándar de transferencia.') },
    ],
  },
  {
    slug: 'analytics',
    icon: 'chart',
    enabled: true,
    name: l('Analytics', 'Analítica'),
    shortDescription: l('Track traffic, leads and growth in real time.', 'Mide tráfico, contactos y crecimiento en tiempo real.'),
    eyebrow: l('Analytics', 'Analítica'),
    heroTitle: l('Know what is working — and what is not.', 'Sabe qué funciona y qué no.'),
    heroDescription: l(
      'Clear dashboards that connect website traffic to leads and customers, without needing a data team.',
      'Paneles claros que conectan el tráfico del sitio con contactos y clientes, sin necesitar un equipo de datos.',
    ),
    visual: 'analytics',
    benefits: [
      { title: l('Plain-language reports', 'Informes claros'), description: l('Metrics that matter, explained simply.', 'Las métricas importantes, explicadas con claridad.') },
      { title: l('Traffic to revenue', 'Del tráfico al ingreso'), description: l('Connect visits to leads and booked work.', 'Conecta visitas con contactos y trabajos.') },
      { title: l('Better decisions', 'Mejores decisiones'), description: l('Invest where results actually come from.', 'Invierte donde realmente están los resultados.') },
    ],
    problems: [
      { title: l('Guesswork', 'Suposiciones'), description: l('No idea where customers find you.', 'Sin idea de dónde te encuentran los clientes.') },
      { title: l('Too many dashboards', 'Demasiados paneles'), description: l('Data split across tools that do not agree.', 'Datos repartidos en herramientas que no coinciden.') },
      { title: l('Vanity metrics', 'Métricas de vanidad'), description: l('Page views without lead context.', 'Visitas sin contexto de contactos.') },
    ],
    features: [
      { icon: 'dashboard', title: l('Growth dashboard', 'Panel de crecimiento'), description: l('Traffic, leads and conversions in one view.', 'Tráfico, contactos y conversiones en una vista.') },
      { icon: 'target', title: l('Lead attribution', 'Atribución de contactos'), description: l('See which pages and campaigns perform.', 'Ve qué páginas y campañas rinden.') },
      { icon: 'trending', title: l('Trends', 'Tendencias'), description: l('Compare periods and spot changes.', 'Compara periodos y detecta cambios.') },
      { icon: 'file', title: l('Reports', 'Informes'), description: l('Scheduled summaries for your team.', 'Resúmenes programados para tu equipo.') },
    ],
    industries: ['financial-services', 'real-estate', 'restaurants', 'med-spas'],
    relatedServices: ['crm', 'campaigns', 'website-redesign'],
    faq: [
      { question: l('Is analytics privacy-friendly?', '¿La analítica respeta la privacidad?'), answer: l('We configure analytics with privacy in mind and help you meet consent requirements.', 'Configuramos la analítica pensando en la privacidad y te ayudamos con el consentimiento.') },
      { question: l('Can I connect other tools?', '¿Puedo conectar otras herramientas?'), answer: l('Additional integrations are planned and can be scoped on custom plans.', 'Hay más integraciones planificadas y pueden definirse en planes personalizados.') },
    ],
  },
  {
    slug: 'maintenance',
    icon: 'wrench',
    enabled: true,
    name: l('Maintenance', 'Mantenimiento'),
    shortDescription: l('Updates, backups and security handled for you.', 'Actualizaciones, respaldos y seguridad a nuestro cargo.'),
    eyebrow: l('Ongoing maintenance', 'Mantenimiento continuo'),
    heroTitle: l('Your website, kept current.', 'Tu sitio web, siempre al día.'),
    heroDescription: l(
      'Content updates, security patches, backups and improvements — handled by a team that knows your site.',
      'Actualizaciones de contenido, parches de seguridad, respaldos y mejoras, a cargo de un equipo que conoce tu sitio.',
    ),
    visual: 'infrastructure',
    benefits: [
      { title: l('Always up to date', 'Siempre actualizado'), description: l('Security and platform updates applied for you.', 'Actualizaciones de seguridad y plataforma aplicadas por nosotros.') },
      { title: l('Change requests', 'Solicitudes de cambio'), description: l('Ask for updates without hiring a developer.', 'Pide cambios sin contratar a un desarrollador.') },
      { title: l('Peace of mind', 'Tranquilidad'), description: l('Backups and monitoring in place.', 'Respaldos y monitoreo en marcha.') },
    ],
    problems: [
      { title: l('Neglected sites', 'Sitios descuidados'), description: l('Launched once, never touched again.', 'Lanzados una vez y nunca más tocados.') },
      { title: l('Freelancer disappeared', 'El freelancer desapareció'), description: l('No one to call when something breaks.', 'Nadie a quien llamar cuando algo falla.') },
      { title: l('Stale content', 'Contenido viejo'), description: l('Old prices, hours and services confuse customers.', 'Precios, horarios y servicios viejos confunden.') },
    ],
    features: [
      { icon: 'shield', title: l('Security updates', 'Actualizaciones de seguridad'), description: l('Regular patches and hardening.', 'Parches regulares y refuerzo.') },
      { icon: 'backup', title: l('Backups', 'Respaldos'), description: l('Restore points when you need them.', 'Puntos de restauración cuando los necesites.') },
      { icon: 'file', title: l('Content edits', 'Edición de contenido'), description: l('Text, image and page updates on request.', 'Cambios de texto, imágenes y páginas a pedido.') },
      { icon: 'headphones', title: l('Human support', 'Soporte humano'), description: l('Real people who know your project.', 'Personas reales que conocen tu proyecto.') },
    ],
    industries: ['dental', 'legal', 'outpatient-medical', 'clinical-research'],
    relatedServices: ['hosting', 'domains', 'analytics'],
    faq: [
      { question: l('How do I request changes?', '¿Cómo pido cambios?'), answer: l('Through your project lead today, and through the WebXXL client portal once available.', 'Hoy a través de tu líder de proyecto y, pronto, desde el portal de clientes WebXXL.') },
      { question: l('How many changes are included?', '¿Cuántos cambios se incluyen?'), answer: l('Included maintenance varies by plan and is confirmed in your agreement.', 'El mantenimiento incluido varía por plan y se confirma en tu acuerdo.') },
    ],
  },
  {
    slug: 'ecommerce',
    icon: 'cart',
    enabled: true,
    name: l('E-commerce', 'Comercio electrónico'),
    shortDescription: l('Sell products, gift cards and services online.', 'Vende productos, tarjetas de regalo y servicios en línea.'),
    eyebrow: l('E-commerce', 'Comercio electrónico'),
    heroTitle: l('Sell online without the complexity.', 'Vende en línea sin complicaciones.'),
    heroDescription: l(
      'Product catalogs, gift cards, packages and service deposits — built into your WebXXL website and connected to your customer records.',
      'Catálogos, tarjetas de regalo, paquetes y depósitos por servicios, integrados en tu sitio WebXXL y conectados a tus clientes.',
    ),
    visual: 'website',
    benefits: [
      { title: l('New revenue', 'Nuevos ingresos'), description: l('Sell products and packages around the clock.', 'Vende productos y paquetes a toda hora.') },
      { title: l('Connected customers', 'Clientes conectados'), description: l('Orders tied to CRM customer history.', 'Pedidos vinculados al historial del CRM.') },
      { title: l('Right-sized', 'A la medida'), description: l('Built for local businesses, not mega-retailers.', 'Hecho para negocios locales, no para grandes minoristas.') },
    ],
    problems: [
      { title: l('Separate store', 'Tienda separada'), description: l('A disconnected shop with a different look.', 'Una tienda desconectada con otro aspecto.') },
      { title: l('Manual orders', 'Pedidos manuales'), description: l('Taking orders by phone and email.', 'Tomar pedidos por teléfono y correo.') },
      { title: l('Overkill platforms', 'Plataformas excesivas'), description: l('Paying for features you will never use.', 'Pagar por funciones que nunca usarás.') },
    ],
    features: [
      { icon: 'box', title: l('Product catalog', 'Catálogo de productos'), description: l('Products, variants and inventory.', 'Productos, variantes e inventario.') },
      { icon: 'card', title: l('Checkout', 'Pago'), description: l('A secure, provider-agnostic checkout flow.', 'Un flujo de pago seguro e independiente del proveedor.') },
      { icon: 'sparkles', title: l('Gift cards & packages', 'Tarjetas y paquetes'), description: l('Sell bundles and prepaid services.', 'Vende paquetes y servicios prepagados.') },
      { icon: 'users', title: l('Customer records', 'Registros de clientes'), description: l('Orders synced to CRM.', 'Pedidos sincronizados con el CRM.') },
    ],
    industries: ['restaurants', 'med-spas', 'automotive', 'interior-design'],
    relatedServices: ['website-design', 'campaigns', 'analytics'],
    faq: [
      { question: l('Which payment processor do you use?', '¿Qué procesador de pagos usan?'), answer: l('Payment processing is being finalized. We will confirm supported options during your strategy call.', 'El procesamiento de pagos se está definiendo. Confirmaremos las opciones en tu llamada estratégica.') },
      { question: l('Can I sell services and products?', '¿Puedo vender servicios y productos?'), answer: l('Yes — products, packages, gift cards and deposits.', 'Sí: productos, paquetes, tarjetas de regalo y depósitos.') },
    ],
  },
  {
    slug: 'landing-pages',
    icon: 'template',
    enabled: true,
    name: l('Landing Pages', 'Páginas de aterrizaje'),
    shortDescription: l('Focused pages for campaigns, offers and ads.', 'Páginas enfocadas para campañas, ofertas y anuncios.'),
    eyebrow: l('Landing pages', 'Páginas de aterrizaje'),
    heroTitle: l('One offer. One page. One clear action.', 'Una oferta. Una página. Una acción clara.'),
    heroDescription: l(
      'High-focus landing pages for promotions, seasonal campaigns and paid ads — tracked end to end in your CRM.',
      'Páginas de alto enfoque para promociones, campañas de temporada y anuncios, con seguimiento completo en tu CRM.',
    ),
    visual: 'website',
    benefits: [
      { title: l('Launch quickly', 'Lanza rápido'), description: l('Reusable layouts for new offers.', 'Diseños reutilizables para nuevas ofertas.') },
      { title: l('Higher focus', 'Mayor enfoque'), description: l('No distractions between visitor and action.', 'Sin distracciones entre el visitante y la acción.') },
      { title: l('Clear attribution', 'Atribución clara'), description: l('Know exactly which campaign produced each lead.', 'Sabe qué campaña generó cada contacto.') },
    ],
    problems: [
      { title: l('Ads to the homepage', 'Anuncios a la portada'), description: l('Paid traffic lands on a generic page and leaves.', 'El tráfico pagado llega a una página genérica y se va.') },
      { title: l('Slow to launch', 'Lento de lanzar'), description: l('Every campaign needs a developer.', 'Cada campaña necesita un desarrollador.') },
      { title: l('Unknown ROI', 'Retorno desconocido'), description: l('Spend without knowing what worked.', 'Gastar sin saber qué funcionó.') },
    ],
    features: [
      { icon: 'template', title: l('Campaign layouts', 'Diseños de campaña'), description: l('Proven structures for offers.', 'Estructuras probadas para ofertas.') },
      { icon: 'file', title: l('Embedded forms', 'Formularios integrados'), description: l('Capture leads right on the page.', 'Capta contactos en la misma página.') },
      { icon: 'target', title: l('Campaign tracking', 'Seguimiento de campañas'), description: l('Source and UTM data saved to CRM.', 'Origen y UTM guardados en el CRM.') },
      { icon: 'languages', title: l('Localized versions', 'Versiones localizadas'), description: l('English and Spanish variants.', 'Variantes en inglés y español.') },
    ],
    industries: ['roofing', 'hvac', 'home-builders', 'real-estate'],
    relatedServices: ['lead-capture', 'campaigns', 'analytics'],
    faq: [
      { question: l('Can landing pages live on my domain?', '¿Pueden estar en mi dominio?'), answer: l('Yes. Landing pages are part of your WebXXL website.', 'Sí. Las páginas son parte de tu sitio WebXXL.') },
      { question: l('Do you run the ads too?', '¿También manejan los anuncios?'), answer: l('Ad management is not currently offered; we build pages that work with your ad campaigns.', 'La gestión de anuncios no se ofrece por ahora; creamos páginas que funcionan con tus campañas.') },
    ],
  },
]

export function getServices(): Service[] {
  return services.filter((s) => s.enabled)
}

export function getService(slug: string): Service | undefined {
  return getServices().find((s) => s.slug === slug)
}

export function getServicesBySlugs(slugs: string[]): Service[] {
  return slugs.map((slug) => getService(slug)).filter((s): s is Service => Boolean(s))
}
