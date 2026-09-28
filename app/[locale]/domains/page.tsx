import { createTopLevelServiceRoute } from '@/components/templates/top-level-service'

const route = createTopLevelServiceRoute('domains')

export const generateMetadata = route.generateMetadata
export default route.Page
