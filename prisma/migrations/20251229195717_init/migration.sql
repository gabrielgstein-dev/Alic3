-- CreateTable
CREATE TABLE "user_web_sessions" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokenType" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "expiresIn" INTEGER NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "scope" TEXT[],
    "cookieSetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cookieMaxAge" INTEGER NOT NULL,

    CONSTRAINT "user_web_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cached_discord_users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "discriminator" TEXT NOT NULL,
    "avatarId" TEXT,
    "globalName" TEXT,
    "banner" TEXT,
    "accentColor" INTEGER,
    "locale" TEXT NOT NULL,
    "email" TEXT,
    "verified" BOOLEAN NOT NULL,
    "premiumType" INTEGER NOT NULL,
    "flags" INTEGER NOT NULL,
    "publicFlags" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cached_discord_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_web_sessions_token_key" ON "user_web_sessions"("token");
