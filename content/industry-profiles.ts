import type { IconName } from '@/lib/icons'
import type { Localized } from '@/lib/i18n/localize'
import type { IndustryProfile } from './industries'
import { l, type ContentItem, type FaqItem, type FeatureItem } from './types'

/*
 * Industry-specific landing page content. Keyed by industry slug and merged into the
 * base records in content/industries.ts. Every field is optional — the shared
 * IndustryPage template falls back to generic copy for anything omitted.
 *
 * Content rules: no invented client metrics, no guaranteed outcomes, no regulated claims.
 * Mockup brands are generic placeholders and are labelled as demo concepts in the UI.
 */

const list = (en: string[], es: string[]): Localized<string[]> => ({ en, es })
const item = (enTitle: string, enDesc: string, esTitle: string, esDesc: string): ContentItem => ({
  title: l(enTitle, esTitle),
  description: l(enDesc, esDesc),
})
const feature = (icon: IconName, enTitle: string, enDesc: string, esTitle: string, esDesc: string): FeatureItem => ({
  icon,
  ...item(enTitle, enDesc, esTitle, esDesc),
})
const faq = (enQ: string, enA: string, esQ: string, esA: string): FaqItem => ({ question: l(enQ, esQ), answer: l(enA, esA) })

export const industryProfiles: Record<string, IndustryProfile> = {
  // ---------------------------------------------------------------- HVAC (reference implementation)
  hvac: {
    hero: {
      title: l('Websites & CRM built for HVAC companies.', 'Sitios web y CRM para empresas de HVAC.'),
      description: l(
        'Generate more service calls, installation leads and maintenance-plan customers with a website built around how HVAC businesses actually sell — emergencies, replacements and seasonal tune-ups.',
        'Genera más llamadas de servicio, prospectos de instalación y clientes de planes de mantenimiento con un sitio pensado en cómo venden las empresas de HVAC: urgencias, reemplazos y ajustes de temporada.',
      ),
    },
    heroVisual: {
      type: 'industryMockup',
      brand: l('Your HVAC Co.', 'Tu empresa HVAC'),
      headline: l('Fast, reliable heating & cooling', 'Calefacción y aire, rápido y confiable'),
      subhead: l('Same-day AC repair, system replacements and maintenance plans.', 'Reparación de aire el mismo día, reemplazos y planes de mantenimiento.'),
      primaryCta: l('Book Service', 'Agendar servicio'),
      secondaryCta: l('Call Now', 'Llamar ahora'),
      badges: list(['24/7 emergency service', 'Financing available', 'Maintenance plans'], ['Urgencias 24/7', 'Financiamiento disponible', 'Planes de mantenimiento']),
      image: '/images/industries/hvac-hero.png',
      imageAlt: l('HVAC technician servicing an outdoor air conditioning unit', 'Técnico de HVAC dando servicio a una unidad exterior de aire acondicionado'),
    },
    conversionGoals: list(
      ['Emergency AC & heating calls', 'System replacement estimates', 'Maintenance-plan signups', 'Seasonal tune-ups', 'Appointment requests', 'Financing inquiries'],
      ['Llamadas urgentes de aire y calefacción', 'Presupuestos de reemplazo de equipos', 'Registros a planes de mantenimiento', 'Ajustes de temporada', 'Solicitudes de cita', 'Consultas de financiamiento'],
    ),
    painPoints: [
      item('Emergency calls go to whoever answers first', 'When a system fails at night, homeowners call the first number they find. If your site is slow or buries the phone number, that call goes elsewhere.', 'Las urgencias son para quien contesta primero', 'Cuando un equipo falla de noche, el cliente llama al primer número que encuentra. Si tu sitio es lento o esconde el teléfono, esa llamada se va.'),
      item('Replacement leads need more than a contact form', 'System replacements are high-ticket decisions. Without financing info, options and trust signals, visitors leave to compare.', 'Los reemplazos necesitan más que un formulario', 'Reemplazar un equipo es una decisión costosa. Sin financiamiento, opciones y señales de confianza, el visitante se va a comparar.'),
      item('Slow seasons are hard to fill', 'Without a way to reach past customers, tune-up and maintenance revenue depends on them remembering to call you.', 'Las temporadas bajas cuestan', 'Sin una forma de contactar a clientes anteriores, los ajustes y el mantenimiento dependen de que ellos recuerden llamarte.'),
    ],
    websiteFeatures: [
      feature('zap', 'Click-to-call everywhere', 'A persistent call button and emergency banner on every page, sized for phones.', 'Clic para llamar en todo el sitio', 'Botón de llamada fijo y aviso de urgencias en cada página, pensado para móviles.'),
      feature('snowflake', 'Service pages that sell', 'Dedicated pages for AC repair, furnace repair, heat pumps, installs and indoor air quality.', 'Páginas de servicio que venden', 'Páginas para reparación de aire, calefacción, bombas de calor, instalaciones y calidad del aire.'),
      feature('card', 'Financing & replacement info', 'Explain financing options and what to expect from a replacement before the estimate visit.', 'Financiamiento y reemplazos', 'Explica opciones de financiamiento y qué esperar de un reemplazo antes de la visita.'),
      feature('refresh', 'Maintenance-plan signups', 'Describe plan benefits and capture signups that flow straight into your CRM.', 'Registro a planes de mantenimiento', 'Describe los beneficios del plan y capta registros que llegan directo a tu CRM.'),
      feature('calendar', 'Appointment requests', 'Let customers request a time window for service or a replacement estimate.', 'Solicitudes de cita', 'Permite pedir un horario para servicio o un presupuesto de reemplazo.'),
      feature('handshake', 'Reviews & social proof', 'Showcase reviews, certifications and licensing near every call to action.', 'Reseñas y prueba social', 'Muestra reseñas, certificaciones y licencias junto a cada llamada a la acción.'),
    ],
    leadCapture: {
      title: l('A lead-capture strategy built for HVAC urgency', 'Captación de prospectos pensada para la urgencia del HVAC'),
      description: l('Different visitors need different next steps. We design separate paths for urgent repairs, planned replacements and maintenance.', 'Cada visitante necesita un siguiente paso distinto. Diseñamos rutas separadas para reparaciones urgentes, reemplazos planeados y mantenimiento.'),
      items: list(
        ['Emergency path: call button and short "no heat / no cool" form', 'Replacement path: estimate request with system age and home size', 'Maintenance path: plan signup with preferred visit season', 'Every submission tagged by service type and source'],
        ['Ruta urgente: botón de llamada y formulario corto "sin calefacción / sin aire"', 'Ruta de reemplazo: presupuesto con antigüedad del equipo y tamaño de la casa', 'Ruta de mantenimiento: registro al plan con temporada preferida', 'Cada envío etiquetado por tipo de servicio y origen'],
      ),
    },
    crmFeatures: list(
      ['Route emergency requests to the on-call technician', 'Track replacement estimates through your pipeline', 'Manage maintenance-plan members and renewal dates', 'Automated follow-up after unsold estimates', 'SMS appointment confirmations and reminders'],
      ['Dirige urgencias al técnico de guardia', 'Da seguimiento a presupuestos de reemplazo en tu embudo', 'Gestiona miembros de planes y fechas de renovación', 'Seguimiento automático de presupuestos no cerrados', 'Confirmaciones y recordatorios de cita por SMS'],
    ),
    campaigns: {
      title: l('Seasonal campaigns that fill the schedule', 'Campañas de temporada que llenan la agenda'),
      description: l('Use your customer list to stay busy year-round instead of waiting for the phone to ring.', 'Usa tu lista de clientes para mantenerte ocupado todo el año en vez de esperar a que suene el teléfono.'),
      items: [
        item('Spring AC tune-up', 'Remind past customers to service their AC before the first heat wave.', 'Ajuste de aire en primavera', 'Recuerda a clientes anteriores revisar su aire antes de la primera ola de calor.'),
        item('Fall furnace check', 'Book heating inspections before demand peaks.', 'Revisión de calefacción en otoño', 'Agenda inspecciones antes de que suba la demanda.'),
        item('Maintenance-plan renewals', 'Automatic reminders before memberships expire.', 'Renovación de planes', 'Recordatorios automáticos antes de que venzan las membresías.'),
        item('Replacement follow-up', 'Nurture homeowners who received an estimate but have not decided.', 'Seguimiento de reemplazos', 'Mantén el contacto con quienes recibieron un presupuesto y aún no deciden.'),
      ],
    },
    localSeo: {
      title: l('Show up where you actually work', 'Aparece donde realmente trabajas'),
      description: l('HVAC is local. Your site is structured so search engines and AI assistants understand which services you offer and where.', 'El HVAC es local. Tu sitio se estructura para que buscadores y asistentes de IA entiendan qué servicios ofreces y dónde.'),
      items: list(
        ['Service-area pages for each city or region you cover', 'Structured business data (hours, phone, service areas)', 'Service + location page combinations', 'Google Business Profile alignment', 'Fast, mobile-first pages'],
        ['Páginas por zona para cada ciudad o región que atiendes', 'Datos estructurados del negocio (horario, teléfono, zonas)', 'Combinaciones de servicio + ubicación', 'Alineación con tu perfil de Google Business', 'Páginas rápidas y pensadas para móvil'],
      ),
    },
    trustPoints: list(
      ['License & insurance display', 'Manufacturer certifications', 'Review highlights', 'Warranty information'],
      ['Licencias y seguros visibles', 'Certificaciones de fabricantes', 'Reseñas destacadas', 'Información de garantía'],
    ),
    integrations: list(
      ['Online booking tools', 'Financing provider links', 'Google Business Profile', 'Review platforms', 'Google Analytics'],
      ['Herramientas de reserva en línea', 'Enlaces a financiadoras', 'Perfil de Google Business', 'Plataformas de reseñas', 'Google Analytics'],
    ),
    promotion: {
      title: l('Idea: a "Tune-up season" lead offer', 'Idea: oferta de "temporada de ajustes"'),
      description: l('A dedicated landing page with a simple signup that feeds a seasonal CRM campaign. Offer terms are set by you.', 'Una landing dedicada con un registro sencillo que alimenta una campaña de temporada en el CRM. Tú defines los términos de la oferta.'),
    },
    ctas: {
      primary: l('Build My HVAC Website', 'Crear mi sitio de HVAC'),
      secondary: l('Get More HVAC Leads', 'Más prospectos de HVAC'),
      bandTitle: l('Ready to get more HVAC service calls?', '¿Listo para recibir más llamadas de servicio?'),
      bandDescription: l('Tell us about your service area and the jobs you want more of. We will map out the website and CRM setup.', 'Cuéntanos tu zona de servicio y qué trabajos quieres más. Planearemos el sitio y el CRM.'),
    },
    faq: [
      faq('Can the website handle emergency calls differently from regular service?', 'Yes. We design a separate emergency path with prominent click-to-call and a short form, so urgent requests are easy to spot in your CRM.', '¿El sitio puede tratar las urgencias distinto al servicio normal?', 'Sí. Diseñamos una ruta de urgencias con clic para llamar y un formulario corto, para que las solicitudes urgentes se identifiquen fácilmente en tu CRM.'),
      faq('Can you add maintenance-plan signups?', 'Yes. We can build a plan page with a signup form, and the CRM can track members and remind them about renewals.', '¿Pueden agregar registros a planes de mantenimiento?', 'Sí. Creamos una página del plan con formulario, y el CRM registra a los miembros y les recuerda la renovación.'),
      faq('Do you create pages for each city we serve?', 'We can create service-area pages for the locations you cover, written for each area rather than copied.', '¿Crean páginas para cada ciudad que atendemos?', 'Podemos crear páginas por zona para cada ubicación, redactadas para cada área en lugar de copiadas.'),
      faq('Can we show financing options?', 'Yes. We can present financing information and link to your financing provider. Terms and approvals are handled by your provider.', '¿Podemos mostrar opciones de financiamiento?', 'Sí. Presentamos la información y enlazamos a tu financiadora. Los términos y aprobaciones los maneja tu proveedor.'),
    ],
    seo: {
      title: l('HVAC Website Design & CRM', 'Diseño web y CRM para HVAC'),
      description: l('Websites and CRM built for HVAC companies: emergency click-to-call, replacement estimate requests, maintenance-plan signups, seasonal campaigns and service-area pages.', 'Sitios web y CRM para empresas de HVAC: clic para llamar en urgencias, presupuestos de reemplazo, planes de mantenimiento, campañas de temporada y páginas por zona.'),
    },
    relatedIndustries: ['plumbing', 'electricians', 'roofing', 'home-builders'],
  },

  // ---------------------------------------------------------------- Roofing
  roofing: {
    hero: {
      title: l('Roofing websites that turn storms into booked inspections.', 'Sitios de techado que convierten tormentas en inspecciones agendadas.'),
      description: l('Capture inspection requests, explain the insurance-claim process and show your project work — with a CRM that tracks every estimate to close.', 'Capta solicitudes de inspección, explica el proceso de reclamo al seguro y muestra tus proyectos, con un CRM que sigue cada presupuesto hasta el cierre.'),
    },
    heroVisual: {
      type: 'industryMockup',
      brand: l('Your Roofing Co.', 'Tu empresa de techos'),
      headline: l('Roof repair & replacement you can trust', 'Reparación y reemplazo de techos de confianza'),
      subhead: l('Free inspections, storm damage help and financing options.', 'Inspecciones gratuitas, ayuda por daños de tormenta y financiamiento.'),
      primaryCta: l('Request Inspection', 'Pedir inspección'),
      secondaryCta: l('View Projects', 'Ver proyectos'),
      badges: list(['Storm damage', 'Insurance claim guidance', 'Warranty info'], ['Daños por tormenta', 'Guía de reclamos', 'Garantías']),
      image: '/images/case-studies/carter-roofing.png',
      imageAlt: l('Residential home with a newly installed roof', 'Casa residencial con techo recién instalado'),
    },
    conversionGoals: list(
      ['Free inspection requests', 'Storm damage leads', 'Replacement estimates', 'Insurance claim questions', 'Financing inquiries'],
      ['Solicitudes de inspección', 'Prospectos por daños de tormenta', 'Presupuestos de reemplazo', 'Dudas sobre reclamos al seguro', 'Consultas de financiamiento'],
    ),
    painPoints: [
      item('Storm demand arrives all at once', 'After a storm, inquiries spike. Without organized intake, leads get lost in voicemail and inboxes.', 'La demanda llega de golpe', 'Tras una tormenta, las consultas se disparan. Sin un registro ordenado, se pierden en buzones y correos.'),
      item('Homeowners do not trust unknown roofers', 'Visitors want proof: real project photos, licensing, warranties and reviews before they book.', 'Desconfianza hacia techadores desconocidos', 'Los visitantes quieren pruebas: fotos reales, licencias, garantías y reseñas antes de agendar.'),
      item('Long sales cycles between estimate and contract', 'Replacements involve insurance and big decisions. Estimates go cold without follow-up.', 'Ciclos largos entre presupuesto y contrato', 'Los reemplazos implican seguros y decisiones grandes. Sin seguimiento, los presupuestos se enfrían.'),
    ],
    websiteFeatures: [
      feature('search', 'Inspection request forms', 'Short forms that capture address, roof issue and photos.', 'Formularios de inspección', 'Formularios cortos con dirección, problema y fotos.'),
      feature('template', 'Project galleries', 'Before-and-after galleries organized by roof type and material.', 'Galerías de proyectos', 'Antes y después organizados por tipo de techo y material.'),
      feature('file', 'Insurance claim guidance', 'Plain-language pages explaining how the claim process typically works.', 'Guía de reclamos al seguro', 'Páginas claras sobre cómo suele funcionar el proceso de reclamo.'),
      feature('shield', 'Warranty & credentials', 'Licensing, insurance and manufacturer warranty information up front.', 'Garantías y credenciales', 'Licencias, seguros y garantías del fabricante a la vista.'),
    ],
    leadCapture: {
      title: l('Separate paths for storm damage and planned replacements', 'Rutas separadas para tormentas y reemplazos planeados'),
      items: list(['Storm damage form with photo upload', 'Replacement estimate request', 'Financing interest checkbox', 'Lead source tracking for campaigns'], ['Formulario de daños con fotos', 'Solicitud de presupuesto de reemplazo', 'Casilla de interés en financiamiento', 'Origen del prospecto para campañas']),
    },
    crmFeatures: list(['Pipeline from inspection to signed contract', 'Follow-up reminders for open estimates', 'Notes for insurance adjuster appointments', 'Post-project review requests'], ['Embudo de inspección a contrato firmado', 'Recordatorios para presupuestos abiertos', 'Notas para citas con ajustadores', 'Solicitud de reseñas al terminar']),
    localSeo: {
      title: l('Local visibility when storms hit your area', 'Visibilidad local cuando llegan tormentas'),
      description: l('Service-area pages help homeowners in each community find you when they need a roofer.', 'Las páginas por zona ayudan a los propietarios de cada comunidad a encontrarte.'),
      items: list(['City and neighborhood service pages', 'Roof-type service pages', 'Structured business data'], ['Páginas por ciudad y vecindario', 'Páginas por tipo de techo', 'Datos estructurados del negocio']),
    },
    trustPoints: list(['License & insurance', 'Manufacturer warranties', 'Project photos', 'Reviews'], ['Licencias y seguros', 'Garantías del fabricante', 'Fotos de proyectos', 'Reseñas']),
    ctas: { primary: l('Build My Roofing Website', 'Crear mi sitio de techado'), bandTitle: l('Ready to book more roof inspections?', '¿Listo para agendar más inspecciones?') },
    faq: [
      faq('Can homeowners upload photos of roof damage?', 'Yes. Inspection forms can include photo uploads so you can assess the job before visiting.', '¿Los propietarios pueden subir fotos del daño?', 'Sí. Los formularios pueden incluir fotos para evaluar el trabajo antes de la visita.'),
      faq('Do you write the insurance claim content?', 'We help you present general guidance in plain language. You review it for accuracy; we do not provide legal or insurance advice.', '¿Ustedes redactan el contenido sobre reclamos?', 'Te ayudamos a presentar una guía general clara. Tú revisas su exactitud; no damos asesoría legal ni de seguros.'),
      faq('Can we showcase past projects?', 'Yes. Project galleries can be organized by material, roof type or location.', '¿Podemos mostrar proyectos anteriores?', 'Sí. Las galerías pueden organizarse por material, tipo de techo o ubicación.'),
    ],
    seo: {
      title: l('Roofing Website Design & Lead Generation', 'Diseño web y captación de prospectos para techado'),
      description: l('Roofing websites with inspection request forms, storm damage pages, insurance claim guidance, project galleries and a CRM to follow every estimate.', 'Sitios de techado con solicitudes de inspección, páginas de tormentas, guía de reclamos, galerías de proyectos y CRM para cada presupuesto.'),
    },
    relatedIndustries: ['general-contractors', 'remodeling', 'hvac', 'painting'],
  },

  // ---------------------------------------------------------------- Plumbing
  plumbing: {
    hero: {
      title: l('Plumbing websites built for the emergency call.', 'Sitios de plomería pensados para la llamada urgente.'),
      description: l('Make it effortless to call you for a burst pipe, book a water heater install or request drain service — and keep every lead organized in your CRM.', 'Facilita que te llamen por una tubería rota, agenden un calentador o pidan destapar drenajes, y organiza cada prospecto en tu CRM.'),
    },
    heroVisual: {
      type: 'industryMockup',
      brand: l('Your Plumbing Co.', 'Tu empresa de plomería'),
      headline: l('Trusted plumbing experts in your area', 'Plomeros de confianza en tu zona'),
      subhead: l('Emergency repairs, drains, sewer and water heaters.', 'Reparaciones urgentes, drenajes, alcantarillado y calentadores.'),
      primaryCta: l('Call Now', 'Llamar ahora'),
      secondaryCta: l('Book Online', 'Reservar'),
      badges: list(['24/7 emergency', 'Licensed & insured', 'Upfront estimates'], ['Urgencias 24/7', 'Licencia y seguro', 'Presupuestos claros']),
      image: '/images/showcase/plumbing-hero.png',
      imageAlt: l('Plumber at work', 'Plomero trabajando'),
    },
    conversionGoals: list(['Emergency calls', 'Drain & sewer service', 'Water heater installs', 'Appointment requests', 'Service-area visibility'], ['Llamadas urgentes', 'Drenajes y alcantarillado', 'Instalación de calentadores', 'Solicitudes de cita', 'Visibilidad por zona']),
    painPoints: [
      item('Emergencies do not wait', 'A leaking pipe means the customer calls the first plumber whose number they can tap.', 'Las urgencias no esperan', 'Con una fuga, el cliente llama al primer plomero cuyo número pueda tocar.'),
      item('Services are hard to find on the site', 'Drain, sewer, water heater and repiping work all need clear, separate pages.', 'Los servicios no se encuentran', 'Drenajes, alcantarillado, calentadores y tuberías necesitan páginas claras y separadas.'),
      item('After-hours leads get lost', 'Messages left overnight are often forgotten by morning without a system.', 'Se pierden los prospectos nocturnos', 'Sin un sistema, los mensajes de la noche se olvidan por la mañana.'),
    ],
    websiteFeatures: [
      feature('zap', 'Click-to-call on every page', 'Sticky mobile call bar and emergency banner.', 'Clic para llamar en cada página', 'Barra de llamada fija en móvil y aviso de urgencias.'),
      feature('droplet', 'Service-specific pages', 'Drains, sewer, water heaters, leaks and fixtures.', 'Páginas por servicio', 'Drenajes, alcantarillado, calentadores, fugas y accesorios.'),
      feature('calendar', 'Appointment requests', 'Non-urgent jobs can request a time window online.', 'Solicitudes de cita', 'Los trabajos no urgentes pueden pedir horario en línea.'),
      feature('globe', 'Service-area pages', 'Pages for each community you serve.', 'Páginas por zona', 'Páginas para cada comunidad que atiendes.'),
    ],
    crmFeatures: list(['Instant alerts for emergency requests', 'After-hours lead queue for the morning', 'Job reminders by SMS', 'Water heater and annual inspection follow-ups'], ['Alertas inmediatas de urgencias', 'Cola de prospectos nocturnos', 'Recordatorios de trabajo por SMS', 'Seguimiento de calentadores e inspecciones anuales']),
    trustPoints: list(['Licensing', 'Upfront pricing policy', 'Reviews', 'Guarantee terms'], ['Licencias', 'Política de precios claros', 'Reseñas', 'Términos de garantía']),
    ctas: { primary: l('Build My Plumbing Website', 'Crear mi sitio de plomería'), bandTitle: l('Ready to be the plumber they call first?', '¿Listo para ser el plomero al que llaman primero?') },
    faq: [
      faq('Can the call button stay visible on phones?', 'Yes. We use a persistent mobile call bar so customers can call from any page.', '¿El botón de llamada queda visible en móvil?', 'Sí. Usamos una barra fija para llamar desde cualquier página.'),
      faq('Can we separate emergency and scheduled work?', 'Yes. Emergency and appointment requests are captured differently and labeled in the CRM.', '¿Podemos separar urgencias de trabajos programados?', 'Sí. Se captan por separado y quedan etiquetados en el CRM.'),
      faq('Do you build pages for each service area?', 'Yes, we can create pages for each community you serve.', '¿Hacen páginas por zona de servicio?', 'Sí, podemos crear páginas para cada comunidad que atiendes.'),
    ],
    seo: {
      title: l('Plumbing Website Design & CRM', 'Diseño web y CRM para plomería'),
      description: l('Plumbing websites with click-to-call, emergency service pages, drain and water heater pages, service-area SEO and CRM follow-up.', 'Sitios de plomería con clic para llamar, páginas de urgencias, drenajes y calentadores, SEO por zona y seguimiento en CRM.'),
    },
    relatedIndustries: ['hvac', 'electricians', 'remodeling', 'general-contractors'],
  },

  // ---------------------------------------------------------------- Electricians
  electricians: {
    hero: {
      title: l('Electrician websites that win quote requests.', 'Sitios para electricistas que generan cotizaciones.'),
      description: l('Showcase licensing and safety, then make it simple to request a quote for panel upgrades, EV chargers, rewiring or emergency electrical work.', 'Muestra licencias y seguridad, y facilita cotizar cambios de panel, cargadores eléctricos, recableado o urgencias.'),
    },
    heroVisual: {
      type: 'industryMockup',
      brand: l('Your Electric Co.', 'Tu empresa eléctrica'),
      headline: l('Licensed electricians for home & business', 'Electricistas certificados para hogar y negocio'),
      subhead: l('Panel upgrades, EV chargers, lighting and emergency repairs.', 'Paneles, cargadores eléctricos, iluminación y urgencias.'),
      primaryCta: l('Request a Quote', 'Pedir cotización'),
      secondaryCta: l('Emergency Service', 'Urgencias'),
      badges: list(['Licensed & insured', 'EV charger installs', 'Panel upgrades'], ['Licencia y seguro', 'Cargadores eléctricos', 'Cambio de paneles']),
    },
    conversionGoals: list(['Service upgrade quotes', 'EV charger installs', 'Panel replacements', 'Emergency electrical calls', 'Commercial project inquiries'], ['Cotizaciones de ampliación', 'Instalación de cargadores', 'Cambio de paneles', 'Urgencias eléctricas', 'Proyectos comerciales']),
    painPoints: [
      item('Trust is the first hurdle', 'Electrical work is safety-critical. Visitors look for licensing and insurance before anything else.', 'La confianza es lo primero', 'El trabajo eléctrico es delicado. Los visitantes buscan licencias y seguros antes que nada.'),
      item('Quote requests lack detail', 'Generic forms mean extra calls to understand panel size, location and scope.', 'Cotizaciones sin detalle', 'Los formularios genéricos obligan a llamar para entender el alcance.'),
      item('New services go unnoticed', 'EV chargers and smart-home work need their own pages to be found.', 'Servicios nuevos invisibles', 'Cargadores y hogar inteligente necesitan páginas propias para ser encontrados.'),
    ],
    websiteFeatures: [
      feature('shield', 'License & insurance badges', 'Credentials displayed near every call to action.', 'Distintivos de licencia', 'Credenciales junto a cada llamada a la acción.'),
      feature('zap', 'EV charger & panel pages', 'Dedicated pages for high-value upgrade work.', 'Páginas de cargadores y paneles', 'Páginas para trabajos de mayor valor.'),
      feature('file', 'Detailed quote forms', 'Capture service type, property type and photos.', 'Cotizaciones detalladas', 'Tipo de servicio, propiedad y fotos.'),
      feature('building', 'Commercial project pages', 'Show tenant improvements and commercial work.', 'Proyectos comerciales', 'Muestra adecuaciones y trabajos comerciales.'),
    ],
    crmFeatures: list(['Quote pipeline by service type', 'Emergency request alerts', 'Permit and inspection notes', 'Follow-up on unsigned quotes'], ['Embudo de cotizaciones por servicio', 'Alertas de urgencias', 'Notas de permisos e inspecciones', 'Seguimiento de cotizaciones pendientes']),
    trustPoints: list(['License numbers', 'Insurance', 'Safety practices', 'Reviews'], ['Números de licencia', 'Seguros', 'Prácticas de seguridad', 'Reseñas']),
    ctas: { primary: l('Build My Electrician Website', 'Crear mi sitio de electricista'), bandTitle: l('Ready to get more electrical quote requests?', '¿Listo para recibir más cotizaciones?') },
    faq: [
      faq('Can you add a page for EV charger installation?', 'Yes. We can create dedicated pages for EV chargers, panel upgrades and other specialty services.', '¿Pueden crear una página de cargadores eléctricos?', 'Sí. Creamos páginas dedicadas para cargadores, paneles y otros servicios.'),
      faq('Can the quote form collect photos?', 'Yes. Photo uploads help you scope jobs before visiting.', '¿La cotización puede incluir fotos?', 'Sí. Las fotos ayudan a evaluar el trabajo antes de ir.'),
      faq('Do you support commercial and residential?', 'Yes. We can structure the site with separate residential and commercial sections.', '¿Manejan residencial y comercial?', 'Sí. Estructuramos el sitio con secciones separadas.'),
    ],
    seo: {
      title: l('Electrician Website Design & Lead Generation', 'Diseño web para electricistas'),
      description: l('Electrician websites with license and insurance trust signals, EV charger and panel upgrade pages, detailed quote forms and CRM follow-up.', 'Sitios para electricistas con licencias visibles, páginas de cargadores y paneles, cotizaciones detalladas y seguimiento en CRM.'),
    },
    relatedIndustries: ['hvac', 'plumbing', 'general-contractors', 'home-builders'],
  },

  // ---------------------------------------------------------------- Landscaping
  landscaping: {
    hero: {
      title: l('Landscaping websites that fill your route.', 'Sitios de paisajismo que llenan tu ruta.'),
      description: l('Show your best projects, sign up recurring lawn-care customers and capture estimates for seasonal and design work.', 'Muestra tus mejores proyectos, suma clientes recurrentes de jardinería y capta presupuestos de temporada y diseño.'),
    },
    heroVisual: {
      type: 'industryMockup',
      brand: l('Your Landscaping Co.', 'Tu empresa de paisajismo'),
      headline: l('Beautiful yards, maintained all season', 'Jardines impecables toda la temporada'),
      subhead: l('Weekly lawn care, landscape design and seasonal cleanups.', 'Mantenimiento semanal, diseño de jardines y limpiezas de temporada.'),
      primaryCta: l('Get an Estimate', 'Pedir presupuesto'),
      secondaryCta: l('See Our Work', 'Ver trabajos'),
      badges: list(['Recurring service', 'Design & install', 'Seasonal cleanups'], ['Servicio recurrente', 'Diseño e instalación', 'Limpiezas de temporada']),
    },
    conversionGoals: list(['Recurring lawn-care signups', 'Landscape project estimates', 'Seasonal cleanups', 'Hardscape inquiries'], ['Registros de mantenimiento', 'Presupuestos de proyectos', 'Limpiezas de temporada', 'Consultas de hardscape']),
    painPoints: [
      item('Your work is visual, your site is not', 'Without strong galleries, visitors cannot see the quality that sets you apart.', 'Tu trabajo es visual, tu sitio no', 'Sin buenas galerías, el visitante no ve la calidad que te distingue.'),
      item('Recurring revenue is hard to grow', 'There is no simple way for customers to sign up for weekly or biweekly service.', 'Cuesta crecer lo recurrente', 'No hay una forma sencilla de inscribirse a servicio semanal o quincenal.'),
      item('Seasons change faster than your marketing', 'Spring cleanups and fall leaf removal need timely promotion.', 'Las temporadas cambian rápido', 'Las limpiezas de primavera y otoño necesitan promoción a tiempo.'),
    ],
    websiteFeatures: [
      feature('template', 'Before & after galleries', 'Project galleries organized by service type.', 'Galerías de antes y después', 'Proyectos organizados por servicio.'),
      feature('refresh', 'Recurring service signups', 'Let customers choose a service frequency.', 'Registro a servicio recurrente', 'El cliente elige la frecuencia.'),
      feature('file', 'Estimate forms', 'Capture property size, address and project goals.', 'Formularios de presupuesto', 'Tamaño, dirección y objetivos del proyecto.'),
      feature('globe', 'Service-area maps', 'Show the neighborhoods on your route.', 'Mapas de zonas', 'Muestra los vecindarios de tu ruta.'),
    ],
    crmFeatures: list(['Recurring customer list with service frequency', 'Estimate pipeline for projects', 'Seasonal reminder campaigns', 'Review requests after projects'], ['Clientes recurrentes con frecuencia', 'Embudo de presupuestos', 'Campañas de temporada', 'Solicitud de reseñas']),
    campaigns: {
      title: l('Seasonal campaigns', 'Campañas de temporada'),
      items: [
        item('Spring cleanup', 'Remind past customers to book early.', 'Limpieza de primavera', 'Recuerda a tus clientes reservar temprano.'),
        item('Fall leaf removal', 'Fill the calendar before the season ends.', 'Retiro de hojas en otoño', 'Llena la agenda antes de que termine la temporada.'),
        item('Project season', 'Promote design and hardscape work in the off-season.', 'Temporada de proyectos', 'Promueve diseño y hardscape en temporada baja.'),
      ],
    },
    ctas: { primary: l('Build My Landscaping Website', 'Crear mi sitio de paisajismo'), bandTitle: l('Ready to grow your recurring customers?', '¿Listo para sumar clientes recurrentes?') },
    faq: [
      faq('Can customers sign up for recurring service online?', 'Yes. A signup form can collect frequency and property details, and the CRM tracks recurring customers.', '¿Pueden inscribirse a servicio recurrente en línea?', 'Sí. Un formulario recoge frecuencia y datos, y el CRM registra a los clientes recurrentes.'),
      faq('Can we organize galleries by service?', 'Yes. Galleries can be grouped by lawn care, design, hardscape or seasonal work.', '¿Podemos ordenar galerías por servicio?', 'Sí. Por mantenimiento, diseño, hardscape o temporada.'),
      faq('Can you help with seasonal promotions?', 'Yes. We can set up landing pages and CRM campaigns for each season.', '¿Ayudan con promociones de temporada?', 'Sí. Creamos landings y campañas de CRM por temporada.'),
    ],
    seo: {
      title: l('Landscaping & Lawn Care Website Design', 'Diseño web para paisajismo y jardinería'),
      description: l('Landscaping websites with project galleries, recurring lawn-care signups, estimate forms, seasonal campaigns and service-area pages.', 'Sitios de paisajismo con galerías, registros recurrentes, presupuestos, campañas de temporada y páginas por zona.'),
    },
    relatedIndustries: ['painting', 'pest-control', 'remodeling', 'home-builders'],
  },

  // ---------------------------------------------------------------- Painting
  painting: {
    hero: {
      title: l('Painting websites that help customers picture the result.', 'Sitios de pintura que ayudan a imaginar el resultado.'),
      description: l('Portfolio-led pages for interior, exterior and commercial painting, with estimate requests that capture the details you need.', 'Páginas centradas en tu portafolio para pintura interior, exterior y comercial, con presupuestos que recogen los detalles necesarios.'),
    },
    heroVisual: {
      type: 'industryMockup',
      brand: l('Your Painting Co.', 'Tu empresa de pintura'),
      headline: l('Interior & exterior painting, done right', 'Pintura interior y exterior bien hecha'),
      subhead: l('Residential repaints, cabinets and commercial projects.', 'Repintado residencial, gabinetes y proyectos comerciales.'),
      primaryCta: l('Get an Estimate', 'Pedir presupuesto'),
      secondaryCta: l('View Portfolio', 'Ver portafolio'),
      badges: list(['Interior', 'Exterior', 'Commercial'], ['Interior', 'Exterior', 'Comercial']),
    },
    conversionGoals: list(['Estimate requests', 'Color consultations', 'Commercial bids', 'Cabinet refinishing inquiries'], ['Solicitudes de presupuesto', 'Asesorías de color', 'Licitaciones comerciales', 'Consultas de gabinetes']),
    websiteFeatures: [
      feature('template', 'Project portfolios', 'Before-and-after photos by room and surface.', 'Portafolios', 'Antes y después por espacio y superficie.'),
      feature('paint', 'Color consultation requests', 'Let homeowners ask for color guidance.', 'Asesoría de color', 'Los clientes pueden pedir orientación de color.'),
      feature('file', 'Estimate forms', 'Rooms, square footage and timing.', 'Presupuestos', 'Espacios, metraje y fechas.'),
      feature('building', 'Commercial pages', 'Property managers and commercial clients.', 'Páginas comerciales', 'Administradores y clientes comerciales.'),
    ],
    ctas: { primary: l('Build My Painting Website', 'Crear mi sitio de pintura') },
    seo: {
      title: l('Painting Contractor Website Design', 'Diseño web para pintores'),
      description: l('Painting contractor websites with project portfolios, color consultation requests, estimate forms and CRM follow-up for residential and commercial work.', 'Sitios para pintores con portafolios, asesorías de color, presupuestos y seguimiento en CRM.'),
    },
    relatedIndustries: ['remodeling', 'general-contractors', 'interior-design', 'landscaping'],
  },

  // ---------------------------------------------------------------- General contractors
  'general-contractors': {
    hero: {
      title: l('Contractor websites that win better-fit projects.', 'Sitios para contratistas que ganan mejores proyectos.'),
      description: l('Present your projects, process and credentials professionally, and route bid requests into a pipeline your team can manage.', 'Presenta tus proyectos, proceso y credenciales con profesionalismo, y organiza las solicitudes de licitación en un embudo.'),
    },
    heroVisual: {
      type: 'industryMockup',
      brand: l('Your Construction Co.', 'Tu constructora'),
      headline: l('Build and renovate with confidence', 'Construye y renueva con confianza'),
      subhead: l('Residential and commercial construction, start to finish.', 'Construcción residencial y comercial de principio a fin.'),
      primaryCta: l('Request a Bid', 'Pedir licitación'),
      secondaryCta: l('Our Projects', 'Proyectos'),
      badges: list(['Licensed & bonded', 'Project management', 'Commercial & residential'], ['Licencia y fianza', 'Gestión de proyectos', 'Comercial y residencial']),
    },
    conversionGoals: list(['Bid requests', 'Project consultations', 'Commercial inquiries', 'Subcontractor contacts'], ['Solicitudes de licitación', 'Consultas de proyecto', 'Consultas comerciales', 'Contacto de subcontratistas']),
    websiteFeatures: [
      feature('template', 'Project case pages', 'Scope, timeline and photos for each project.', 'Páginas de proyectos', 'Alcance, tiempos y fotos.'),
      feature('workflow', 'Process explanation', 'Show clients how projects run from bid to handover.', 'Explicación del proceso', 'Cómo avanza un proyecto de la licitación a la entrega.'),
      feature('file', 'Bid request forms', 'Capture budget range, timeline and plans.', 'Formularios de licitación', 'Presupuesto, plazos y planos.'),
      feature('shield', 'Credentials & insurance', 'Licensing, bonding and safety information.', 'Credenciales y seguros', 'Licencias, fianzas y seguridad.'),
    ],
    ctas: { primary: l('Build My Contractor Website', 'Crear mi sitio de contratista') },
    seo: {
      title: l('General Contractor Website Design & CRM', 'Diseño web y CRM para contratistas'),
      description: l('General contractor websites with project case pages, process explanations, bid request forms and a CRM pipeline for larger jobs.', 'Sitios para contratistas con proyectos, proceso, licitaciones y un embudo de CRM.'),
    },
    relatedIndustries: ['home-builders', 'remodeling', 'roofing', 'electricians'],
  },

  // ---------------------------------------------------------------- Pest control
  'pest-control': {
    hero: {
      title: l('Pest control websites that turn one-time calls into recurring plans.', 'Sitios de control de plagas que convierten llamadas en planes recurrentes.'),
      description: l('Capture urgent inspection requests, explain treatments by pest and convert customers to ongoing service plans.', 'Capta inspecciones urgentes, explica tratamientos por plaga y convierte clientes en planes de servicio.'),
    },
    heroVisual: {
      type: 'industryMockup',
      brand: l('Your Pest Control Co.', 'Tu empresa de control de plagas'),
      headline: l('Protect your home from pests', 'Protege tu hogar de las plagas'),
      subhead: l('Inspections, treatments and year-round protection plans.', 'Inspecciones, tratamientos y planes de protección todo el año.'),
      primaryCta: l('Book Inspection', 'Agendar inspección'),
      secondaryCta: l('Protection Plans', 'Planes'),
      badges: list(['Residential', 'Commercial', 'Recurring plans'], ['Residencial', 'Comercial', 'Planes recurrentes']),
    },
    conversionGoals: list(['Inspection bookings', 'Recurring plan signups', 'Commercial service inquiries', 'Seasonal treatments'], ['Inspecciones', 'Planes recurrentes', 'Servicio comercial', 'Tratamientos de temporada']),
    websiteFeatures: [
      feature('bug', 'Pest identification pages', 'Pages for each common pest in your area.', 'Páginas por plaga', 'Páginas para cada plaga común de tu zona.'),
      feature('calendar', 'Inspection booking', 'Fast requests for urgent problems.', 'Reserva de inspecciones', 'Solicitudes rápidas para problemas urgentes.'),
      feature('refresh', 'Recurring plan signups', 'Explain plan options and capture signups.', 'Registro a planes', 'Opciones de plan y registro.'),
      feature('bell', 'Service reminders', 'Automated reminders before each visit.', 'Recordatorios', 'Recordatorios antes de cada visita.'),
    ],
    ctas: { primary: l('Build My Pest Control Website', 'Crear mi sitio de control de plagas') },
    seo: {
      title: l('Pest Control Website Design & CRM', 'Diseño web y CRM para control de plagas'),
      description: l('Pest control websites with pest identification pages, inspection booking, recurring plan signups and automated service reminders.', 'Sitios de control de plagas con páginas por plaga, inspecciones, planes recurrentes y recordatorios.'),
    },
    relatedIndustries: ['landscaping', 'hvac', 'plumbing', 'home-builders'],
  },

  // ---------------------------------------------------------------- Home builders
  'home-builders': {
    hero: {
      title: l('Home builder websites for long buying journeys.', 'Sitios para constructores con ciclos de compra largos.'),
      description: l('Showcase communities, floor plans and custom builds, and nurture prospective buyers in your CRM until they are ready to tour.', 'Muestra comunidades, planos y obras a medida, y acompaña a los compradores en tu CRM hasta que estén listos para visitar.'),
    },
    heroVisual: {
      type: 'industryMockup',
      brand: l('Your Homes', 'Tus viviendas'),
      headline: l('New homes designed around your life', 'Casas nuevas pensadas para tu vida'),
      subhead: l('Explore communities, floor plans and custom builds.', 'Explora comunidades, planos y obras a medida.'),
      primaryCta: l('Schedule a Tour', 'Agendar visita'),
      secondaryCta: l('Floor Plans', 'Planos'),
      badges: list(['Communities', 'Floor plans', 'Custom builds'], ['Comunidades', 'Planos', 'A medida']),
    },
    conversionGoals: list(['Tour scheduling', 'Floor plan inquiries', 'Custom build consultations', 'Interest list signups'], ['Agenda de visitas', 'Consultas de planos', 'Consultas a medida', 'Listas de interés']),
    websiteFeatures: [
      feature('template', 'Floor plan galleries', 'Plans with specs and photos.', 'Galerías de planos', 'Planos con especificaciones y fotos.'),
      feature('globe', 'Community pages', 'Location, amenities and availability.', 'Páginas de comunidades', 'Ubicación, amenidades y disponibilidad.'),
      feature('calendar', 'Tour scheduling', 'Request a model home visit.', 'Agenda de visitas', 'Solicita visitar la casa modelo.'),
      feature('send', 'Buyer nurture sequences', 'Stay in touch through long decision cycles.', 'Seguimiento a compradores', 'Contacto en ciclos de decisión largos.'),
    ],
    ctas: { primary: l('Build My Home Builder Website', 'Crear mi sitio de constructor') },
    seo: {
      title: l('Home Builder Website Design & Buyer CRM', 'Diseño web y CRM para constructores de vivienda'),
      description: l('Home builder websites with community pages, floor plan galleries, tour scheduling and CRM nurture sequences for long buying cycles.', 'Sitios para constructores con comunidades, planos, agenda de visitas y seguimiento en CRM.'),
    },
    relatedIndustries: ['general-contractors', 'real-estate', 'remodeling', 'interior-design'],
  },

  // ---------------------------------------------------------------- Remodeling
  remodeling: {
    hero: {
      title: l('Remodeling websites that inspire the next project.', 'Sitios de remodelación que inspiran el próximo proyecto.'),
      description: l('Before-and-after galleries, cost guidance and financing information that lead homeowners to a design consultation.', 'Galerías de antes y después, guías de costos y financiamiento que llevan a una consulta de diseño.'),
    },
    heroVisual: {
      type: 'industryMockup',
      brand: l('Your Remodeling Co.', 'Tu empresa de remodelación'),
      headline: l('Kitchens and baths, transformed', 'Cocinas y baños transformados'),
      subhead: l('Design, build and finish — one team from start to end.', 'Diseño, obra y acabados con un solo equipo.'),
      primaryCta: l('Book a Consultation', 'Agendar consulta'),
      secondaryCta: l('Before & After', 'Antes y después'),
      badges: list(['Kitchens', 'Bathrooms', 'Financing options'], ['Cocinas', 'Baños', 'Financiamiento']),
    },
    conversionGoals: list(['Design consultations', 'Kitchen & bath estimates', 'Financing inquiries', 'Whole-home remodel leads'], ['Consultas de diseño', 'Presupuestos de cocina y baño', 'Consultas de financiamiento', 'Remodelaciones completas']),
    websiteFeatures: [
      feature('template', 'Before & after galleries', 'Organized by room and style.', 'Antes y después', 'Por espacio y estilo.'),
      feature('calendar', 'Consultation booking', 'Request an in-home design visit.', 'Reserva de consultas', 'Solicita una visita de diseño.'),
      feature('file', 'Project cost guides', 'Help homeowners set realistic expectations.', 'Guías de costos', 'Expectativas realistas.'),
      feature('card', 'Financing information', 'Explain available payment options.', 'Financiamiento', 'Explica las opciones de pago.'),
    ],
    ctas: { primary: l('Build My Remodeling Website', 'Crear mi sitio de remodelación') },
    seo: {
      title: l('Remodeling Contractor Website Design', 'Diseño web para remodelación'),
      description: l('Remodeling websites with before-and-after galleries, design consultation booking, project cost guides and financing information.', 'Sitios de remodelación con antes y después, consultas de diseño, guías de costos y financiamiento.'),
    },
    relatedIndustries: ['general-contractors', 'interior-design', 'painting', 'home-builders'],
  },

  // ---------------------------------------------------------------- Interior design
  'interior-design': {
    hero: {
      title: l('Interior design websites that reflect your style.', 'Sitios de diseño de interiores que reflejan tu estilo.'),
      description: l('A portfolio-first site that showcases your work and makes booking a consultation feel effortless.', 'Un sitio centrado en tu portafolio que facilita reservar una consulta.'),
    },
    heroVisual: {
      type: 'industryMockup',
      brand: l('Your Design Studio', 'Tu estudio de diseño'),
      headline: l('Spaces designed around you', 'Espacios diseñados para ti'),
      subhead: l('Residential and commercial interior design.', 'Diseño de interiores residencial y comercial.'),
      primaryCta: l('Book a Consultation', 'Agendar consulta'),
      secondaryCta: l('Portfolio', 'Portafolio'),
      badges: list(['Residential', 'Commercial', 'E-design'], ['Residencial', 'Comercial', 'Diseño en línea']),
    },
    conversionGoals: list(['Consultation bookings', 'Style questionnaire submissions', 'Commercial project inquiries'], ['Consultas', 'Cuestionarios de estilo', 'Proyectos comerciales']),
    ctas: { primary: l('Build My Design Website', 'Crear mi sitio de diseño') },
    seo: {
      title: l('Interior Designer Website Design', 'Diseño web para diseñadores de interiores'),
      description: l('Portfolio-first websites for interior designers with project collections, style questionnaires and consultation booking.', 'Sitios para diseñadores de interiores con portafolios, cuestionarios de estilo y reserva de consultas.'),
    },
    relatedIndustries: ['remodeling', 'home-builders', 'real-estate', 'painting'],
  },

  // ---------------------------------------------------------------- Med spas
  'med-spas': {
    hero: {
      title: l('Med spa websites that keep your book full.', 'Sitios para med spas que mantienen tu agenda llena.'),
      description: l('Treatment pages, consultation booking, memberships and automated rebooking — presented with the polish your clients expect.', 'Páginas de tratamientos, reserva de consultas, membresías y recordatorios automáticos, con la elegancia que tus clientes esperan.'),
    },
    heroVisual: {
      type: 'industryMockup',
      brand: l('Your Med Spa', 'Tu med spa'),
      headline: l('Look and feel your best', 'Luce y siéntete mejor'),
      subhead: l('Injectables, skin treatments and wellness memberships.', 'Inyectables, tratamientos de piel y membresías de bienestar.'),
      primaryCta: l('Book a Consultation', 'Reservar consulta'),
      secondaryCta: l('Treatments', 'Tratamientos'),
      badges: list(['Treatment menu', 'Memberships', 'Online booking'], ['Tratamientos', 'Membresías', 'Reserva en línea']),
      image: '/images/case-studies/luxe-aesthetics.png',
      imageAlt: l('Bright, modern med spa treatment room', 'Sala de tratamientos moderna y luminosa'),
    },
    conversionGoals: list(['Consultation bookings', 'Treatment inquiries', 'Membership signups', 'Rebooking', 'Gift card and promotion interest'], ['Reservas de consulta', 'Consultas de tratamientos', 'Membresías', 'Nuevas reservas', 'Interés en tarjetas y promociones']),
    painPoints: [
      item('Treatments are hard to compare', 'Clients want to understand each treatment, what to expect and how to prepare before booking.', 'Los tratamientos son difíciles de comparar', 'Los clientes quieren entender cada tratamiento y qué esperar antes de reservar.'),
      item('Clients forget to rebook', 'Many treatments need repeat visits, but reminders depend on staff remembering.', 'Los clientes olvidan volver', 'Muchos tratamientos requieren visitas repetidas, pero los recordatorios dependen del personal.'),
      item('The site does not match the experience', 'A dated website undercuts a premium in-person experience.', 'El sitio no está a la altura', 'Un sitio anticuado resta valor a una experiencia premium.'),
    ],
    websiteFeatures: [
      feature('sparkles', 'Treatment pages', 'What it is, who it is for, what to expect and aftercare.', 'Páginas de tratamientos', 'Qué es, para quién, qué esperar y cuidados.'),
      feature('calendar', 'Consultation booking', 'Connect to your booking tool or capture requests.', 'Reserva de consultas', 'Conecta tu sistema de reservas o capta solicitudes.'),
      feature('users', 'Membership pages', 'Explain membership benefits and capture signups.', 'Membresías', 'Beneficios y registro.'),
      feature('template', 'Results galleries', 'Before-and-after content where appropriate and consented.', 'Galerías de resultados', 'Antes y después cuando corresponda y con consentimiento.'),
    ],
    crmFeatures: list(['Rebooking reminders by treatment', 'Membership tracking', 'Consultation follow-ups', 'Promotion campaigns by email and SMS'], ['Recordatorios por tratamiento', 'Seguimiento de membresías', 'Seguimiento de consultas', 'Promociones por correo y SMS']),
    campaigns: {
      title: l('Campaigns that bring clients back', 'Campañas que hacen volver a los clientes'),
      items: [
        item('Rebooking reminders', 'Timed to each treatment’s typical interval.', 'Recordatorios', 'Según el intervalo habitual de cada tratamiento.'),
        item('Seasonal promotions', 'Holiday and event-based offers you define.', 'Promociones de temporada', 'Ofertas por fechas que tú defines.'),
        item('Membership nurture', 'Introduce memberships to repeat clients.', 'Membresías', 'Presenta membresías a clientes frecuentes.'),
      ],
    },
    ctas: { primary: l('Build My Med Spa Website', 'Crear mi sitio de med spa'), bandTitle: l('Ready to fill your appointment book?', '¿Listo para llenar tu agenda?') },
    faq: [
      faq('Can you connect our existing booking software?', 'In most cases we can link to or embed your booking tool. If not, we capture requests and send them to your CRM.', '¿Pueden conectar nuestro sistema de reservas?', 'En la mayoría de los casos podemos enlazarlo o integrarlo. Si no, captamos solicitudes y las enviamos a tu CRM.'),
      faq('Can we show before-and-after photos?', 'Yes, where appropriate. You are responsible for client consent and any applicable advertising rules.', '¿Podemos mostrar antes y después?', 'Sí, cuando corresponda. Tú eres responsable del consentimiento y de las normas aplicables.'),
      faq('Do you write medical claims for treatments?', 'No. We help structure treatment content; your licensed team reviews and approves all clinical information.', '¿Redactan afirmaciones médicas?', 'No. Estructuramos el contenido; tu equipo autorizado revisa y aprueba la información clínica.'),
    ],
    seo: {
      title: l('Med Spa Website Design & Booking CRM', 'Diseño web y CRM para med spas'),
      description: l('Med spa websites with treatment pages, consultation booking, membership signups and automated rebooking campaigns.', 'Sitios para med spas con tratamientos, reserva de consultas, membresías y recordatorios automáticos.'),
    },
    relatedIndustries: ['dental', 'outpatient-medical', 'interior-design', 'financial-services'],
  },

  // ---------------------------------------------------------------- Clinical research
  'clinical-research': {
    hero: {
      title: l('Clinical research websites that support participant recruitment.', 'Sitios de investigación clínica que apoyan el reclutamiento.'),
      description: l('Present studies clearly, route participant interest through structured pre-screening and give sponsors the information they need.', 'Presenta estudios con claridad, organiza el interés con preselección y da a los patrocinadores la información que necesitan.'),
    },
    heroVisual: {
      type: 'industryMockup',
      brand: l('Your Research Site', 'Tu centro de investigación'),
      headline: l('Explore our current studies', 'Conoce nuestros estudios actuales'),
      subhead: l('Learn about participation and see if a study may be a fit.', 'Aprende cómo participar y si un estudio podría ser para ti.'),
      primaryCta: l('See Studies', 'Ver estudios'),
      secondaryCta: l('For Sponsors', 'Patrocinadores'),
      badges: list(['Study listings', 'Pre-screening', 'Multilingual'], ['Estudios', 'Preselección', 'Multilingüe']),
    },
    conversionGoals: list(['Participant interest', 'Pre-screening completions', 'Multilingual recruitment', 'Sponsor inquiries'], ['Interés de participantes', 'Preselecciones completadas', 'Reclutamiento multilingüe', 'Consultas de patrocinadores']),
    websiteFeatures: [
      feature('file', 'Study listing pages', 'Clear, approved descriptions of each study.', 'Páginas de estudios', 'Descripciones claras y aprobadas.'),
      feature('filter', 'Pre-screening forms', 'Structured questions approved by your team.', 'Preselección', 'Preguntas estructuradas aprobadas por tu equipo.'),
      feature('languages', 'Multilingual pages', 'Reach participants in English and Spanish.', 'Páginas multilingües', 'Llega a participantes en inglés y español.'),
      feature('handshake', 'Sponsor information', 'Capabilities and contact for sponsors and CROs.', 'Información para patrocinadores', 'Capacidades y contacto para patrocinadores y CRO.'),
    ],
    ctas: { primary: l('Build My Research Site Website', 'Crear mi sitio de investigación') },
    faq: [
      faq('Who writes the study content?', 'Your team provides and approves study content, including anything requiring IRB review. We handle structure and presentation.', '¿Quién redacta el contenido de los estudios?', 'Tu equipo provee y aprueba el contenido, incluido lo que requiera revisión de un comité de ética. Nosotros nos encargamos de la estructura y presentación.'),
      faq('Can pre-screening forms be bilingual?', 'Yes. Forms and study pages can be offered in English and Spanish.', '¿La preselección puede ser bilingüe?', 'Sí. Formularios y páginas pueden ofrecerse en inglés y español.'),
      faq('Is the website a medical device or eligibility tool?', 'No. Pre-screening collects interest only; final eligibility is determined by your study team.', '¿El sitio determina la elegibilidad?', 'No. La preselección solo recoge interés; la elegibilidad la determina tu equipo.'),
    ],
    seo: {
      title: l('Clinical Research Site Website Design', 'Diseño web para centros de investigación clínica'),
      description: l('Websites for clinical research sites with study listings, structured pre-screening forms, multilingual participant pages and sponsor information.', 'Sitios para investigación clínica con estudios, preselección, páginas multilingües e información para patrocinadores.'),
    },
    relatedIndustries: ['outpatient-medical', 'dental', 'med-spas', 'legal'],
  },

  // ---------------------------------------------------------------- Outpatient medical
  'outpatient-medical': {
    hero: {
      title: l('Clinic websites that help patients take the next step.', 'Sitios para clínicas que ayudan al paciente a dar el siguiente paso.'),
      description: l('Help patients find the right provider, understand your services and request an appointment with confidence.', 'Ayuda a los pacientes a encontrar al profesional adecuado, entender tus servicios y pedir cita con confianza.'),
    },
    heroVisual: {
      type: 'industryMockup',
      brand: l('Your Clinic', 'Tu clínica'),
      headline: l('Care that fits your schedule', 'Atención que se adapta a tu agenda'),
      subhead: l('Meet our providers and request an appointment.', 'Conoce a nuestro equipo y pide una cita.'),
      primaryCta: l('Request Appointment', 'Pedir cita'),
      secondaryCta: l('Our Providers', 'Profesionales'),
      badges: list(['Provider profiles', 'Insurance info', 'Multiple locations'], ['Perfiles', 'Seguros', 'Varias sedes']),
    },
    conversionGoals: list(['Appointment requests', 'New patient inquiries', 'Insurance questions', 'Location-specific visits'], ['Solicitudes de cita', 'Pacientes nuevos', 'Dudas de seguros', 'Visitas por sede']),
    ctas: { primary: l('Build My Clinic Website', 'Crear el sitio de mi clínica') },
    seo: {
      title: l('Outpatient Clinic Website Design', 'Diseño web para clínicas ambulatorias'),
      description: l('Websites for outpatient clinics and practices with provider profiles, service pages, insurance information and appointment requests.', 'Sitios para clínicas con perfiles de profesionales, servicios, seguros y solicitudes de cita.'),
    },
    relatedIndustries: ['dental', 'clinical-research', 'med-spas', 'financial-services'],
  },

  // ---------------------------------------------------------------- Dental
  dental: {
    hero: {
      title: l('Dental websites that welcome new patients.', 'Sitios dentales que dan la bienvenida a nuevos pacientes.'),
      description: l('Treatment pages, appointment requests, insurance and financing information, and recall campaigns that keep patients on schedule.', 'Páginas de tratamientos, solicitudes de cita, seguros y financiamiento, y campañas de recordatorio para mantener a los pacientes al día.'),
    },
    heroVisual: {
      type: 'industryMockup',
      brand: l('Your Dental Practice', 'Tu consultorio dental'),
      headline: l('Gentle, modern dental care', 'Atención dental moderna y amable'),
      subhead: l('General, cosmetic and family dentistry. New patients welcome.', 'Odontología general, estética y familiar. Aceptamos nuevos pacientes.'),
      primaryCta: l('Request Appointment', 'Pedir cita'),
      secondaryCta: l('Insurance & Financing', 'Seguros y pagos'),
      badges: list(['New patients welcome', 'Insurance info', 'Financing options'], ['Nuevos pacientes', 'Seguros', 'Financiamiento']),
      image: '/images/industries/dental-hero.png',
      imageAlt: l('Bright, modern dental treatment room', 'Consultorio dental moderno y luminoso'),
    },
    conversionGoals: list(['New patient appointments', 'Cosmetic consultations', 'Insurance & financing questions', 'Recall visits', 'Emergency dental requests'], ['Citas de nuevos pacientes', 'Consultas estéticas', 'Dudas de seguros y pagos', 'Visitas de control', 'Urgencias dentales']),
    painPoints: [
      item('New patients choose based on first impressions', 'Patients compare practices online. Unclear services or outdated design send them elsewhere.', 'Los nuevos pacientes eligen por la primera impresión', 'Los pacientes comparan en línea. Servicios confusos o un diseño anticuado los alejan.'),
      item('Insurance questions block bookings', 'If patients cannot tell whether you accept their plan, they hesitate to book.', 'Las dudas de seguros frenan reservas', 'Si no saben si aceptas su plan, dudan en reservar.'),
      item('Recall visits slip', 'Without reminders, six-month checkups get postponed indefinitely.', 'Se olvidan los controles', 'Sin recordatorios, las revisiones semestrales se posponen.'),
    ],
    websiteFeatures: [
      feature('smile', 'Treatment pages', 'Cleanings, implants, whitening, orthodontics and more.', 'Páginas de tratamientos', 'Limpiezas, implantes, blanqueamiento, ortodoncia y más.'),
      feature('calendar', 'Appointment requests', 'Simple forms for new and existing patients.', 'Solicitudes de cita', 'Formularios para pacientes nuevos y actuales.'),
      feature('card', 'Insurance & financing', 'Accepted plans and payment options explained.', 'Seguros y financiamiento', 'Planes aceptados y opciones de pago.'),
      feature('users', 'Meet the team', 'Dentist and staff profiles that build familiarity.', 'Conoce al equipo', 'Perfiles que generan cercanía.'),
    ],
    crmFeatures: list(['New patient intake tracking', 'Recall reminder campaigns', 'Treatment plan follow-ups', 'Review requests after visits'], ['Seguimiento de nuevos pacientes', 'Campañas de recordatorio', 'Seguimiento de planes de tratamiento', 'Solicitud de reseñas']),
    campaigns: {
      title: l('Recall and reactivation campaigns', 'Campañas de recordatorio y reactivación'),
      items: [
        item('Six-month recall', 'Remind patients when checkups are due.', 'Control semestral', 'Avisa cuando toca la revisión.'),
        item('Unscheduled treatment', 'Follow up on recommended treatment plans.', 'Tratamientos pendientes', 'Seguimiento de planes recomendados.'),
        item('Benefits reminder', 'Encourage patients to use remaining annual benefits.', 'Recordatorio de beneficios', 'Invita a usar los beneficios anuales restantes.'),
      ],
    },
    ctas: { primary: l('Build My Dental Website', 'Crear mi sitio dental'), bandTitle: l('Ready to welcome more new patients?', '¿Listo para recibir más pacientes nuevos?') },
    faq: [
      faq('Can patients request appointments online?', 'Yes. We add appointment request forms or link to your scheduling software.', '¿Los pacientes pueden pedir cita en línea?', 'Sí. Agregamos formularios o enlazamos tu sistema de agenda.'),
      faq('Is the website HIPAA compliant?', 'Standard website forms should not collect protected health information. If you need that, we will scope a compliant solution separately.', '¿El sitio cumple con HIPAA?', 'Los formularios estándar no deben recopilar información médica protegida. Si la necesitas, definimos una solución adecuada por separado.'),
      faq('Can we list accepted insurance plans?', 'Yes. We can create an insurance and financing page that you keep up to date.', '¿Podemos listar los seguros aceptados?', 'Sí. Creamos una página de seguros y financiamiento que tú mantienes al día.'),
    ],
    seo: {
      title: l('Dental Practice Website Design & Patient CRM', 'Diseño web y CRM para consultorios dentales'),
      description: l('Dental websites with treatment pages, new patient appointment requests, insurance and financing information, and recall campaigns.', 'Sitios dentales con tratamientos, citas para nuevos pacientes, seguros y financiamiento, y campañas de recordatorio.'),
    },
    relatedIndustries: ['med-spas', 'outpatient-medical', 'clinical-research', 'financial-services'],
  },

  // ---------------------------------------------------------------- Legal
  legal: {
    hero: {
      title: l('Law firm websites that build credibility and organize intake.', 'Sitios para despachos que generan credibilidad y ordenan la admisión.'),
      description: l('Practice area pages, attorney profiles and consultation intake that routes each inquiry by case type.', 'Páginas por área de práctica, perfiles de abogados y admisión de consultas organizada por tipo de caso.'),
    },
    heroVisual: {
      type: 'industryMockup',
      brand: l('Your Law Firm', 'Tu despacho'),
      headline: l('Experienced counsel when it matters', 'Asesoría experimentada cuando importa'),
      subhead: l('Explore our practice areas and request a consultation.', 'Conoce nuestras áreas de práctica y solicita una consulta.'),
      primaryCta: l('Request Consultation', 'Pedir consulta'),
      secondaryCta: l('Practice Areas', 'Áreas de práctica'),
      badges: list(['Practice areas', 'Attorney profiles', 'Bilingual service'], ['Áreas de práctica', 'Abogados', 'Servicio bilingüe']),
    },
    conversionGoals: list(['Consultation requests', 'Case-type routing', 'Practice area inquiries', 'Bilingual intake'], ['Solicitudes de consulta', 'Ruteo por tipo de caso', 'Consultas por área', 'Admisión bilingüe']),
    websiteFeatures: [
      feature('scale', 'Practice area pages', 'A dedicated page for each area you practice.', 'Áreas de práctica', 'Una página para cada área.'),
      feature('users', 'Attorney profiles', 'Experience, education and bar admissions.', 'Perfiles de abogados', 'Experiencia, formación y colegiaturas.'),
      feature('filter', 'Case-type intake', 'Route inquiries to the right attorney or team.', 'Admisión por tipo de caso', 'Dirige consultas al abogado indicado.'),
      feature('languages', 'Multilingual content', 'Serve clients in English and Spanish.', 'Contenido multilingüe', 'Atiende en inglés y español.'),
    ],
    ctas: { primary: l('Build My Law Firm Website', 'Crear el sitio de mi despacho') },
    faq: [
      faq('Do you write legal content?', 'We help structure and present practice area content. Your attorneys review and approve all legal information.', '¿Redactan contenido legal?', 'Estructuramos y presentamos el contenido. Tus abogados revisan y aprueban la información legal.'),
      faq('Can intake forms route by case type?', 'Yes. The CRM can tag and route inquiries by practice area.', '¿La admisión se puede dirigir por tipo de caso?', 'Sí. El CRM etiqueta y dirige las consultas por área.'),
      faq('Can we include required disclaimers?', 'Yes. We can add the disclaimers your jurisdiction requires; you confirm the wording.', '¿Podemos incluir avisos obligatorios?', 'Sí. Agregamos los avisos requeridos; tú confirmas la redacción.'),
    ],
    seo: {
      title: l('Law Firm Website Design & Client Intake', 'Diseño web y admisión de clientes para despachos'),
      description: l('Law firm websites with practice area pages, attorney profiles, case-type consultation intake and multilingual content.', 'Sitios para despachos con áreas de práctica, perfiles, admisión por tipo de caso y contenido multilingüe.'),
    },
    relatedIndustries: ['financial-services', 'real-estate', 'clinical-research', 'outpatient-medical'],
  },

  // ---------------------------------------------------------------- Real estate
  'real-estate': {
    hero: {
      title: l('Real estate websites that capture buyers and sellers.', 'Sitios inmobiliarios que captan compradores y vendedores.'),
      description: l('Neighborhood pages, valuation requests and listing showcases that feed a CRM built for long nurture timelines.', 'Páginas de vecindarios, valuaciones y propiedades que alimentan un CRM pensado para seguimientos largos.'),
    },
    heroVisual: {
      type: 'industryMockup',
      brand: l('Your Realty', 'Tu inmobiliaria'),
      headline: l('Find your next home with a local expert', 'Encuentra tu próximo hogar con un experto local'),
      subhead: l('Browse listings, explore neighborhoods or get a home valuation.', 'Explora propiedades, vecindarios o pide una valuación.'),
      primaryCta: l('Home Valuation', 'Valuar mi casa'),
      secondaryCta: l('Listings', 'Propiedades'),
      badges: list(['Buyers', 'Sellers', 'Neighborhood guides'], ['Compradores', 'Vendedores', 'Guías de vecindarios']),
    },
    conversionGoals: list(['Home valuation requests', 'Buyer consultations', 'Showing requests', 'Newsletter and market update signups'], ['Valuaciones', 'Consultas de compradores', 'Solicitudes de visita', 'Boletines de mercado']),
    websiteFeatures: [
      feature('house', 'Listing showcases', 'Featured properties with photos and details.', 'Propiedades destacadas', 'Fotos y detalles.'),
      feature('globe', 'Neighborhood pages', 'Local guides that attract search traffic.', 'Páginas de vecindarios', 'Guías locales que atraen búsquedas.'),
      feature('chart', 'Valuation requests', 'Capture seller leads with a valuation form.', 'Valuaciones', 'Capta vendedores con un formulario.'),
      feature('send', 'CRM nurture', 'Stay in touch until buyers and sellers are ready.', 'Seguimiento en CRM', 'Mantén el contacto hasta que estén listos.'),
    ],
    ctas: { primary: l('Build My Real Estate Website', 'Crear mi sitio inmobiliario') },
    seo: {
      title: l('Real Estate Agent Website Design & CRM', 'Diseño web y CRM para agentes inmobiliarios'),
      description: l('Real estate websites with listing showcases, neighborhood pages, home valuation requests and CRM nurture for buyers and sellers.', 'Sitios inmobiliarios con propiedades, vecindarios, valuaciones y seguimiento en CRM.'),
    },
    relatedIndustries: ['home-builders', 'financial-services', 'legal', 'interior-design'],
  },

  // ---------------------------------------------------------------- Restaurants
  restaurants: {
    hero: {
      title: l('Restaurant websites that fill tables.', 'Sitios para restaurantes que llenan mesas.'),
      description: l('Mobile-first menus, reservations, ordering links, locations and event promotions in a fast site that looks great on phones.', 'Menús para móvil, reservas, enlaces de pedido, sedes y eventos en un sitio rápido que luce bien en el teléfono.'),
    },
    heroVisual: {
      type: 'industryMockup',
      brand: l('Your Restaurant', 'Tu restaurante'),
      headline: l('Fresh food, made to share', 'Comida fresca para compartir'),
      subhead: l('See the menu, reserve a table or order online.', 'Mira el menú, reserva o pide en línea.'),
      primaryCta: l('Reserve a Table', 'Reservar'),
      secondaryCta: l('View Menu', 'Ver menú'),
      badges: list(['Menus', 'Reservations', 'Catering'], ['Menús', 'Reservas', 'Catering']),
    },
    conversionGoals: list(['Reservations', 'Online orders', 'Catering inquiries', 'Event bookings', 'Email club signups'], ['Reservas', 'Pedidos en línea', 'Catering', 'Eventos', 'Club de correo']),
    websiteFeatures: [
      feature('utensils', 'Mobile-first menus', 'Easy-to-update menus that load fast.', 'Menús para móvil', 'Fáciles de actualizar y rápidos.'),
      feature('calendar', 'Reservation links', 'Connect your reservation platform.', 'Reservas', 'Conecta tu plataforma de reservas.'),
      feature('cart', 'Ordering links', 'Send guests to your ordering provider.', 'Pedidos', 'Enlaza a tu proveedor de pedidos.'),
      feature('megaphone', 'Events & promotions', 'Promote specials, events and private dining.', 'Eventos y promociones', 'Especiales, eventos y salones privados.'),
    ],
    ctas: { primary: l('Build My Restaurant Website', 'Crear el sitio de mi restaurante') },
    seo: {
      title: l('Restaurant Website Design', 'Diseño web para restaurantes'),
      description: l('Restaurant websites with mobile-first menus, reservation and ordering links, location pages, catering inquiries and event promotions.', 'Sitios para restaurantes con menús móviles, reservas, pedidos, sedes, catering y eventos.'),
    },
    relatedIndustries: ['automotive', 'med-spas', 'real-estate', 'interior-design'],
  },

  // ---------------------------------------------------------------- Automotive
  automotive: {
    hero: {
      title: l('Auto shop websites that book more service.', 'Sitios para talleres que agendan más servicios.'),
      description: l('Clear service menus, appointment requests and maintenance reminders that bring customers back.', 'Menús de servicio claros, solicitudes de cita y recordatorios de mantenimiento que hacen volver a los clientes.'),
    },
    heroVisual: {
      type: 'industryMockup',
      brand: l('Your Auto Shop', 'Tu taller'),
      headline: l('Honest auto repair & detailing', 'Mecánica y detallado honestos'),
      subhead: l('Maintenance, diagnostics, repairs and detailing.', 'Mantenimiento, diagnóstico, reparaciones y detallado.'),
      primaryCta: l('Book Service', 'Agendar servicio'),
      secondaryCta: l('Services', 'Servicios'),
      badges: list(['Service menu', 'Reviews', 'Maintenance reminders'], ['Servicios', 'Reseñas', 'Recordatorios']),
    },
    conversionGoals: list(['Service appointments', 'Repair estimates', 'Detailing bookings', 'Repeat maintenance visits'], ['Citas de servicio', 'Presupuestos', 'Detallado', 'Mantenimiento recurrente']),
    ctas: { primary: l('Build My Auto Shop Website', 'Crear el sitio de mi taller') },
    seo: {
      title: l('Auto Repair Shop Website Design', 'Diseño web para talleres mecánicos'),
      description: l('Auto repair and detailing websites with service menus, appointment requests, reviews and automated maintenance reminders.', 'Sitios para talleres con servicios, citas, reseñas y recordatorios de mantenimiento.'),
    },
    relatedIndustries: ['restaurants', 'pest-control', 'electricians', 'financial-services'],
  },

  // ---------------------------------------------------------------- Financial services
  'financial-services': {
    hero: {
      title: l('Financial services websites that earn trust.', 'Sitios de servicios financieros que generan confianza.'),
      description: l('Communicate expertise with advisor profiles and educational content, and turn readers into consultation requests.', 'Comunica experiencia con perfiles de asesores y contenido educativo, y convierte lectores en solicitudes de consulta.'),
    },
    heroVisual: {
      type: 'industryMockup',
      brand: l('Your Advisory Firm', 'Tu firma de asesoría'),
      headline: l('Plan your financial future with confidence', 'Planea tu futuro financiero con confianza'),
      subhead: l('Tax, planning and insurance guidance from local advisors.', 'Impuestos, planeación y seguros con asesores locales.'),
      primaryCta: l('Book a Consultation', 'Agendar consulta'),
      secondaryCta: l('Resources', 'Recursos'),
      badges: list(['Advisor profiles', 'Education', 'Secure contact'], ['Asesores', 'Educación', 'Contacto seguro']),
    },
    conversionGoals: list(['Consultation bookings', 'Tax season inquiries', 'Newsletter signups', 'Resource downloads'], ['Consultas', 'Temporada de impuestos', 'Boletín', 'Descarga de recursos']),
    ctas: { primary: l('Build My Firm Website', 'Crear el sitio de mi firma') },
    faq: [
      faq('Can you include compliance disclosures?', 'Yes. We add the disclosures you provide; your compliance team approves the wording.', '¿Pueden incluir avisos regulatorios?', 'Sí. Agregamos los avisos que nos des; tu equipo de cumplimiento aprueba la redacción.'),
      faq('Can clients send documents through the site?', 'Standard forms are not intended for sensitive financial documents. We can link to your secure client portal.', '¿Los clientes pueden enviar documentos por el sitio?', 'Los formularios estándar no son para documentos sensibles. Podemos enlazar a tu portal seguro.'),
      faq('Can we publish educational articles?', 'Yes. A blog or resource section helps answer common questions and supports search visibility.', '¿Podemos publicar artículos?', 'Sí. Un blog o sección de recursos responde dudas y apoya la visibilidad en buscadores.'),
    ],
    seo: {
      title: l('Financial Advisor & Tax Firm Website Design', 'Diseño web para asesores financieros'),
      description: l('Websites for financial advisors, tax and insurance firms with advisor profiles, educational resources, consultation booking and secure contact options.', 'Sitios para asesores financieros, fiscales y de seguros con perfiles, recursos, consultas y contacto seguro.'),
    },
    relatedIndustries: ['legal', 'real-estate', 'outpatient-medical', 'dental'],
  },
}
