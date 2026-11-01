import {
  isPostizApiEnabled,
  isPostizLivePublishingEnabled,
  isSocialExecutionGatesEnabled,
  isSocialMarketingEnabled,
} from '@/config/social-marketing'
import type { SocialResult } from '@/lib/platform/social/types'

export type SocialDispatchPhase = 'PROVIDER_DISPATCH' | 'PROVIDER_RECONCILE'

export function socialProviderDispatchBlocked(): SocialResult<never> | null {
  if (!isSocialMarketingEnabled()) {
    return { ok: false, code: 'SOCIAL_MARKETING_DISABLED', message: 'Marketing Studio disabled' }
  }
  if (!isPostizApiEnabled()) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'POSTIZ_API_ENABLED is false' }
  }
  if (!isPostizLivePublishingEnabled()) {
    return {
      ok: false,
      code: 'NOT_CONFIGURED',
      message: 'POSTIZ_LIVE_PUBLISHING_ENABLED is false; provider dispatch remains blocked',
    }
  }
  return null
}

export function socialProviderReconcileBlocked(): SocialResult<never> | null {
  if (!isSocialExecutionGatesEnabled()) {
    return {
      ok: false,
      code: 'NOT_CONFIGURED',
      message: 'SOCIAL_EXECUTION_GATES_ENABLED is false',
    }
  }
  if (!isSocialMarketingEnabled()) {
    return { ok: false, code: 'SOCIAL_MARKETING_DISABLED', message: 'Marketing Studio disabled' }
  }
  if (!isPostizApiEnabled()) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'POSTIZ_API_ENABLED is false' }
  }
  return null
}

export function socialDispatchDenial(phase: SocialDispatchPhase): SocialResult<never> | null {
  return phase === 'PROVIDER_DISPATCH' ? socialProviderDispatchBlocked() : socialProviderReconcileBlocked()
}
