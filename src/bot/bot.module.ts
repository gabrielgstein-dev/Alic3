import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { DonateCommand } from './commands/donate.command';
import { TicketsModule } from '../tickets/tickets.module';
import { DiscordModule } from '../discord/discord.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [DiscordModule, TicketsModule, AdminModule],
  providers: [BotService, DonateCommand],
})
export class BotModule {}
