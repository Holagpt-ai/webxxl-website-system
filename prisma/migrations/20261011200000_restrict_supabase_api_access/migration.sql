-- Batch 15 / launch readiness: restrict Supabase Data API roles from Prisma app tables.
-- WebXXL uses Auth.js + server-side Prisma (service_role). These tables must not be readable via anon/authenticated PostgREST.
-- Idempotent: safe to run when privileges are already revoked; no-op on plain Postgres (roles absent).
-- Does NOT enable RLS (Prisma access pattern unchanged; service_role retains table grants).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;
    REVOKE USAGE ON SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated;
  END IF;
END $$;
