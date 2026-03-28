/*
  Warnings:

  - You are about to drop the `playlist_songs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `recommendation_songs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `song_artists` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `song_genres` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `song_plays` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `songs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "playlist_songs" DROP CONSTRAINT "playlist_songs_playlist_id_fkey";

-- DropForeignKey
ALTER TABLE "playlist_songs" DROP CONSTRAINT "playlist_songs_song_id_fkey";

-- DropForeignKey
ALTER TABLE "recommendation_songs" DROP CONSTRAINT "recommendation_songs_recommendation_id_fkey";

-- DropForeignKey
ALTER TABLE "recommendation_songs" DROP CONSTRAINT "recommendation_songs_song_id_fkey";

-- DropForeignKey
ALTER TABLE "song_artists" DROP CONSTRAINT "song_artists_artist_id_fkey";

-- DropForeignKey
ALTER TABLE "song_artists" DROP CONSTRAINT "song_artists_song_id_fkey";

-- DropForeignKey
ALTER TABLE "song_genres" DROP CONSTRAINT "song_genres_genre_id_fkey";

-- DropForeignKey
ALTER TABLE "song_genres" DROP CONSTRAINT "song_genres_song_id_fkey";

-- DropForeignKey
ALTER TABLE "song_plays" DROP CONSTRAINT "song_plays_song_id_fkey";

-- DropForeignKey
ALTER TABLE "song_plays" DROP CONSTRAINT "song_plays_user_id_fkey";

-- DropTable
DROP TABLE "playlist_songs";

-- DropTable
DROP TABLE "recommendation_songs";

-- DropTable
DROP TABLE "song_artists";

-- DropTable
DROP TABLE "song_genres";

-- DropTable
DROP TABLE "song_plays";

-- DropTable
DROP TABLE "songs";

-- CreateTable
CREATE TABLE "tracks" (
    "id" TEXT NOT NULL,
    "track_id" TEXT NOT NULL,
    "track_name" TEXT NOT NULL,
    "album_name" TEXT,
    "popularity" INTEGER,
    "is_explicit" BOOLEAN NOT NULL DEFAULT false,
    "duration_ms" INTEGER,
    "danceability" DOUBLE PRECISION,
    "energy" DOUBLE PRECISION,
    "key" INTEGER,
    "loudness" DOUBLE PRECISION,
    "speechiness" DOUBLE PRECISION,
    "acousticness" DOUBLE PRECISION,
    "instrumentalness" DOUBLE PRECISION,
    "liveness" DOUBLE PRECISION,
    "valence" DOUBLE PRECISION,
    "tempo" DOUBLE PRECISION,
    "lyrics" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_artists" (
    "track_id" TEXT NOT NULL,
    "artist_id" TEXT NOT NULL,
    "role" TEXT,

    CONSTRAINT "track_artists_pkey" PRIMARY KEY ("track_id","artist_id")
);

-- CreateTable
CREATE TABLE "track_genres" (
    "track_id" TEXT NOT NULL,
    "genre_id" TEXT NOT NULL,

    CONSTRAINT "track_genres_pkey" PRIMARY KEY ("track_id","genre_id")
);

-- CreateTable
CREATE TABLE "recommendation_tracks" (
    "recommendation_id" TEXT NOT NULL,
    "track_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "recommendation_tracks_pkey" PRIMARY KEY ("recommendation_id","track_id")
);

-- CreateTable
CREATE TABLE "playlist_tracks" (
    "playlist_id" TEXT NOT NULL,
    "track_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "playlist_tracks_pkey" PRIMARY KEY ("playlist_id","track_id")
);

-- CreateTable
CREATE TABLE "track_plays" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "track_id" TEXT NOT NULL,
    "played_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "context" TEXT,

    CONSTRAINT "track_plays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracks_track_id_key" ON "tracks"("track_id");

-- CreateIndex
CREATE INDEX "tracks_track_id_idx" ON "tracks"("track_id");

-- CreateIndex
CREATE INDEX "tracks_popularity_idx" ON "tracks"("popularity");

-- CreateIndex
CREATE INDEX "tracks_valence_idx" ON "tracks"("valence");

-- CreateIndex
CREATE INDEX "tracks_energy_idx" ON "tracks"("energy");

-- CreateIndex
CREATE INDEX "track_artists_track_id_idx" ON "track_artists"("track_id");

-- CreateIndex
CREATE INDEX "track_artists_artist_id_idx" ON "track_artists"("artist_id");

-- CreateIndex
CREATE INDEX "track_genres_track_id_idx" ON "track_genres"("track_id");

-- CreateIndex
CREATE INDEX "track_genres_genre_id_idx" ON "track_genres"("genre_id");

-- CreateIndex
CREATE INDEX "recommendation_tracks_recommendation_id_idx" ON "recommendation_tracks"("recommendation_id");

-- CreateIndex
CREATE INDEX "recommendation_tracks_track_id_idx" ON "recommendation_tracks"("track_id");

-- CreateIndex
CREATE INDEX "playlist_tracks_playlist_id_idx" ON "playlist_tracks"("playlist_id");

-- CreateIndex
CREATE INDEX "playlist_tracks_track_id_idx" ON "playlist_tracks"("track_id");

-- CreateIndex
CREATE INDEX "track_plays_user_id_idx" ON "track_plays"("user_id");

-- CreateIndex
CREATE INDEX "track_plays_track_id_idx" ON "track_plays"("track_id");

-- CreateIndex
CREATE INDEX "track_plays_user_id_played_at_idx" ON "track_plays"("user_id", "played_at");

-- CreateIndex
CREATE INDEX "track_plays_track_id_played_at_idx" ON "track_plays"("track_id", "played_at");

-- AddForeignKey
ALTER TABLE "track_artists" ADD CONSTRAINT "track_artists_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_artists" ADD CONSTRAINT "track_artists_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_genres" ADD CONSTRAINT "track_genres_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_genres" ADD CONSTRAINT "track_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_tracks" ADD CONSTRAINT "recommendation_tracks_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "music_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_tracks" ADD CONSTRAINT "recommendation_tracks_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_plays" ADD CONSTRAINT "track_plays_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_plays" ADD CONSTRAINT "track_plays_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
