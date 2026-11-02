-- COMMS-06A integrity: consolidated into comms06_foundation (Batch 39H).
-- Foundation already defines CommsWebhookReceipt columns, dedupe index, and provider composite index.
-- Retain idempotent drop of legacy unique index for databases that predated eventDedupeKey.

DROP INDEX IF EXISTS "CommsWebhookReceipt_providerKey_externalEventId_key";
