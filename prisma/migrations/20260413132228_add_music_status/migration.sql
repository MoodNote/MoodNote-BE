-- CreateEnum
CREATE TYPE "MusicStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "mood_entries" ADD COLUMN     "music_status" "MusicStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "mood_entries_music_status_idx" ON "mood_entries"("music_status");
