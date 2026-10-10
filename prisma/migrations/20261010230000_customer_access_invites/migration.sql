-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CustomerMembership" ADD COLUMN "invitedAt" TIMESTAMP(3);
ALTER TABLE "CustomerMembership" ADD COLUMN "lastInviteSentAt" TIMESTAMP(3);
