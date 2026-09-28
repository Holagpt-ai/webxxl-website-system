import type { Localized } from '@/lib/i18n/localize'
import { l } from './types'

/**
 * Legal pages. ALL TEXT IS PLACEHOLDER pending legal review — do not treat as approved policy.
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
    lastUpdated: null,
    sections: [
      { heading: l('Information we collect', 'Información que recopilamos'), body: pending },
      { heading: l('How we use information', 'Cómo usamos la información'), body: pending },
      { heading: l('Cookies and analytics', 'Cookies y analítica'), body: pending },
      { heading: l('Your choices', 'Tus opciones'), body: pending },
      { heading: l('Contact', 'Contacto'), body: l('Questions about this policy can be sent through our contact page.', 'Las preguntas sobre esta política pueden enviarse desde nuestra página de contacto.') },
    ],
  },
  {
    slug: 'terms',
    title: l('Terms of Service', 'Términos del servicio'),
    description: l('Terms that apply to use of this website and WebXXL services.', 'Términos aplicables al uso de este sitio y los servicios de WebXXL.'),
    lastUpdated: null,
    sections: [
      { heading: l('Use of this website', 'Uso de este sitio'), body: pending },
      { heading: l('Services and agreements', 'Servicios y acuerdos'), body: pending },
      { heading: l('Intellectual property', 'Propiedad intelectual'), body: pending },
      { heading: l('Limitation of liability', 'Limitación de responsabilidad'), body: pending },
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
