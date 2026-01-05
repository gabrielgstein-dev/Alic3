import { Controller, Get, Req, Res, Query, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { DiscordOAuthService } from './discord-oauth.service';
import { SessionService } from './session.service';

@Controller('auth')
export class AuthController {
  private readonly SESSION_COOKIE_NAME = 'alic3_session';
  private readonly SESSION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly discordOAuth: DiscordOAuthService,
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService,
  ) {}

  @Get('discord')
  redirectToDiscord(@Res() res: Response) {
    const clientId = this.configService.get<string>('DISCORD_CLIENT_ID');
    const redirectUri = `${this.configService.get<string>('BASE_URL')}/auth/callback`;
    const scope = 'identify email guilds';

    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;

    return res.redirect(authUrl);
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';

    if (error) {
      return res.redirect(`${frontendUrl}/login?error=access_denied`);
    }

    if (!code) {
      return res.redirect(`${frontendUrl}/login?error=no_code`);
    }

    try {
      const tokenData = await this.discordOAuth.exchangeCode(code);
      
      const userInfo = await this.discordOAuth.getUserInfo(tokenData.access_token);

      await this.sessionService.cacheUserInfo(userInfo);

      const sessionToken = await this.sessionService.createSession(
        userInfo.id,
        tokenData.access_token,
        tokenData.refresh_token,
        tokenData.expires_in,
        tokenData.scope,
      );

      res.cookie(this.SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: this.SESSION_COOKIE_MAX_AGE,
        sameSite: 'lax',
      });

      return res.redirect(`${frontendUrl}/dashboard`);
    } catch (err) {
      console.error('OAuth callback error:', err);
      return res.redirect(`${frontendUrl}/login?error=auth_failed`);
    }
  }

  @Get('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const sessionToken = req.cookies[this.SESSION_COOKIE_NAME];
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';

    if (sessionToken) {
      try {
        await this.sessionService.deleteSession(sessionToken);
      } catch (err) {
        console.error('Error deleting session:', err);
      }
    }

    res.clearCookie(this.SESSION_COOKIE_NAME);
    return res.redirect(`${frontendUrl}/login`);
  }

  @Get('me')
  async getMe(@Req() req: Request) {
    const sessionToken = req.cookies[this.SESSION_COOKIE_NAME];

    if (!sessionToken) {
      throw new UnauthorizedException('No session token');
    }

    const session = await this.sessionService.getSession(sessionToken);

    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    return {
      user: session.user,
    };
  }

  @Get('me/guilds')
  async getMyGuilds(@Req() req: Request) {
    const sessionToken = req.cookies[this.SESSION_COOKIE_NAME];

    if (!sessionToken) {
      throw new UnauthorizedException('No session token');
    }

    const session = await this.sessionService.getSession(sessionToken);

    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    const guilds = await this.sessionService.getUserGuilds(session);
    
    const manageableGuilds = guilds.filter(guild => 
      this.discordOAuth.canManageGuild(guild)
    );

    return {
      guilds: manageableGuilds,
      total: guilds.length,
    };
  }
}
