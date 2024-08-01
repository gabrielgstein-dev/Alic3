import { Injectable } from '@nestjs/common';
import {
  ButtonInteraction,
  ModalSubmitInteraction,
  TextChannel,
} from 'discord.js';
import { createModalMemberName } from '../components/modal-components';

@Injectable()
export class TicketAddMemberService {
  async handleAddMemberModal(interaction: ButtonInteraction) {
    const modal = createModalMemberName({
      customId: 'addMemberModal',
      title: 'Adicionar Membro',
    });

    await interaction.showModal(modal);
  }

  async addMemberToChannel(
    interaction: ModalSubmitInteraction,
    memberIdOrTag: string,
  ) {
    let member;
    try {
      if (/^\d+$/.test(memberIdOrTag)) {
        member = await interaction.guild.members.fetch(memberIdOrTag);
      } else {
        const [username, discriminator] = memberIdOrTag.split('#');
        let members;
        if (discriminator) {
          members = await interaction.guild.members.fetch({
            query: username,
            limit: 10,
          });
          member = members.find(
            (m) =>
              m.user.username === username &&
              m.user.discriminator === discriminator,
          );
        } else {
          members = await interaction.guild.members.fetch({
            query: username,
            limit: 10,
          });

          if (members.size === 0) {
            await interaction.editReply({
              content: 'Membro não encontrado.',
            });
            return;
          }

          if (members.size === 1) {
            member = members.first();
          } else {
            const memberOptions = members
              .map((m) => `${m.user.tag} (${m.user.id})`)
              .join('\n');

            await interaction.editReply({
              content: `Vários membros encontrados. Por favor, forneça o discriminador. Nomes encontrados:\n${memberOptions}`,
            });
            return;
          }
        }
      }

      if (!member) {
        await interaction.editReply({
          content: 'Membro não encontrado.',
        });
        return;
      }

      const channel = interaction.channel as TextChannel;
      const permissionOverwrites = channel.permissionOverwrites.cache;

      if (permissionOverwrites.has(member.id)) {
        await interaction.editReply({
          content: 'Este membro já está no canal do ticket.',
        });
        return;
      }

      await channel.permissionOverwrites.edit(member, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });

      await interaction.editReply({
        content: `Membro ${member.user.tag} adicionado ao ticket.`,
      });
    } catch (error) {
      console.error('Error fetching member:', error);
      await interaction.editReply({
        content:
          'Falha ao buscar o membro. Verifique se o ID ou nome está correto.',
      });
    }
  }
}
