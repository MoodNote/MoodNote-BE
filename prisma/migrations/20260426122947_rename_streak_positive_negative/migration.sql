-- AlterTable
ALTER TABLE "user_stats" DROP COLUMN "sad_streak",
DROP COLUMN "smile_streak",
ADD COLUMN     "negative_streak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "positive_streak" INTEGER NOT NULL DEFAULT 0;
