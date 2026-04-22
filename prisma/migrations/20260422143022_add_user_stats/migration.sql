-- CreateTable
CREATE TABLE "user_stats" (
    "user_id" TEXT NOT NULL,
    "writing_streak" INTEGER NOT NULL DEFAULT 0,
    "smile_streak" INTEGER NOT NULL DEFAULT 0,
    "sad_streak" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_stats_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
