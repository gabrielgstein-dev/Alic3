import { Injectable } from '@nestjs/common';
import {
  TextChannel,
  MessageActionRowComponentBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { Client } from 'discord.js';
import { ConfigService } from '@nestjs/config';
import { getSelectMenuOptions } from '../components/ticket-options';
import { createSystemEmbed } from '../components/embed-components';

@Injectable()
export class TicketMessageService {
  private ticketChannelId: string;

  constructor(
    private client: Client,
    private configService: ConfigService,
  ) {
    this.ticketChannelId = this.configService.get<string>('TICKET_CHANNEL_ID');
  }

  async createTicketMessage() {
    const channel = this.client.channels.cache.get(
      this.ticketChannelId,
    ) as TextChannel;
    if (!channel) {
      console.error('Ticket channel not found');
      return;
    }

    const embed = createSystemEmbed();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_ticket')
      .setPlaceholder('Selecione uma categoria')
      .addOptions(getSelectMenuOptions());

    const row =
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        selectMenu,
      );

    await channel.send({
      embeds: [embed],
      components: [row],
    });

    console.log('Ticket message created');
  }

  async resetSelectMenu(message) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_ticket')
      .setPlaceholder('Selecione uma categoria')
      .addOptions(getSelectMenuOptions());

    const actionRow =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await message.edit({
      components: [actionRow],
    });
  }
}
