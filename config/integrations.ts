/**
 * Backend readiness switches (owned by Cursor).
 * While a flag is false the matching public form validates input but returns
 * `{ ok: false, error: 'unavailable' }` and the UI shows an honest "not connected yet" state.
 * Flip a flag to true only after the corresponding function in lib/integrations/forms.ts
 * actually persists or delivers the submission.
 */
export const integrationReadiness = {
  contact: false,
  newsletter: false,
  projectIntake: false,
  strategyCall: false,
} as const
