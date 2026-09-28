import { createLegalRoute } from '@/components/templates/legal-page'

const route = createLegalRoute('terms')
export const generateMetadata = route.generateMetadata
export default route.Page
