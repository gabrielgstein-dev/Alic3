import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  Client,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ThreadAutoArchiveDuration,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';

@Injectable()
export class ModNotificationService {
  private readonly logger = new Logger(ModNotificationService.name);
  private readonly reviewChannelId: string;

  constructor(
    private configService: ConfigService,
    private client: Client,
    private prisma: PrismaService,
  ) {
    this.reviewChannelId = this.configService.get<string>('MOD_REVIEW_CHANNEL_ID');
    
    if (!this.reviewChannelId) {
      this.logger.warn('MOD_REVIEW_CHANNEL_ID not configured - mod notifications will be disabled');
    } else {
      this.logger.log(`Mod review channel configured: ${this.reviewChannelId}`);
    }
  }

  async notifyModsDetected(postId: string): Promise<void> {
    if (!this.reviewChannelId) {
      this.logger.warn('Skipping mod notification - MOD_REVIEW_CHANNEL_ID not configured');
      return;
    }

    try {
      const post = await this.prisma.patreonPost.findUnique({
        where: { postId },
        include: {
          modAppearances: {
            where: { needsReview: true },
            include: {
              mod: {
                include: {
                  author: true,
                },
              },
            },
          },
          feed: {
            include: {
              author: true,
            },
          },
        },
      });

      if (!post || post.modAppearances.length === 0) {
        return;
      }

      const channel = await this.client.channels.fetch(this.reviewChannelId);

      if (!channel || !channel.isTextBased() || channel.isDMBased()) {
        this.logger.error('Review channel not found or not a guild text channel');
        return;
      }

      if (channel.type === ChannelType.GuildText) {
        const permissions = channel.permissionsFor(this.client.user);
        if (!permissions?.has(PermissionFlagsBits.ViewChannel)) {
          this.logger.error(`Bot does not have ViewChannel permission in channel ${this.reviewChannelId}`);
          return;
        }
        if (!permissions?.has(PermissionFlagsBits.SendMessages)) {
          this.logger.error(`Bot does not have SendMessages permission in channel ${this.reviewChannelId}`);
          return;
        }
        if (!permissions?.has(PermissionFlagsBits.EmbedLinks)) {
          this.logger.error(`Bot does not have EmbedLinks permission in channel ${this.reviewChannelId}`);
          return;
        }
      }

      const embed = this.buildMainEmbed(post);
      const components = this.buildComponents(post.modAppearances);

      const message = await channel.send({
        embeds: [embed],
        components,
      });

      if (post.modAppearances.length >= 2 && 'threads' in channel) {
        const thread = await channel.threads.create({
          name: `${post.title.substring(0, 80)} - Revisão`,
          autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
          startMessage: message,
        });

        await thread.send({
          content: '📋 Use os botões acima para gerenciar cada mod detectado.',
        });

        await this.prisma.patreonPost.update({
          where: { postId },
          data: {
            modAppearances: {
              updateMany: {
                where: { postId },
                data: {
                  discordThreadId: thread.id,
                },
              },
            },
          },
        });
      }

      await this.prisma.patreonPostMod.updateMany({
        where: { postId },
        data: { discordMessageId: message.id },
      });

      this.logger.log(`Mod review notification sent for post ${postId}`);
    } catch (error) {
      if (error.code === 50001) {
        this.logger.error(
          `Missing Access to channel ${this.reviewChannelId}. Check bot permissions (ViewChannel, SendMessages, EmbedLinks, CreatePublicThreads)`,
        );
      } else {
        this.logger.error(
          `Failed to send mod notification for ${postId}: ${error.message}`,
          error.stack,
        );
      }
    }
  }

  private buildMainEmbed(post: any): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('📦 Post com Mods Detectados')
      .setColor(0x5865f2)
      .setURL(post.url)
      .setTimestamp(post.publishedAt);

    embed.addFields({
      name: '🔗 Post',
      value: `[${post.title}](${post.url})`,
      inline: false,
    });

    embed.addFields({
      name: '📅 Publicado',
      value: `<t:${Math.floor(post.publishedAt.getTime() / 1000)}:R>`,
      inline: true,
    });

    if (post.campaign?.author) {
      embed.addFields({
        name: '👤 Autor',
        value: post.campaign.author.name,
        inline: true,
      });
    }

    const modsDescription = post.modAppearances
      .map((appearance, index) => {
        const emoji = this.getStatusEmoji(appearance);
        const version = appearance.detectedVersion
          ? ` (v${appearance.detectedVersion})`
          : ' (sem versão)';
        const confidence = Math.round(appearance.confidence * 100);

        let status = '';
        if (appearance.mod) {
          if (appearance.mod.isUpToDate) {
            status = `✅ Atualizado (${confidence}%)`;
          } else {
            const currentVer = appearance.mod.translatedVersion || 'N/A';
            status = `⚠️ Precisa atualizar (sua versão: ${currentVer})`;
          }
        } else {
          status = appearance.confidence >= 0.8
            ? `🔗 Similar a outro mod (${confidence}%)`
            : `❓ Não identificado (${confidence}%)`;
        }

        return `\n${index + 1}. **${appearance.detectedName}**${version}\n   └ ${status}`;
      })
      .join('\n');

    embed.addFields({
      name: '🎮 Mods Detectados',
      value: modsDescription || 'Nenhum mod detectado',
      inline: false,
    });

    return embed;
  }

  private buildComponents(modAppearances: any[]): ActionRowBuilder<any>[] {
    const rows: ActionRowBuilder<any>[] = [];

    if (modAppearances.length === 1) {
      const mod = modAppearances[0];
      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`mod_confirm_${mod.id}`)
          .setLabel('✅ Confirmar')
          .setStyle(ButtonStyle.Success)
          .setDisabled(mod.verified),
        new ButtonBuilder()
          .setCustomId(`mod_link_${mod.id}`)
          .setLabel('🔗 Vincular')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`mod_create_${mod.id}`)
          .setLabel('➕ Criar Novo')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`mod_ignore_${mod.id}`)
          .setLabel('❌ Ignorar')
          .setStyle(ButtonStyle.Danger),
      );

      rows.push(actionRow);
    } else if (modAppearances.length <= 5) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('mod_select_menu')
        .setPlaceholder('Selecione um mod para gerenciar')
        .addOptions(
          modAppearances.map((mod, index) => ({
            label: `${index + 1}. ${mod.detectedName}`,
            description: mod.detectedVersion
              ? `Versão ${mod.detectedVersion}`
              : 'Sem versão',
            value: mod.id,
            emoji: this.getStatusEmoji(mod),
          })),
        );

      rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));

      const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('mod_confirm_all')
          .setLabel('✅ Confirmar Todos')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('mod_ignore_all')
          .setLabel('❌ Ignorar Todos')
          .setStyle(ButtonStyle.Danger),
      );

      rows.push(buttonRow);
    } else {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('mod_select_menu')
        .setPlaceholder(`Selecione um dos ${modAppearances.length} mods`)
        .addOptions(
          modAppearances.slice(0, 25).map((mod, index) => ({
            label: `${index + 1}. ${mod.detectedName.substring(0, 80)}`,
            description: mod.detectedVersion || 'Sem versão',
            value: mod.id,
          })),
        );

      rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
    }

    return rows;
  }

  private getStatusEmoji(appearance: any): string {
    if (appearance.verified) return '✅';
    if (appearance.mod) {
      return appearance.mod.isUpToDate ? '✅' : '⚠️';
    }
    return appearance.confidence >= 0.8 ? '🔗' : '❓';
  }
}
