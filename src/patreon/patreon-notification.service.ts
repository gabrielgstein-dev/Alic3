import { Injectable, Logger, Inject } from '@nestjs/common';
import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { PatreonPostData } from './interfaces/patreon-api.interface';

@Injectable()
export class PatreonNotificationService {
  private readonly logger = new Logger(PatreonNotificationService.name);

  constructor(@Inject(Client) private readonly client: Client) {}

  async sendNewPostNotification(
    channelId: string,
    post: PatreonPostData,
    creatorName: string,
  ): Promise<void> {
    try {
      const channel = this.client.channels.cache.get(
        channelId,
      ) as TextChannel;

      if (!channel) {
        this.logger.error(`Channel ${channelId} not found`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xff424d)
        .setTitle(`🎨 Novo Post no Patreon - ${creatorName}`)
        .setDescription(`**${post.attributes.title}**`)
        .addFields([
          {
            name: '📝 Tipo',
            value: this.formatPostType(post.attributes.post_type),
            inline: true,
          },
          {
            name: '📅 Publicado',
            value: this.formatDate(post.attributes.published_at),
            inline: true,
          },
        ])
        .setURL(post.attributes.url)
        .setFooter({ text: 'Clique no título para ver o post completo' })
        .setTimestamp();

      if (post.attributes.min_cents_pledged_to_view) {
        const minDollars = post.attributes.min_cents_pledged_to_view / 100;
        embed.addFields([
          {
            name: '💎 Tier Mínimo',
            value: `$${minDollars.toFixed(2)}`,
            inline: true,
          },
        ]);
      }

      if (post.attributes.content) {
        const preview = this.truncateContent(post.attributes.content, 200);
        embed.addFields([
          {
            name: '📄 Prévia',
            value: preview,
            inline: false,
          },
        ]);
      }

      await channel.send({
        content: '🔔 **Nova atualização detectada!**',
        embeds: [embed],
      });

      this.logger.log(
        `Notification sent for post: ${post.attributes.title} to channel ${channelId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send notification for post ${post.id}:`,
        error.message,
      );
    }
  }

  private formatPostType(type: string): string {
    const types: Record<string, string> = {
      image_file: '🖼️ Imagem',
      video_file: '🎬 Vídeo',
      audio_file: '🎵 Áudio',
      text_only: '📝 Texto',
      link: '🔗 Link',
    };
    return types[type] || '📄 Post';
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
  }

  private truncateContent(content: string, maxLength: number): string {
    const stripped = content
      .replace(/<[^>]*>/g, '')
      .replace(/\n+/g, ' ')
      .trim();
    return stripped.length > maxLength
      ? stripped.substring(0, maxLength) + '...'
      : stripped;
  }
}
