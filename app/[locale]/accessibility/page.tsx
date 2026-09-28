import { createLegalRoute } from '@/components/templates/legal-page'

const route = createLegalRoute('accessibility')
export const generateMetadata = route.generateMetadata
export default route.Page
