import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { TicketsModule } from '../tickets/tickets.module';
import { DiscordModule } from '../discord/discord.module';

@Module({
  imports: [DiscordModule, TicketsModule],
  providers: [BotService],
})
export class BotModule {}
