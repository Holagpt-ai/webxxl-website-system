import type { Localized } from '@/lib/i18n/localize'
import { l } from './types'

/**
 * Blog content source. UI only depends on the BlogPost shape and the getter functions,
 * so this array can be replaced by a CMS/MDX adapter without touching components.
 */
export type BlogBlock =
  | { type: 'paragraph'; text: Localized }
  | { type: 'heading'; text: Localized }
  | { type: 'list'; items: Localized<string[]> }
  | { type: 'callout'; text: Localized }

export type BlogCategory = { slug: string; name: Localized }

export type BlogAuthor = { name: string; role: Localized }

export type BlogPost = {
  slug: string
  enabled: boolean
  isSample: boolean
  title: Localized
  excerpt: Localized
  category: string
  author: BlogAuthor
  publishedAt: string
  readingMinutes: number
  body: BlogBlock[]
  relatedSlugs?: string[]
}

export const blogCategories: BlogCategory[] = [
  { slug: 'websites', name: l('Websites', 'Sitios web') },
  { slug: 'crm', name: l('CRM', 'CRM') },
  { slug: 'marketing', name: l('Marketing', 'Marketing') },
  { slug: 'hosting', name: l('Hosting & domains', 'Hosting y dominios') },
]

const team: BlogAuthor = { name: 'WebXXL Team', role: l('Editorial', 'Editorial') }

export const blogPosts: BlogPost[] = [
  {
    slug: 'what-a-local-business-website-needs',
    enabled: true,
    isSample: true,
    title: l('What a local business website actually needs', 'Lo que realmente necesita el sitio web de un negocio local'),
    excerpt: l('Skip the bells and whistles. These are the elements that turn visitors into calls, quotes and bookings.', 'Olvida lo superfluo. Estos son los elementos que convierten visitas en llamadas, cotizaciones y reservas.'),
    category: 'websites',
    author: team,
    publishedAt: '2026-09-02',
    readingMinutes: 5,
    body: [
      { type: 'paragraph', text: l('Most local customers decide in seconds whether to call you or keep scrolling. A high-performing website makes that decision easy.', 'La mayoría de clientes locales decide en segundos si llamarte o seguir buscando. Un buen sitio hace fácil esa decisión.') },
      { type: 'heading', text: l('Make the next step obvious', 'Haz evidente el siguiente paso') },
      { type: 'paragraph', text: l('Every page should offer a clear action: call, request a quote or book. Put it where thumbs can reach it on mobile.', 'Cada página debe ofrecer una acción clara: llamar, cotizar o reservar. Colócala donde el pulgar la alcance en móvil.') },
      { type: 'list', items: { en: ['A visible phone number and click-to-call', 'A short quote or booking form', 'Services and service areas on their own pages', 'Proof: licenses, reviews and real project photos'], es: ['Un teléfono visible y clic para llamar', 'Un formulario breve de cotización o reserva', 'Servicios y zonas en páginas propias', 'Pruebas: licencias, reseñas y fotos reales'] } },
      { type: 'heading', text: l('Connect it to follow-up', 'Conéctalo al seguimiento') },
      { type: 'paragraph', text: l('A lead is only valuable if someone responds. Route every submission into a CRM so nothing waits in an inbox.', 'Un contacto solo vale si alguien responde. Envía cada formulario a un CRM para que nada quede en un correo.') },
      { type: 'callout', text: l('This is sample editorial content included to demonstrate the blog template.', 'Este es contenido editorial de muestra para demostrar la plantilla del blog.') },
    ],
    relatedSlugs: ['speed-to-lead', 'domains-explained'],
  },
  {
    slug: 'speed-to-lead',
    enabled: true,
    isSample: true,
    title: l('Speed to lead: why fast follow-up wins jobs', 'Rapidez de respuesta: por qué responder rápido gana trabajos'),
    excerpt: l('The business that responds first often wins. Here is how a simple CRM workflow helps your team reply faster.', 'Quien responde primero suele ganar. Así ayuda un flujo simple de CRM a responder más rápido.'),
    category: 'crm',
    author: team,
    publishedAt: '2026-08-18',
    readingMinutes: 4,
    body: [
      { type: 'paragraph', text: l('When a homeowner has a leak or a broken AC, they contact several businesses at once. The first helpful reply usually gets the job.', 'Cuando alguien tiene una fuga o el aire averiado, contacta a varios negocios a la vez. La primera respuesta útil suele ganar.') },
      { type: 'heading', text: l('Build a simple response workflow', 'Crea un flujo de respuesta simple') },
      { type: 'list', items: { en: ['Instant alert to the right person', 'Automatic confirmation to the customer', 'A reminder if no one has responded', 'A pipeline stage that shows status'], es: ['Alerta instantánea a la persona indicada', 'Confirmación automática al cliente', 'Un recordatorio si nadie respondió', 'Una etapa del embudo que muestra el estado'] } },
      { type: 'callout', text: l('This is sample editorial content included to demonstrate the blog template.', 'Este es contenido editorial de muestra para demostrar la plantilla del blog.') },
    ],
    relatedSlugs: ['what-a-local-business-website-needs', 'seasonal-campaigns'],
  },
  {
    slug: 'seasonal-campaigns',
    enabled: true,
    isSample: true,
    title: l('Seasonal campaigns that bring customers back', 'Campañas de temporada que traen clientes de vuelta'),
    excerpt: l('A few well-timed messages a year can keep your schedule full. Here is a simple seasonal plan.', 'Unos pocos mensajes bien programados al año pueden mantener tu agenda llena. Aquí un plan simple.'),
    category: 'marketing',
    author: team,
    publishedAt: '2026-07-30',
    readingMinutes: 6,
    body: [
      { type: 'paragraph', text: l('Your past customers already trust you. Seasonal reminders give them a reason to book again.', 'Tus clientes anteriores ya confían en ti. Los recordatorios de temporada les dan un motivo para volver.') },
      { type: 'heading', text: l('Plan around your calendar', 'Planifica según tu calendario') },
      { type: 'paragraph', text: l('Map the moments your services matter most — before summer, after storms, before holidays — and schedule messages ahead of them.', 'Identifica cuándo más importan tus servicios —antes del verano, tras tormentas, antes de fiestas— y programa mensajes antes.') },
      { type: 'callout', text: l('This is sample editorial content included to demonstrate the blog template.', 'Este es contenido editorial de muestra para demostrar la plantilla del blog.') },
    ],
    relatedSlugs: ['speed-to-lead'],
  },
  {
    slug: 'domains-explained',
    enabled: true,
    isSample: true,
    title: l('Domains, DNS and email, explained simply', 'Dominios, DNS y correo, explicados con sencillez'),
    excerpt: l('Who owns your domain, what DNS does, and why it matters for your website and email.', 'Quién es dueño de tu dominio, qué hace el DNS y por qué importa para tu sitio y correo.'),
    category: 'hosting',
    author: team,
    publishedAt: '2026-07-12',
    readingMinutes: 5,
    body: [
      { type: 'paragraph', text: l('Your domain is your address online. DNS is the directory that tells the internet where your website and email live.', 'Tu dominio es tu dirección en línea. El DNS es el directorio que indica dónde viven tu sitio y tu correo.') },
      { type: 'heading', text: l('Make sure your business owns it', 'Asegúrate de que tu negocio sea el dueño') },
      { type: 'paragraph', text: l('Domains registered by a former employee or vendor can be hard to recover. Keep ownership with the business.', 'Los dominios registrados por un exempleado o proveedor pueden ser difíciles de recuperar. Mantén la propiedad en el negocio.') },
      { type: 'callout', text: l('This is sample editorial content included to demonstrate the blog template.', 'Este es contenido editorial de muestra para demostrar la plantilla del blog.') },
    ],
    relatedSlugs: ['what-a-local-business-website-needs'],
  },
]

export function getPosts(category?: string): BlogPost[] {
  return blogPosts
    .filter((p) => p.enabled && (!category || p.category === category))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

export function getPost(slug: string): BlogPost | undefined {
  return getPosts().find((p) => p.slug === slug)
}

export function getRelatedPosts(post: BlogPost, count = 3): BlogPost[] {
  const explicit = (post.relatedSlugs ?? []).map((s) => getPost(s)).filter((p): p is BlogPost => Boolean(p))
  const fill = getPosts().filter((p) => p.slug !== post.slug && !explicit.includes(p))
  return [...explicit, ...fill].slice(0, count)
}

export function getCategory(slug: string): BlogCategory | undefined {
  return blogCategories.find((c) => c.slug === slug)
}
