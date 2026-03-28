/*
  Warnings:

  - You are about to drop the column `track_id` on the `tracks` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "tracks_track_id_idx";

-- DropIndex
DROP INDEX "tracks_track_id_key";

-- AlterTable
ALTER TABLE "tracks" DROP COLUMN "track_id";
