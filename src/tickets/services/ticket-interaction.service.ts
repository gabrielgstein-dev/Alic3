import { Injectable } from '@nestjs/common';
import {
  Client,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuInteraction,
  ChannelType,
  ButtonInteraction,
  ModalSubmitInteraction,
  TextChannel,
} from 'discord.js';
import { ConfigService } from '@nestjs/config';
import { TicketMessageService } from './ticket-message.service';
import { TicketBuilder } from './ticket-builder';

@Injectable()
export class TicketInteractionService {
  constructor(
    private client: Client,
    private configService: ConfigService,
    private ticketMessageService: TicketMessageService,
  ) {}

  async handleSelectMenuInteraction(interaction: StringSelectMenuInteraction) {
    const modal = new ModalBuilder()
      .setCustomId('ticket_modal')
      .setTitle('Preencha para abrir o ticket');

    const ticketSubjectInput = new TextInputBuilder()
      .setCustomId('ticket_subject')
      .setLabel('Informe o assunto do ticket:')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Detalhe o que aconteceu ou sua dúvida aqui!')
      .setRequired(true)
      .setMinLength(5)
      .setMaxLength(4000);

    const firstActionRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        ticketSubjectInput,
      );

    modal.addComponents(firstActionRow);

    const selectedCategory = interaction.values[0];

    const existingChannel = interaction.guild.channels.cache.find(
      (channel) =>
        channel.name.includes(`suporte-${interaction.user.username}`) &&
        channel.type === ChannelType.GuildText,
    );

    if (existingChannel) {
      await interaction.reply({
        content:
          'Você já possui um ticket aberto. Por favor, feche o ticket existente antes de abrir um novo.',
        ephemeral: true,
      });

      await this.ticketMessageService.resetSelectMenu(interaction.message);

      return;
    }

    await interaction.showModal(modal);

    const filter = (i) =>
      i.customId === 'ticket_modal' && i.user.id === interaction.user.id;
    const modalInteraction = await interaction
      .awaitModalSubmit({ filter, time: 60000 })
      .catch((error) => {
        console.error('Error awaiting modal submit:', error);
        return null;
      });

    if (!modalInteraction) {
      await interaction.followUp({
        content:
          'Tempo esgotado para preencher o formulário. Por favor, tente novamente.',
        ephemeral: true,
      });
      await this.ticketMessageService.resetSelectMenu(interaction.message);
      return;
    }

    await modalInteraction.deferReply({ ephemeral: true });
    try {
      const ticketSubject =
        modalInteraction.fields.getTextInputValue('ticket_subject');
      const guild = modalInteraction.guild;

      const supportRoleIds =
        this.configService.get<string>('SUPPORT_ROLE_IDS')?.split(',') || [];

      const ticketBuilder = new TicketBuilder(
        this.client,
        guild,
        modalInteraction.user,
        ticketSubject,
        supportRoleIds,
      );

      const channel = await ticketBuilder.createTicketChannel();
      await ticketBuilder.sendInitialMessage(channel);
      await ticketBuilder.sendConfirmation(
        modalInteraction,
        channel,
        selectedCategory,
      );

      await this.ticketMessageService.resetSelectMenu(interaction.message);
    } catch (error) {
      console.error('Error creating ticket:', error);
      await modalInteraction.followUp({
        content:
          'Houve um erro ao criar seu ticket. Por favor, tente novamente mais tarde.',
        ephemeral: true,
      });

      await this.ticketMessageService.resetSelectMenu(interaction.message);
    }
  }

  async handleAddMember(interaction: ButtonInteraction) {
    const modal = new ModalBuilder()
      .setCustomId('addMemberModal')
      .setTitle('Adicionar Membro');

    const memberIdInput = new TextInputBuilder()
      .setCustomId('memberId')
      .setLabel('ID ou Nome do Membro (ex: Usuario#1234)')
      .setStyle(TextInputStyle.Short);

    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
      memberIdInput,
    );

    modal.addComponents(actionRow);

    await interaction.showModal(modal);
  }

  async handleRemoveMember(interaction: ButtonInteraction) {
    const modal = new ModalBuilder()
      .setCustomId('removeMemberModal')
      .setTitle('Remover Membro');

    const memberIdInput = new TextInputBuilder()
      .setCustomId('memberId')
      .setLabel('ID ou Nome do Membro (ex: Usuario#1234)')
      .setStyle(TextInputStyle.Short);

    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
      memberIdInput,
    );

    modal.addComponents(actionRow);

    await interaction.showModal(modal);
  }

  async handleConfig(interaction: ButtonInteraction) {
    await interaction.reply({
      content: 'Configurações do ticket ainda não implementadas.',
      ephemeral: true,
    });
  }

  async handleModalSubmit(interaction: ModalSubmitInteraction) {
    const customId = interaction.customId;

    await interaction.deferReply({ ephemeral: true });

    if (customId === 'addMemberModal') {
      const memberIdOrTag = interaction.fields.getTextInputValue('memberId');
      await this.addMemberToChannel(interaction, memberIdOrTag);
    } else if (customId === 'removeMemberModal') {
      const memberIdOrTag = interaction.fields.getTextInputValue('memberId');
      await this.removeMemberFromChannel(interaction, memberIdOrTag);
    }
  }

  private async addMemberToChannel(
    interaction: ModalSubmitInteraction,
    memberIdOrTag: string,
  ) {
    try {
      const guild = interaction.guild;
      let member;

      try {
        member = await guild.members.fetch(memberIdOrTag);
      } catch {
        const members = await guild.members.fetch({ query: memberIdOrTag, limit: 10 });
        
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
            content: `Vários membros encontrados. Use o ID do usuário. Membros:\n${memberOptions}`,
          });
          return;
        }
      }

      if (!member) {
        await interaction.editReply({
          content: 'Membro não encontrado.',
        });
        return;
      }

      const channel = interaction.channel as TextChannel;
      
      await channel.permissionOverwrites.create(member, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });

      await interaction.editReply({
        content: `Membro ${member.user.tag} adicionado ao ticket.`,
      });
    } catch (error) {
      console.error('Error adding member:', error);
      await interaction.editReply({
        content: 'Falha ao adicionar o membro. Verifique se o ID ou nome está correto.',
      });
    }
  }

  private async removeMemberFromChannel(
    interaction: ModalSubmitInteraction,
    memberIdOrTag: string,
  ) {
    try {
      const guild = interaction.guild;
      let member;

      try {
        member = await guild.members.fetch(memberIdOrTag);
      } catch {
        const members = await guild.members.fetch({ query: memberIdOrTag, limit: 10 });
        
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
            content: `Vários membros encontrados. Use o ID do usuário. Membros:\n${memberOptions}`,
          });
          return;
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

      if (!permissionOverwrites.has(member.id)) {
        await interaction.editReply({
          content: 'Este membro não está no canal do ticket.',
        });
        return;
      }

      await channel.permissionOverwrites.delete(member);

      await interaction.editReply({
        content: `Membro ${member.user.tag} removido do ticket.`,
      });
    } catch (error) {
      console.error('Error fetching member:', error);
      await interaction.editReply({
        content: 'Falha ao buscar o membro. Verifique se o ID ou nome está correto.',
      });
    }
  }
}
