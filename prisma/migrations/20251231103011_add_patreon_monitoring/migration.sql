-- CreateTable
CREATE TABLE "patreon_campaigns" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "creatorName" TEXT NOT NULL,
    "creatorUrl" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "checkIntervalMins" INTEGER NOT NULL DEFAULT 30,
    "notificationChannelId" TEXT NOT NULL,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patreon_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patreon_posts" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "content" TEXT,
    "postType" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "minCentsPledged" INTEGER,
    "isNotified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patreon_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patreon_campaigns_campaignId_key" ON "patreon_campaigns"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "patreon_posts_postId_key" ON "patreon_posts"("postId");

-- CreateIndex
CREATE INDEX "patreon_posts_campaignId_publishedAt_idx" ON "patreon_posts"("campaignId", "publishedAt");

-- AddForeignKey
ALTER TABLE "patreon_posts" ADD CONSTRAINT "patreon_posts_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "patreon_campaigns"("campaignId") ON DELETE RESTRICT ON UPDATE CASCADE;
