-- CreateEnum (skip if exists)
DO $$ BEGIN
 CREATE TYPE "Platform" AS ENUM ('PATREON', 'KOFI', 'RSS', 'GITHUB');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Rename table patreon_campaigns to content_feeds
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'patreon_campaigns') THEN
    ALTER TABLE "patreon_campaigns" RENAME TO "content_feeds";
  END IF;
END $$;

-- Add platform column with default
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_feeds' AND column_name = 'platform') THEN
    ALTER TABLE "content_feeds" ADD COLUMN "platform" "Platform" NOT NULL DEFAULT 'PATREON';
  END IF;
END $$;

-- Rename campaignId to sourceId in content_feeds
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_feeds' AND column_name = 'campaignId') THEN
    ALTER TABLE "content_feeds" RENAME COLUMN "campaignId" TO "sourceId";
  END IF;
END $$;

-- Rename campaignId to feedSourceId in patreon_posts
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patreon_posts' AND column_name = 'campaignId') THEN
    ALTER TABLE "patreon_posts" RENAME COLUMN "campaignId" TO "feedSourceId";
  END IF;
END $$;

-- Rename patreonCampaignId to feedSourceId in mod_authors
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mod_authors' AND column_name = 'patreonCampaignId') THEN
    ALTER TABLE "mod_authors" RENAME COLUMN "patreonCampaignId" TO "feedSourceId";
  END IF;
END $$;

-- Rename indexes (with error handling)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'patreon_campaigns_campaignId_key') THEN
    ALTER INDEX "patreon_campaigns_campaignId_key" RENAME TO "content_feeds_sourceId_key";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'mod_authors_patreonCampaignId_key') THEN
    ALTER INDEX "mod_authors_patreonCampaignId_key" RENAME TO "mod_authors_feedSourceId_key";
  END IF;
END $$;

-- Drop old foreign key constraints if they exist
DO $$ BEGIN
  ALTER TABLE "patreon_posts" DROP CONSTRAINT IF EXISTS "patreon_posts_campaignId_fkey";
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "mod_authors" DROP CONSTRAINT IF EXISTS "mod_authors_patreonCampaignId_fkey";
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Add new foreign key constraints if they don't exist
DO $$ BEGIN
  ALTER TABLE "patreon_posts" ADD CONSTRAINT "patreon_posts_feedSourceId_fkey" 
    FOREIGN KEY ("feedSourceId") REFERENCES "content_feeds"("sourceId") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "mod_authors" ADD CONSTRAINT "mod_authors_feedSourceId_fkey" 
    FOREIGN KEY ("feedSourceId") REFERENCES "content_feeds"("sourceId") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Rename composite indexes
DROP INDEX IF EXISTS "patreon_posts_campaignId_publishedAt_idx";
CREATE INDEX IF NOT EXISTS "patreon_posts_feedSourceId_publishedAt_idx" ON "patreon_posts"("feedSourceId", "publishedAt");
