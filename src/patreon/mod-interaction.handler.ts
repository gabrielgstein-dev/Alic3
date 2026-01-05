import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client, Interaction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { PrismaService } from '../prisma/prisma.service';
import { ModNotificationService } from './mod-notification.service';

@Injectable()
export class ModInteractionHandler implements OnModuleInit {
  private readonly logger = new Logger(ModInteractionHandler.name);

  constructor(
    private client: Client,
    private prisma: PrismaService,
    private modNotificationService: ModNotificationService,
  ) {}

  onModuleInit() {
    this.client.on('interactionCreate', async (interaction: Interaction) => {
      try {
        if (interaction.isButton()) {
          await this.handleButtonInteraction(interaction);
        } else if (interaction.isStringSelectMenu()) {
          await this.handleSelectMenuInteraction(interaction);
        } else if (interaction.isModalSubmit()) {
          await this.handleModalSubmit(interaction);
        }
      } catch (error) {
        this.logger.error('Error handling interaction', error.stack);
        
        if (interaction.isRepliable() && !interaction.replied) {
          await interaction.reply({
            content: '❌ Erro ao processar a interação. Tente novamente.',
            ephemeral: true,
          }).catch(() => {});
        }
      }
    });

    this.logger.log('Mod interaction handlers registered');
  }

  private async handleButtonInteraction(interaction: any) {
    const customId = interaction.customId;

    if (customId.startsWith('mod_confirm_')) {
      await this.handleConfirm(interaction, customId.replace('mod_confirm_', ''));
    } else if (customId.startsWith('mod_link_')) {
      await this.handleLink(interaction, customId.replace('mod_link_', ''));
    } else if (customId.startsWith('mod_create_')) {
      await this.handleCreate(interaction, customId.replace('mod_create_', ''));
    } else if (customId.startsWith('mod_ignore_')) {
      await this.handleIgnore(interaction, customId.replace('mod_ignore_', ''));
    } else if (customId === 'mod_confirm_all') {
      await this.handleConfirmAll(interaction);
    } else if (customId === 'mod_ignore_all') {
      await this.handleIgnoreAll(interaction);
    }
  }

  private async handleSelectMenuInteraction(interaction: any) {
    if (interaction.customId === 'mod_select_menu') {
      const postModId = interaction.values[0];
      
      const postMod = await this.prisma.patreonPostMod.findUnique({
        where: { id: postModId },
        include: { mod: true },
      });

      if (!postMod) {
        await interaction.reply({
          content: '❌ Mod não encontrado.',
          ephemeral: true,
        });
        return;
      }

      const buttons = new ActionRowBuilder<any>().addComponents(
        {
          type: 2,
          style: 3,
          label: '✅ Confirmar',
          custom_id: `mod_confirm_${postModId}`,
        },
        {
          type: 2,
          style: 1,
          label: '🔗 Vincular',
          custom_id: `mod_link_${postModId}`,
        },
        {
          type: 2,
          style: 2,
          label: '➕ Criar Novo',
          custom_id: `mod_create_${postModId}`,
        },
        {
          type: 2,
          style: 4,
          label: '❌ Ignorar',
          custom_id: `mod_ignore_${postModId}`,
        },
      );

      await interaction.reply({
        content: `📦 **${postMod.detectedName}** ${postMod.detectedVersion ? `(v${postMod.detectedVersion})` : '(sem versão)'}\n\nEscolha uma ação:`,
        components: [buttons],
        ephemeral: true,
      });
    }
  }

  private async handleConfirm(interaction: any, postModId: string) {
    const postMod = await this.prisma.patreonPostMod.findUnique({
      where: { id: postModId },
      include: { mod: true, post: true },
    });

    if (!postMod || !postMod.mod) {
      await interaction.reply({
        content: '❌ Não há mod vinculado para confirmar.',
        ephemeral: true,
      });
      return;
    }

    await this.prisma.patreonPostMod.update({
      where: { id: postModId },
      data: { verified: true, needsReview: false },
    });

    if (postMod.normalizedVersion && postMod.mod.translatedVersionNormalized !== postMod.normalizedVersion) {
      await this.prisma.mod.update({
        where: { id: postMod.modId },
        data: {
          latestVersion: postMod.detectedVersion,
          latestVersionNormalized: postMod.normalizedVersion,
          latestVersionDate: postMod.post.publishedAt,
          isUpToDate: false,
        },
      });
    }

    await this.prisma.modLinkHistory.create({
      data: {
        modId: postMod.modId,
        postModId: postModId,
        action: 'verified',
        userId: interaction.user.id,
        metadata: { detectedVersion: postMod.detectedVersion },
      },
    });

    await interaction.reply({
      content: `✅ Mod **${postMod.mod.primaryName}** confirmado!`,
      ephemeral: true,
    });

    await this.updateMessageAfterAction(interaction.message);

    this.logger.log(`Mod ${postMod.mod.primaryName} verified by ${interaction.user.tag}`);
  }

  private async handleLink(interaction: any, postModId: string) {
    const postMod = await this.prisma.patreonPostMod.findUnique({
      where: { id: postModId },
      include: { post: { include: { feed: { include: { author: true } } } }, mod: true },
    });

    if (!postMod) {
      await interaction.reply({
        content: '❌ Mod não encontrado.',
        ephemeral: true,
      });
      return;
    }

    const authorId = postMod.post.feed?.author?.id;
    const mods = authorId
      ? await this.prisma.mod.findMany({
          where: { authorId, isActive: true },
          select: { id: true, primaryName: true },
        })
      : [];

    if (mods.length === 0) {
      await interaction.reply({
        content: '❌ Nenhum mod cadastrado para este autor.',
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`mod_link_modal_${postModId}`)
      .setTitle('Vincular Mod');

    const modIdInput = new TextInputBuilder()
      .setCustomId('mod_id')
      .setLabel('ID do Mod (ou nome)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Digite o ID ou nome do mod')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(modIdInput),
    );

    await interaction.showModal(modal);
  }

  private async handleCreate(interaction: any, postModId: string) {
    const modal = new ModalBuilder()
      .setCustomId(`mod_create_modal_${postModId}`)
      .setTitle('Criar Novo Mod');

    const nameInput = new TextInputBuilder()
      .setCustomId('mod_name')
      .setLabel('Nome do Mod')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const curseForgeInput = new TextInputBuilder()
      .setCustomId('curseforge_url')
      .setLabel('URL do CurseForge (opcional)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(curseForgeInput),
    );

    await interaction.showModal(modal);
  }

  private async handleIgnore(interaction: any, postModId: string) {
    const postMod = await this.prisma.patreonPostMod.findUnique({
      where: { id: postModId },
      include: { post: true },
    });

    await this.prisma.patreonPostMod.update({
      where: { id: postModId },
      data: { needsReview: false, verified: false },
    });

    await interaction.reply({
      content: '❌ Mod ignorado.',
      ephemeral: true,
    });

    await this.updateMessageAfterAction(interaction.message);
  }

  private async updateMessageAfterAction(message: any) {
    try {
      const remainingMods = await this.prisma.patreonPostMod.findMany({
        where: {
          discordMessageId: message.id,
          needsReview: true,
        },
        include: {
          mod: { include: { author: true } },
          post: { include: { feed: true } },
        },
      });

      if (remainingMods.length === 0) {
        await message.edit({
          content: '✅ **Todos os mods foram revisados!**',
          embeds: [],
          components: [],
        });
      } else {
        const post = remainingMods[0].post;
        const embed = message.embeds[0];
        
        let modsText = '';
        remainingMods.forEach((pm, idx) => {
          const status = pm.mod
            ? `✅ Identificado (${Math.round(pm.confidence * 100)}%)`
            : `❓ Não identificado (0%)`;
          
          modsText += `${idx + 1}. **${pm.detectedName}** (v${pm.detectedVersion || 'N/A'})\n`;
          modsText += `   └ ${status}\n`;
        });

        embed.data.fields[0].value = modsText;

        await message.edit({
          embeds: [embed],
          components: message.components,
        });
      }
    } catch (error) {
      this.logger.error('Failed to update message after action', error.stack);
    }
  }

  private async handleConfirmAll(interaction: any) {
    const messageId = interaction.message.id;
    
    const postMods = await this.prisma.patreonPostMod.findMany({
      where: { discordMessageId: messageId, needsReview: true },
      include: { mod: true },
    });

    let confirmed = 0;
    for (const postMod of postMods) {
      if (postMod.mod) {
        await this.prisma.patreonPostMod.update({
          where: { id: postMod.id },
          data: { verified: true, needsReview: false },
        });
        confirmed++;
      }
    }

    await interaction.reply({
      content: `✅ ${confirmed} mod(s) confirmado(s)!`,
      ephemeral: true,
    });
  }

  private async handleIgnoreAll(interaction: any) {
    const messageId = interaction.message.id;
    
    await this.prisma.patreonPostMod.updateMany({
      where: { discordMessageId: messageId },
      data: { needsReview: false },
    });

    await interaction.reply({
      content: '❌ Todos os mods ignorados.',
      ephemeral: true,
    });
  }

  private async handleModalSubmit(interaction: any) {
    const customId = interaction.customId;

    if (customId.startsWith('mod_link_modal_')) {
      const postModId = customId.replace('mod_link_modal_', '');
      const modIdentifier = interaction.fields.getTextInputValue('mod_id');

      const mod = await this.prisma.mod.findFirst({
        where: {
          OR: [
            { id: modIdentifier },
            { primaryName: { contains: modIdentifier, mode: 'insensitive' } },
            { slug: modIdentifier },
          ],
        },
      });

      if (!mod) {
        await interaction.reply({
          content: `❌ Mod "${modIdentifier}" não encontrado.`,
          ephemeral: true,
        });
        return;
      }

      await this.prisma.patreonPostMod.update({
        where: { id: postModId },
        data: { modId: mod.id, verified: true, needsReview: false },
      });

      await this.prisma.modLinkHistory.create({
        data: {
          modId: mod.id,
          postModId: postModId,
          action: 'linked',
          userId: interaction.user.id,
        },
      });

      await interaction.reply({
        content: `🔗 Vinculado a **${mod.primaryName}**!`,
        ephemeral: true,
      });

      await this.updateMessageAfterAction(interaction.message);

    } else if (customId.startsWith('mod_create_modal_')) {
      const postModId = customId.replace('mod_create_modal_', '');
      const modName = interaction.fields.getTextInputValue('mod_name');
      const curseForgeUrl = interaction.fields.getTextInputValue('curseforge_url') || null;

      const postMod = await this.prisma.patreonPostMod.findUnique({
        where: { id: postModId },
        include: { post: { include: { feed: { include: { author: true } } } } },
      });

      if (!postMod?.post.feed?.author) {
        await interaction.reply({
          content: '❌ Autor não encontrado.',
          ephemeral: true,
        });
        return;
      }

      const slug = modName.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');

      const newMod = await this.prisma.mod.create({
        data: {
          authorId: postMod.post.feed.author.id,
          primaryName: modName,
          slug,
          normalizedName: slug,
          curseForgeUrl,
          latestVersion: postMod.detectedVersion,
          latestVersionNormalized: postMod.normalizedVersion,
          latestVersionDate: postMod.post.publishedAt,
        },
      });

      await this.prisma.patreonPostMod.update({
        where: { id: postModId },
        data: { modId: newMod.id, verified: true, needsReview: false },
      });

      await this.prisma.modLinkHistory.create({
        data: {
          modId: newMod.id,
          postModId: postModId,
          action: 'created',
          userId: interaction.user.id,
        },
      });

      await interaction.reply({
        content: `✅ Mod **${newMod.primaryName}** criado e vinculado!`,
        ephemeral: true,
      });

      await this.updateMessageAfterAction(interaction.message);
    }
  }
}
