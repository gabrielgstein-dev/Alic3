import { Controller, Get, Post, Param, Body, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { GuildsService } from './guilds.service';
import { SessionService } from '../auth/session.service';

interface SendMessageDto {
  content: string;
  embeds: any[];
  components?: Array<{
    type: number;
    components: Array<{
      label: string;
      url: string;
      style: number;
    }>;
  }>;
}

@Controller('guilds')
export class GuildsController {
  private readonly SESSION_COOKIE_NAME = 'alic3_session';

  constructor(
    private readonly guildsService: GuildsService,
    private readonly sessionService: SessionService,
  ) {}

  @Get(':guildId/channels')
  async getGuildChannels(@Param('guildId') guildId: string, @Req() req: Request) {
    const sessionToken = req.cookies[this.SESSION_COOKIE_NAME];

    if (!sessionToken) {
      throw new UnauthorizedException('No session token');
    }

    const session = await this.sessionService.getSession(sessionToken);

    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    const channels = await this.guildsService.getGuildChannels(guildId);

    return {
      channels,
    };
  }

  @Post(':guildId/channels/:channelId/messages')
  async sendMessage(
    @Param('guildId') guildId: string,
    @Param('channelId') channelId: string,
    @Body() messageDto: SendMessageDto,
    @Req() req: Request,
  ) {
    const sessionToken = req.cookies[this.SESSION_COOKIE_NAME];

    if (!sessionToken) {
      throw new UnauthorizedException('No session token');
    }

    const session = await this.sessionService.getSession(sessionToken);

    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    await this.guildsService.sendMessage(guildId, channelId, messageDto, session.userId);

    return {
      success: true,
    };
  }
}
