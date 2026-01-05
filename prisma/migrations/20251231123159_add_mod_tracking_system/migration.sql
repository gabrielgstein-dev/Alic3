-- AlterTable
ALTER TABLE "patreon_posts" ADD COLUMN     "analyzed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "processingError" TEXT,
ADD COLUMN     "rawAiResponse" JSONB;

-- CreateTable
CREATE TABLE "mod_authors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "patreonUrl" TEXT,
    "patreonCampaignId" TEXT,
    "curseForgeUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mod_authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mods" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "primaryName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "curseForgeId" TEXT,
    "curseForgeUrl" TEXT,
    "latestVersion" TEXT,
    "latestVersionNormalized" TEXT,
    "latestVersionDate" TIMESTAMP(3),
    "translatedVersion" TEXT,
    "translatedVersionNormalized" TEXT,
    "translationUrl" TEXT,
    "translationDate" TIMESTAMP(3),
    "isUpToDate" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mod_aliases" (
    "id" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mod_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patreon_post_mods" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "modId" TEXT,
    "detectedName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "detectedVersion" TEXT,
    "normalizedVersion" TEXT,
    "isUpdate" BOOLEAN NOT NULL DEFAULT false,
    "isNewMod" BOOLEAN NOT NULL DEFAULT false,
    "downloadUrl" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "needsReview" BOOLEAN NOT NULL DEFAULT true,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discordMessageId" TEXT,
    "discordThreadId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patreon_post_mods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mod_link_history" (
    "id" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "postModId" TEXT,
    "action" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mod_link_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mod_authors_slug_key" ON "mod_authors"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "mod_authors_patreonCampaignId_key" ON "mod_authors"("patreonCampaignId");

-- CreateIndex
CREATE UNIQUE INDEX "mods_slug_key" ON "mods"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "mods_curseForgeId_key" ON "mods"("curseForgeId");

-- CreateIndex
CREATE INDEX "mods_authorId_idx" ON "mods"("authorId");

-- CreateIndex
CREATE INDEX "mods_normalizedName_idx" ON "mods"("normalizedName");

-- CreateIndex
CREATE INDEX "mod_aliases_normalized_idx" ON "mod_aliases"("normalized");

-- CreateIndex
CREATE UNIQUE INDEX "mod_aliases_modId_normalized_key" ON "mod_aliases"("modId", "normalized");

-- CreateIndex
CREATE UNIQUE INDEX "patreon_post_mods_discordMessageId_key" ON "patreon_post_mods"("discordMessageId");

-- CreateIndex
CREATE INDEX "patreon_post_mods_postId_idx" ON "patreon_post_mods"("postId");

-- CreateIndex
CREATE INDEX "patreon_post_mods_modId_idx" ON "patreon_post_mods"("modId");

-- CreateIndex
CREATE INDEX "patreon_post_mods_needsReview_idx" ON "patreon_post_mods"("needsReview");

-- CreateIndex
CREATE INDEX "patreon_post_mods_normalizedName_idx" ON "patreon_post_mods"("normalizedName");

-- CreateIndex
CREATE INDEX "patreon_post_mods_downloadUrl_idx" ON "patreon_post_mods"("downloadUrl");

-- CreateIndex
CREATE INDEX "mod_link_history_modId_idx" ON "mod_link_history"("modId");

-- CreateIndex
CREATE INDEX "mod_link_history_userId_idx" ON "mod_link_history"("userId");

-- CreateIndex
CREATE INDEX "patreon_posts_needsReview_idx" ON "patreon_posts"("needsReview");

-- AddForeignKey
ALTER TABLE "mod_authors" ADD CONSTRAINT "mod_authors_patreonCampaignId_fkey" FOREIGN KEY ("patreonCampaignId") REFERENCES "patreon_campaigns"("campaignId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mods" ADD CONSTRAINT "mods_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "mod_authors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mod_aliases" ADD CONSTRAINT "mod_aliases_modId_fkey" FOREIGN KEY ("modId") REFERENCES "mods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patreon_post_mods" ADD CONSTRAINT "patreon_post_mods_postId_fkey" FOREIGN KEY ("postId") REFERENCES "patreon_posts"("postId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patreon_post_mods" ADD CONSTRAINT "patreon_post_mods_modId_fkey" FOREIGN KEY ("modId") REFERENCES "mods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mod_link_history" ADD CONSTRAINT "mod_link_history_modId_fkey" FOREIGN KEY ("modId") REFERENCES "mods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
