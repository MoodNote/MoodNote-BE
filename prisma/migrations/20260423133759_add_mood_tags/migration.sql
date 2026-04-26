-- DropForeignKey
ALTER TABLE "playlist_tracks" DROP CONSTRAINT "playlist_tracks_track_id_fkey";

-- DropForeignKey
ALTER TABLE "recommendation_tracks" DROP CONSTRAINT "recommendation_tracks_track_id_fkey";

-- AlterTable
ALTER TABLE "mood_entries" ADD COLUMN     "analysis_error_reason" TEXT,
ADD COLUMN     "music_error_reason" TEXT;

-- CreateTable
CREATE TABLE "mood_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mood_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mood_tags_name_key" ON "mood_tags"("name");

-- CreateIndex
CREATE INDEX "mood_tags_name_idx" ON "mood_tags"("name");

-- AddForeignKey
ALTER TABLE "recommendation_tracks" ADD CONSTRAINT "recommendation_tracks_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
