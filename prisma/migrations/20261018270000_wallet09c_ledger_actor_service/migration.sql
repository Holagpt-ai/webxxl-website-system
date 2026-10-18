-- WALLET-09C: trusted service identity separate from User FK actorUserId
ALTER TABLE "WalletLedgerEntry" ADD COLUMN IF NOT EXISTS "actorServiceId" TEXT;
