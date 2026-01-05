import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { DiscordOAuthService } from './discord-oauth.service';
import { DiscordUser, DiscordGuild } from './interfaces/discord-user.interface';
import * as crypto from 'crypto';

export interface UserSession {
  token: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  user: DiscordUser;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly SESSION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly discordOAuth: DiscordOAuthService,
    private readonly configService: ConfigService,
  ) {}

  generateSessionToken(): string {
    return crypto.randomBytes(64).toString('base64url');
  }

  async createSession(
    userId: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
    scope: string,
  ): Promise<string> {
    const token = this.generateSessionToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresIn * 1000);

    await this.prisma.userWebSession.create({
      data: {
        token,
        userId,
        accessToken,
        refreshToken,
        expiresIn,
        tokenType: 'Bearer',
        scope: scope.split(' '),
        cookieMaxAge: this.SESSION_COOKIE_MAX_AGE,
        createdAt: now,
        refreshedAt: now,
        lastUsedAt: now,
        cookieSetAt: now,
      },
    });

    this.logger.log(`Created session for user ${userId}`);
    return token;
  }

  async updateSession(
    token: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
  ): Promise<void> {
    const now = new Date();

    await this.prisma.userWebSession.update({
      where: { token },
      data: {
        accessToken,
        refreshToken,
        expiresIn,
        refreshedAt: now,
        lastUsedAt: now,
      },
    });

    this.logger.log(`Updated session ${token}`);
  }

  async getSession(token: string): Promise<UserSession | null> {
    const session = await this.prisma.userWebSession.findUnique({
      where: { token },
    });

    if (!session) {
      return null;
    }

    await this.prisma.userWebSession.update({
      where: { token },
      data: { lastUsedAt: new Date() },
    });

    const cachedUser = await this.prisma.cachedDiscordUser.findUnique({
      where: { id: session.userId },
    });

    if (!cachedUser) {
      throw new UnauthorizedException('User not found');
    }

    const expiresAt = new Date(session.refreshedAt.getTime() + session.expiresIn * 1000);

    return {
      token: session.token,
      userId: session.userId,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt,
      user: {
        id: cachedUser.id,
        username: cachedUser.username,
        discriminator: cachedUser.discriminator,
        avatar: cachedUser.avatarId,
        global_name: cachedUser.globalName,
        banner: cachedUser.banner,
        accent_color: cachedUser.accentColor,
        locale: cachedUser.locale,
        email: cachedUser.email,
        verified: cachedUser.verified,
        premium_type: cachedUser.premiumType,
        flags: cachedUser.flags,
        public_flags: cachedUser.publicFlags,
        mfa_enabled: false,
      },
    };
  }

  async refreshSessionIfExpired(session: UserSession): Promise<UserSession> {
    const now = new Date();
    const bufferTime = 5 * 60 * 1000;

    if (session.expiresAt.getTime() - now.getTime() > bufferTime) {
      return session;
    }

    this.logger.log(`Refreshing session for user ${session.userId}`);

    try {
      const newToken = await this.discordOAuth.refreshAccessToken(session.refreshToken);

      await this.updateSession(
        session.token,
        newToken.access_token,
        newToken.refresh_token,
        newToken.expires_in,
      );

      const newExpiresAt = new Date(now.getTime() + newToken.expires_in * 1000);

      return {
        ...session,
        accessToken: newToken.access_token,
        refreshToken: newToken.refresh_token,
        expiresAt: newExpiresAt,
      };
    } catch (error) {
      this.logger.error('Failed to refresh session', error);
      throw new UnauthorizedException('Session expired');
    }
  }

  async getUserGuilds(session: UserSession): Promise<DiscordGuild[]> {
    const refreshedSession = await this.refreshSessionIfExpired(session);
    return this.discordOAuth.getUserGuilds(refreshedSession.accessToken);
  }

  async deleteSession(token: string): Promise<void> {
    await this.prisma.userWebSession.delete({
      where: { token },
    });
    this.logger.log(`Deleted session ${token}`);
  }

  async cacheUserInfo(user: DiscordUser): Promise<void> {
    await this.prisma.cachedDiscordUser.upsert({
      where: { id: user.id },
      update: {
        username: user.username,
        discriminator: user.discriminator,
        avatarId: user.avatar,
        globalName: user.global_name,
        banner: user.banner,
        accentColor: user.accent_color,
        locale: user.locale,
        email: user.email,
        verified: user.verified,
        premiumType: user.premium_type,
        flags: user.flags,
        publicFlags: user.public_flags,
        updatedAt: new Date(),
      },
      create: {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        avatarId: user.avatar,
        globalName: user.global_name,
        banner: user.banner,
        accentColor: user.accent_color,
        locale: user.locale,
        email: user.email,
        verified: user.verified,
        premiumType: user.premium_type,
        flags: user.flags,
        publicFlags: user.public_flags,
      },
    });
  }
}
