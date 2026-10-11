/**
 * Documents the intended Supabase PostgreSQL posture for WebXXL production.
 * Enforcement SQL lives in prisma/migrations/20261011200000_restrict_supabase_api_access.
 */
export const SUPABASE_HARDENING_NOTES = {
  accessPattern: 'Auth.js session + Prisma via service_role (server-only)',
  dataApiRoles: 'anon and authenticated must have no grants on public app tables',
  rls: 'Not enabled on Prisma tables; defense-in-depth is revoke + server-side authz',
  storage: 'Project files via signed URLs after authorizeProjectFileRead',
} as const
