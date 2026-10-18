-- SOCIAL-04A: campaign create idempotency for quota-safe persistence
ALTER TABLE "SocialCampaign" ADD COLUMN "createIdempotencyKey" TEXT;

CREATE UNIQUE INDEX "SocialCampaign_createIdempotencyKey_key" ON "SocialCampaign"("createIdempotencyKey");
