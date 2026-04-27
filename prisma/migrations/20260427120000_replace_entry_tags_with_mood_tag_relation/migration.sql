-- AlterTable: drop tags column from mood_entries
ALTER TABLE "mood_entries" DROP COLUMN "tags";

-- CreateTable: entry_tags join table
CREATE TABLE "entry_tags" (
    "entry_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "entry_tags_pkey" PRIMARY KEY ("entry_id","tag_id")
);

-- CreateIndex
CREATE INDEX "entry_tags_entry_id_idx" ON "entry_tags"("entry_id");

-- CreateIndex
CREATE INDEX "entry_tags_tag_id_idx" ON "entry_tags"("tag_id");

-- AddForeignKey
ALTER TABLE "entry_tags" ADD CONSTRAINT "entry_tags_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "mood_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_tags" ADD CONSTRAINT "entry_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "mood_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
