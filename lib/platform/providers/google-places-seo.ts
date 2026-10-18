import { isSeoPlacesApiEnabled } from '@/config/seo-backend'
import type { ProviderAuthContext, ProviderResult, SeoSourceOverview, SeoSourceProvider } from '@/lib/platform/providers/types'

export type PlacesTextSearchTransport = {
  postJson(input: { url: string; body: unknown }): Promise<{ status: number; json: { places?: { id?: string; displayName?: { text?: string } }[] } }>
}

export function createGooglePlacesSeoProvider(deps: { transport: PlacesTextSearchTransport }): SeoSourceProvider {
  return {
    kind: 'seo',
    key: 'google-places',
    displayName: 'Google Places (New) discovery',
    availability: 'CANDIDATE',
    replaceable: true,
    installed: true,
    async readOverview(_context: ProviderAuthContext): Promise<ProviderResult<SeoSourceOverview>> {
      if (!isSeoPlacesApiEnabled()) {
        return { ok: true, value: { status: 'NOT_CONNECTED', provider: 'PLACES' } }
      }
      return { ok: true, value: { status: 'NOT_CONNECTED', provider: 'PLACES' } }
    },
    async discoverCandidates(_context: ProviderAuthContext, query: string) {
      if (!isSeoPlacesApiEnabled()) {
        return { ok: false, code: 'NOT_CONFIGURED', message: 'Places API disabled' } as const
      }
      const res = await deps.transport.postJson({
        url: 'https://places.googleapis.com/v1/places:searchText',
        body: { textQuery: query },
      })
      const placeIds = (res.json.places ?? [])
        .map((p) => p.id)
        .filter((id): id is string => Boolean(id))
      return { ok: true, value: { placeIds, retention: 'store_place_id_only' } } as const
    },
  } as SeoSourceProvider & {
    discoverCandidates: (
      context: ProviderAuthContext,
      query: string,
    ) => Promise<ProviderResult<{ placeIds: string[]; retention: string }>>
  }
}
