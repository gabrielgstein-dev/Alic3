import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { DiscordUser, DiscordGuild, DiscordOAuth2Token } from './interfaces/discord-user.interface';

@Injectable()
export class DiscordOAuthService {
  private readonly logger = new Logger(DiscordOAuthService.name);
  private readonly DISCORD_API_BASE = 'https://discord.com/api/v10';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async exchangeCode(code: string): Promise<DiscordOAuth2Token> {
    const clientId = this.configService.get<string>('DISCORD_CLIENT_ID');
    const clientSecret = this.configService.get<string>('DISCORD_CLIENT_SECRET');
    const redirectUri = `${this.configService.get<string>('BASE_URL')}/auth/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.DISCORD_API_BASE}/oauth2/token`,
          params.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );

      this.logger.log('Successfully exchanged code for token');
      return response.data;
    } catch (error) {
      this.logger.error('Failed to exchange code for token', error.response?.data || error.message);
      throw error;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<DiscordOAuth2Token> {
    const clientId = this.configService.get<string>('DISCORD_CLIENT_ID');
    const clientSecret = this.configService.get<string>('DISCORD_CLIENT_SECRET');

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.DISCORD_API_BASE}/oauth2/token`,
          params.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );

      this.logger.log('Successfully refreshed access token');
      return response.data;
    } catch (error) {
      this.logger.error('Failed to refresh access token', error.response?.data || error.message);
      throw error;
    }
  }

  async getUserInfo(accessToken: string): Promise<DiscordUser> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.DISCORD_API_BASE}/users/@me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      );

      this.logger.log(`Retrieved user info for ${response.data.id}`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get user info', error.response?.data || error.message);
      throw error;
    }
  }

  async getUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.DISCORD_API_BASE}/users/@me/guilds`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      );

      this.logger.log(`Retrieved ${response.data.length} guilds for user`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get user guilds', error.response?.data || error.message);
      throw error;
    }
  }

  canManageGuild(guild: DiscordGuild): boolean {
    const MANAGE_GUILD = 0x00000020;
    const permissions = parseInt(guild.permissions);
    return guild.owner || (permissions & MANAGE_GUILD) !== 0;
  }
}
