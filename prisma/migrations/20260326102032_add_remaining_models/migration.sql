/*
  Warnings:

  - You are about to drop the column `aiAnalysisId` on the `mood_entries` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "EmotionType" AS ENUM ('HAPPY', 'SAD', 'ANGRY', 'ANXIOUS', 'FEARFUL', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "RecommendationMode" AS ENUM ('MIRROR', 'SHIFT');

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- AlterTable
ALTER TABLE "mood_entries" DROP COLUMN "aiAnalysisId";

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "theme" "Theme" NOT NULL DEFAULT 'SYSTEM',
    "language" TEXT NOT NULL DEFAULT 'vi',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emotion_analyses" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "primary_emotion" "EmotionType" NOT NULL,
    "sentiment_score" DOUBLE PRECISION NOT NULL,
    "intensity" INTEGER NOT NULL,
    "model_version" TEXT,
    "analyzed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emotion_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entry_keywords" (
    "id" TEXT NOT NULL,
    "analysis_id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "relevance" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "entry_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genres" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "songs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "album" TEXT,
    "year" INTEGER,
    "duration_secs" INTEGER,
    "mood_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sentiment_min" DOUBLE PRECISION NOT NULL,
    "sentiment_max" DOUBLE PRECISION NOT NULL,
    "language" TEXT,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "songs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "song_artists" (
    "song_id" TEXT NOT NULL,
    "artist_id" TEXT NOT NULL,
    "role" TEXT,

    CONSTRAINT "song_artists_pkey" PRIMARY KEY ("song_id","artist_id")
);

-- CreateTable
CREATE TABLE "song_genres" (
    "song_id" TEXT NOT NULL,
    "genre_id" TEXT NOT NULL,

    CONSTRAINT "song_genres_pkey" PRIMARY KEY ("song_id","genre_id")
);

-- CreateTable
CREATE TABLE "music_recommendations" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "mode" "RecommendationMode" NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "music_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_songs" (
    "recommendation_id" TEXT NOT NULL,
    "song_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "recommendation_songs_pkey" PRIMARY KEY ("recommendation_id","song_id")
);

-- CreateTable
CREATE TABLE "playlists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "associated_mood" "EmotionType",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlist_songs" (
    "playlist_id" TEXT NOT NULL,
    "song_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "playlist_songs_pkey" PRIMARY KEY ("playlist_id","song_id")
);

-- CreateTable
CREATE TABLE "song_plays" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "song_id" TEXT NOT NULL,
    "played_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "context" TEXT,

    CONSTRAINT "song_plays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "user_settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "emotion_analyses_entry_id_key" ON "emotion_analyses"("entry_id");

-- CreateIndex
CREATE INDEX "emotion_analyses_entry_id_idx" ON "emotion_analyses"("entry_id");

-- CreateIndex
CREATE INDEX "emotion_analyses_primary_emotion_idx" ON "emotion_analyses"("primary_emotion");

-- CreateIndex
CREATE INDEX "emotion_analyses_sentiment_score_idx" ON "emotion_analyses"("sentiment_score");

-- CreateIndex
CREATE INDEX "entry_keywords_analysis_id_idx" ON "entry_keywords"("analysis_id");

-- CreateIndex
CREATE INDEX "entry_keywords_keyword_idx" ON "entry_keywords"("keyword");

-- CreateIndex
CREATE UNIQUE INDEX "artists_name_key" ON "artists"("name");

-- CreateIndex
CREATE INDEX "artists_name_idx" ON "artists"("name");

-- CreateIndex
CREATE UNIQUE INDEX "genres_name_key" ON "genres"("name");

-- CreateIndex
CREATE INDEX "genres_name_idx" ON "genres"("name");

-- CreateIndex
CREATE INDEX "songs_sentiment_min_sentiment_max_idx" ON "songs"("sentiment_min", "sentiment_max");

-- CreateIndex
CREATE INDEX "songs_mood_tags_idx" ON "songs"("mood_tags");

-- CreateIndex
CREATE INDEX "songs_language_idx" ON "songs"("language");

-- CreateIndex
CREATE INDEX "songs_popularity_idx" ON "songs"("popularity");

-- CreateIndex
CREATE INDEX "song_artists_song_id_idx" ON "song_artists"("song_id");

-- CreateIndex
CREATE INDEX "song_artists_artist_id_idx" ON "song_artists"("artist_id");

-- CreateIndex
CREATE INDEX "song_genres_song_id_idx" ON "song_genres"("song_id");

-- CreateIndex
CREATE INDEX "song_genres_genre_id_idx" ON "song_genres"("genre_id");

-- CreateIndex
CREATE INDEX "music_recommendations_entry_id_idx" ON "music_recommendations"("entry_id");

-- CreateIndex
CREATE INDEX "music_recommendations_user_id_idx" ON "music_recommendations"("user_id");

-- CreateIndex
CREATE INDEX "music_recommendations_user_id_generated_at_idx" ON "music_recommendations"("user_id", "generated_at");

-- CreateIndex
CREATE UNIQUE INDEX "music_recommendations_entry_id_mode_key" ON "music_recommendations"("entry_id", "mode");

-- CreateIndex
CREATE INDEX "recommendation_songs_recommendation_id_idx" ON "recommendation_songs"("recommendation_id");

-- CreateIndex
CREATE INDEX "recommendation_songs_song_id_idx" ON "recommendation_songs"("song_id");

-- CreateIndex
CREATE INDEX "playlists_user_id_idx" ON "playlists"("user_id");

-- CreateIndex
CREATE INDEX "playlist_songs_playlist_id_idx" ON "playlist_songs"("playlist_id");

-- CreateIndex
CREATE INDEX "playlist_songs_song_id_idx" ON "playlist_songs"("song_id");

-- CreateIndex
CREATE INDEX "song_plays_user_id_idx" ON "song_plays"("user_id");

-- CreateIndex
CREATE INDEX "song_plays_song_id_idx" ON "song_plays"("song_id");

-- CreateIndex
CREATE INDEX "song_plays_user_id_played_at_idx" ON "song_plays"("user_id", "played_at");

-- CreateIndex
CREATE INDEX "song_plays_song_id_played_at_idx" ON "song_plays"("song_id", "played_at");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emotion_analyses" ADD CONSTRAINT "emotion_analyses_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "mood_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_keywords" ADD CONSTRAINT "entry_keywords_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "emotion_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_artists" ADD CONSTRAINT "song_artists_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_artists" ADD CONSTRAINT "song_artists_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_genres" ADD CONSTRAINT "song_genres_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_genres" ADD CONSTRAINT "song_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "music_recommendations" ADD CONSTRAINT "music_recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "music_recommendations" ADD CONSTRAINT "music_recommendations_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "mood_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_songs" ADD CONSTRAINT "recommendation_songs_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "music_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_songs" ADD CONSTRAINT "recommendation_songs_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_songs" ADD CONSTRAINT "playlist_songs_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_songs" ADD CONSTRAINT "playlist_songs_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_plays" ADD CONSTRAINT "song_plays_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_plays" ADD CONSTRAINT "song_plays_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
