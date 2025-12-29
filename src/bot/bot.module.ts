import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { DonateCommand } from './commands/donate.command';
import { TicketsModule } from '../tickets/tickets.module';
import { DiscordModule } from '../discord/discord.module';

@Module({
  imports: [DiscordModule, TicketsModule],
  providers: [BotService, DonateCommand],
})
export class BotModule {}
