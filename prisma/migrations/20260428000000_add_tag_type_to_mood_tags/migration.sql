-- CreateEnum
CREATE TYPE "TagType" AS ENUM ('MOOD', 'LIFE');

-- AlterTable
ALTER TABLE "mood_tags" ADD COLUMN "type" "TagType" NOT NULL DEFAULT 'LIFE';

-- CreateIndex
CREATE INDEX "mood_tags_type_idx" ON "mood_tags"("type");
