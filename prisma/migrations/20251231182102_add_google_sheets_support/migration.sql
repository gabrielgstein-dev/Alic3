-- AlterEnum
ALTER TYPE "Platform" ADD VALUE 'GOOGLE_SHEETS';

-- CreateTable
CREATE TABLE "sheet_snapshots" (
    "id" TEXT NOT NULL,
    "feedSourceId" TEXT NOT NULL,
    "snapshotData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sheet_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sheet_snapshots_feedSourceId_idx" ON "sheet_snapshots"("feedSourceId");

-- AddForeignKey
ALTER TABLE "sheet_snapshots" ADD CONSTRAINT "sheet_snapshots_feedSourceId_fkey" FOREIGN KEY ("feedSourceId") REFERENCES "content_feeds"("sourceId") ON DELETE CASCADE ON UPDATE CASCADE;
