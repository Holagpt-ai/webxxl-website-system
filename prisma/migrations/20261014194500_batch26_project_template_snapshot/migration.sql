-- Batch 26: optional template snapshot on projects (non-destructive).
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "templateId" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "templateVersion" TEXT;
