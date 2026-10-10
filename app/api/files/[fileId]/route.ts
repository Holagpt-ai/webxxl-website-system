import { NextResponse } from 'next/server'
import { authorizeProjectFileRead } from '@/lib/portal/authz'
import { getStorageProvider, isSafeDownloadUrl, isStorageConfigured } from '@/lib/integrations/storage'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, context: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await context.params
  try {
    const { file } = await authorizeProjectFileRead(fileId)
    if (!isStorageConfigured()) {
      return NextResponse.json({ error: 'not_configured' }, { status: 503 })
    }
    const download = await getStorageProvider().getDownloadUrl(file.storageKey)
    if (!download.ok) {
      return NextResponse.json(
        { error: download.reason },
        { status: download.reason === 'not_configured' ? 503 : 404 },
      )
    }
    if (!isSafeDownloadUrl(download.url)) {
      return NextResponse.json({ error: 'missing' }, { status: 404 })
    }
    return NextResponse.redirect(download.url, 302)
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  }
}
