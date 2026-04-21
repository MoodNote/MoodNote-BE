-- DropForeignKey
ALTER TABLE "email_verifications" DROP CONSTRAINT "email_verifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "password_resets" DROP CONSTRAINT "password_resets_userId_fkey";

-- DropTable
DROP TABLE "email_verifications";

-- DropTable
DROP TABLE "password_resets";
