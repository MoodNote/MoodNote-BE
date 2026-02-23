-- AlterTable
ALTER TABLE "password_resets" ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false;
