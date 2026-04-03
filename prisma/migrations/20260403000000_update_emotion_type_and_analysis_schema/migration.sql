-- Update EmotionType enum: replace old values with AI service labels
ALTER TYPE "EmotionType" RENAME TO "EmotionType_old";

CREATE TYPE "EmotionType" AS ENUM ('Enjoyment', 'Sadness', 'Anger', 'Fear', 'Disgust', 'Surprise', 'Other');

ALTER TABLE "emotion_analyses"
  ALTER COLUMN "primary_emotion" TYPE "EmotionType"
  USING "primary_emotion"::text::"EmotionType";

ALTER TABLE "playlists"
  ALTER COLUMN "associated_mood" TYPE "EmotionType"
  USING "associated_mood"::text::"EmotionType";

DROP TYPE "EmotionType_old";

-- Change intensity from integer to double precision (AI returns floats)
ALTER TABLE "emotion_analyses"
  ALTER COLUMN "intensity" TYPE DOUBLE PRECISION;

-- Add confidence and emotion_distribution columns
ALTER TABLE "emotion_analyses"
  ADD COLUMN "confidence" DOUBLE PRECISION,
  ADD COLUMN "emotion_distribution" JSONB;
