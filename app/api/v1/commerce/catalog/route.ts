import { NextResponse } from 'next/server'
import { listCatalog } from '@/lib/platform/commerce/engine'
import { commerceDisabledResponse, commerceRouteError, toCommerceActor } from '@/lib/platform/commerce/http'
import { prismaCommerceStore } from '@/lib/platform/commerce/prisma-store'
import { requireUser } from '@/lib/portal/authz'

export async function GET() {
  try {
    const disabled = commerceDisabledResponse()
    if (disabled) return disabled
    const user = await requireUser()
    const catalog = await listCatalog(prismaCommerceStore, toCommerceActor(user))
    return NextResponse.json({ catalog })
  } catch (error) {
    return commerceRouteError(error)
  }
}
