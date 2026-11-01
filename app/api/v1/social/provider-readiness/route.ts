import { NextResponse } from 'next/server'
import { buildPostizProviderReadiness } from '@/lib/platform/social/postiz-provider-readiness'
import { requireSocialApiActor, SocialApiError } from '@/lib/platform/social/route-auth'

export async function GET() {
  try {
    const actor = await requireSocialApiActor()
    const readiness = await buildPostizProviderReadiness(actor.customerAccountId)
    if (!readiness.ok) {
      return NextResponse.json(
        { code: readiness.code, message: readiness.message },
        { status: readiness.status },
      )
    }
    return NextResponse.json(readiness.value)
  } catch (error) {
    if (error instanceof SocialApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
  }
}
