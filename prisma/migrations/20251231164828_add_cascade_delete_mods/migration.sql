-- DropForeignKey
ALTER TABLE "mod_authors" DROP CONSTRAINT "mod_authors_feedSourceId_fkey";

-- DropForeignKey
ALTER TABLE "mods" DROP CONSTRAINT "mods_authorId_fkey";

-- AlterTable
ALTER TABLE "content_feeds" RENAME CONSTRAINT "patreon_campaigns_pkey" TO "content_feeds_pkey";

-- AddForeignKey
ALTER TABLE "mod_authors" ADD CONSTRAINT "mod_authors_feedSourceId_fkey" FOREIGN KEY ("feedSourceId") REFERENCES "content_feeds"("sourceId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mods" ADD CONSTRAINT "mods_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "mod_authors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
