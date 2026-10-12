-- Per-user portal language. This is not CustomerAccount.locale.
ALTER TABLE "User" ADD COLUMN "preferredLocale" TEXT NOT NULL DEFAULT 'en';
