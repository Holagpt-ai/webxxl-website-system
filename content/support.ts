import type { IconName } from '@/lib/icons'
import type { Localized } from '@/lib/i18n/localize'
import { l, type FaqItem } from './types'

/** Help center categories. Add articles to a category's `faq` or add a new category. */
export type SupportCategory = {
  slug: string
  icon: IconName
  title: Localized
  description: Localized
  faq: FaqItem[]
}

export const supportCategories: SupportCategory[] = [
  {
    slug: 'getting-started', icon: 'rocket',
    title: l('Getting started', 'Primeros pasos'),
    description: l('Onboarding, timelines and what to prepare.', 'Incorporación, plazos y qué preparar.'),
    faq: [
      { question: l('What happens after I submit a project?', '¿Qué pasa después de enviar un proyecto?'), answer: l('We review your details and contact you within one business day to schedule a strategy call.', 'Revisamos tus datos y te contactamos en un día hábil para agendar una llamada estratégica.') },
      { question: l('What should I prepare?', '¿Qué debo preparar?'), answer: l('Your logo, services list, service areas and any photos you want to use. We will guide you through the rest.', 'Tu logo, lista de servicios, zonas y fotos que quieras usar. Te guiaremos con el resto.') },
    ],
  },
  {
    slug: 'websites', icon: 'monitor',
    title: l('Websites', 'Sitios web'),
    description: l('Content changes, pages and design.', 'Cambios de contenido, páginas y diseño.'),
    faq: [
      { question: l('How do I request a change?', '¿Cómo pido un cambio?'), answer: l('Contact your project lead. Change requests will move into the client portal once available.', 'Contacta a tu líder de proyecto. Las solicitudes pasarán al portal de clientes cuando esté disponible.') },
    ],
  },
  {
    slug: 'crm', icon: 'users',
    title: l('CRM', 'CRM'),
    description: l('Contacts, pipelines and campaigns.', 'Contactos, embudos y campañas.'),
    faq: [
      { question: l('How do I access the CRM?', '¿Cómo accedo al CRM?'), answer: l('Access details are provided during onboarding.', 'Los datos de acceso se entregan durante la incorporación.') },
    ],
  },
  {
    slug: 'hosting', icon: 'server',
    title: l('Hosting', 'Hosting'),
    description: l('Performance, SSL and uptime.', 'Rendimiento, SSL y disponibilidad.'),
    faq: [
      { question: l('Is SSL included?', '¿El SSL está incluido?'), answer: l('Yes. Every WebXXL-hosted site uses HTTPS.', 'Sí. Todo sitio alojado por WebXXL usa HTTPS.') },
    ],
  },
  {
    slug: 'domains', icon: 'globe',
    title: l('Domains', 'Dominios'),
    description: l('Registration, transfers and DNS.', 'Registro, transferencias y DNS.'),
    faq: [
      { question: l('Can you transfer my domain?', '¿Pueden transferir mi dominio?'), answer: l('Yes. We guide you through unlocking the domain and approving the transfer.', 'Sí. Te guiamos para desbloquear el dominio y aprobar la transferencia.') },
    ],
  },
  {
    slug: 'billing', icon: 'card',
    title: l('Billing', 'Facturación'),
    description: l('Plans, invoices and payments.', 'Planes, facturas y pagos.'),
    faq: [
      { question: l('How will I be billed?', '¿Cómo se me facturará?'), answer: l('Billing details are confirmed in your agreement. Online billing management is coming to the client portal.', 'Los detalles se confirman en tu acuerdo. La gestión de facturación llegará al portal de clientes.') },
    ],
  },
  {
    slug: 'account', icon: 'usercog',
    title: l('Account', 'Cuenta'),
    description: l('Access, users and security.', 'Acceso, usuarios y seguridad.'),
    faq: [
      { question: l('Can I add team members?', '¿Puedo agregar miembros del equipo?'), answer: l('Yes. Tell your project lead who needs access.', 'Sí. Indica a tu líder de proyecto quién necesita acceso.') },
    ],
  },
  {
    slug: 'troubleshooting', icon: 'lifebuoy',
    title: l('Troubleshooting', 'Solución de problemas'),
    description: l('When something is not working.', 'Cuando algo no funciona.'),
    faq: [
      { question: l('My site seems down. What should I do?', 'Mi sitio parece caído. ¿Qué hago?'), answer: l('Contact us right away with the page address and what you see. We monitor availability and will investigate.', 'Contáctanos de inmediato con la dirección y lo que ves. Monitoreamos la disponibilidad e investigaremos.') },
    ],
  },
]
