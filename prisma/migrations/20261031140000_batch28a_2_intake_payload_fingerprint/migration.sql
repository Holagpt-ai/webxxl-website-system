-- Batch 28A.2: separate idempotency payload fingerprint (SHA-256 of signed raw body).
ALTER TABLE "ManagedSiteLead" ADD COLUMN "intakePayloadFingerprint" TEXT NOT NULL DEFAULT '';

ALTER TABLE "ManagedSiteLead" ALTER COLUMN "intakePayloadFingerprint" DROP DEFAULT;
