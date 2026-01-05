import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { DonateCommand } from './commands/donate.command';
import { ModManagementCommand } from './commands/mod-management.command';
import { TicketsModule } from '../tickets/tickets.module';
import { DiscordModule } from '../discord/discord.module';
import { AdminModule } from '../admin/admin.module';
import { PatreonModule } from '../patreon/patreon.module';

@Module({
  imports: [DiscordModule, TicketsModule, AdminModule, PatreonModule],
  providers: [BotService, DonateCommand, ModManagementCommand],
})
export class BotModule {}
