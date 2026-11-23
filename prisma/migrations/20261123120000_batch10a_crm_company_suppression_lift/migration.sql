-- Batch 10A: CRM suppression lift audit columns (apply on owner-authorized environments only).
-- Does not grant consent. Import paths must not write these columns.

ALTER TABLE "ContactSuppression" ADD COLUMN "liftedAt" TIMESTAMP(3);
ALTER TABLE "ContactSuppression" ADD COLUMN "liftedByUserId" TEXT;
ALTER TABLE "ContactSuppression" ADD COLUMN "liftReason" TEXT;
ALTER TABLE "ContactSuppression" ADD COLUMN "liftIdempotencyKey" TEXT;

CREATE UNIQUE INDEX "ContactSuppression_liftIdempotencyKey_key" ON "ContactSuppression"("liftIdempotencyKey");
