import { Injectable } from '@nestjs/common';
import { TextChannel, ButtonInteraction } from 'discord.js';
import { SourceBinService } from './sourcebin.service';
import { createTicketClosedEmbed } from '../components/embed-components';
import { createTicketHistoryButton } from '../components/button-components';

@Injectable()
export class TicketCloseService {
  constructor(private sourceBinService: SourceBinService) {}

  async handleCloseTicket(interaction: ButtonInteraction) {
    try {
      const channel = interaction.channel as TextChannel;
      const messages = await channel.messages.fetch();

      const filteredMessages = messages
        .filter((msg) => msg.content)
        .map((msg) => {
          const date = new Date(msg.createdTimestamp);
          const formattedDate = date.toLocaleString('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'medium',
          });
          return `${formattedDate} - ${msg.author.tag}: ${msg.content}`;
        })
        .join('\n');

      if (!filteredMessages) {
        await interaction.reply({
          content: 'Não há mensagens para salvar.',
          ephemeral: true,
        });
        await channel.delete();
        return;
      }

      const username = channel.name.split('-')[1];
      const user = channel.guild.members.cache.find(
        (member) => member.user.username === username,
      )?.user;

      if (!user) {
        await interaction.reply({
          content: 'Não foi possível encontrar o usuário que abriu o ticket.',
          ephemeral: true,
        });
        return;
      }

      const userId = user.id;
      const title = 'Logs do TICKET';
      const description = `Logs do usuário portador do ID: ${userId}`;
      const history = filteredMessages;

      const url = await this.sourceBinService.createPaste(
        history,
        title,
        description,
      );

      const ticketNumber = interaction.id; // Número do ticket
      const embed = createTicketClosedEmbed(interaction, user, ticketNumber);
      const buttonRow = createTicketHistoryButton(url);

      await user.send({ embeds: [embed], components: [buttonRow] });

      await channel.delete();
    } catch (error) {
      console.error('Error closing ticket:', error);

      // Verificar se a interação já foi respondida
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Falha ao salvar o histórico do ticket.',
            ephemeral: true,
          });
        } else {
          await interaction.followUp({
            content: 'Falha ao salvar o histórico do ticket.',
            ephemeral: true,
          });
        }
      } catch (followUpError) {
        console.error('Error sending follow-up message:', followUpError);
      }
    }
  }
}
