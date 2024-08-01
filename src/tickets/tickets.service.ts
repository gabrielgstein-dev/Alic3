import { Injectable } from '@nestjs/common';
import { ButtonInteraction, ModalSubmitInteraction } from 'discord.js';
import { TicketMessageService } from './services/ticket-message.service';
import { TicketInteractionService } from './services/ticket-interaction.service';
import { TicketCloseService } from './services/ticket-close.service';

@Injectable()
export class TicketsService {
  constructor(
    private ticketMessageService: TicketMessageService,
    private ticketInteractionService: TicketInteractionService,
    private ticketCloseService: TicketCloseService,
  ) {}

  async createTicketMessage() {
    return this.ticketMessageService.createTicketMessage();
  }

  async handleSelectMenuInteraction(interaction) {
    return this.ticketInteractionService.handleSelectMenuInteraction(
      interaction,
    );
  }

  async resetSelectMenu(message) {
    return this.ticketMessageService.resetSelectMenu(message);
  }

  async closeTicket(interaction: ButtonInteraction) {
    return this.ticketCloseService.handleCloseTicket(interaction);
  }

  async handleAddMember(interaction: ButtonInteraction) {
    await this.ticketInteractionService.handleAddMember(interaction);
  }

  async handleRemoveMember(interaction: ButtonInteraction) {
    await this.ticketInteractionService.handleRemoveMember(interaction);
  }

  async handleConfig(interaction: ButtonInteraction) {
    await this.ticketInteractionService.handleConfig(interaction);
  }

  async handleModalSubmit(interaction: ModalSubmitInteraction) {
    await this.ticketInteractionService.handleModalSubmit(interaction);
  }
}
