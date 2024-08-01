import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketMessageService } from './services/ticket-message.service';
import { TicketInteractionService } from './services/ticket-interaction.service';
import { TicketCloseService } from './services/ticket-close.service';
import { SourceBinService } from './services/sourcebin.service';
import { HttpModule } from '@nestjs/axios';
import { DiscordModule } from '../discord/discord.module';
import { MemberLookupService } from '../shared/services/member-lookup.service';

@Module({
  imports: [DiscordModule, HttpModule],
  providers: [
    TicketsService,
    TicketMessageService,
    TicketInteractionService,
    TicketCloseService,
    SourceBinService,
    MemberLookupService,
  ],
  exports: [TicketsService],
})
export class TicketsModule {}
