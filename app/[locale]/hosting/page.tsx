import { createTopLevelServiceRoute } from '@/components/templates/top-level-service'

const route = createTopLevelServiceRoute('hosting')

export const generateMetadata = route.generateMetadata
export default route.Page
