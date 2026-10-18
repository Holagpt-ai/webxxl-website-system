-- WALLET-09B: durable top-up quote request fingerprint for idempotent replay validation
ALTER TABLE "WalletTopUpQuote" ADD COLUMN IF NOT EXISTS "requestFingerprint" TEXT;
