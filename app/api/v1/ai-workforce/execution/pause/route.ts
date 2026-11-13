import { pauseFromRequest } from '@/lib/platform/ai-workforce-execution/http'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return pauseFromRequest(request)
}
