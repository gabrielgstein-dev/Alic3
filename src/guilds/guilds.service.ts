import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export interface GuildChannel {
  id: string;
  name: string;
  type: number;
  position: number;
  parentId: string | null;
}

export interface SendMessageDto {
  content: string;
  embeds: any[];
  components?: Array<{
    type: number;
    components: Array<{
      label: string;
      url: string;
      style: number;
    }>;
  }>;
}

@Injectable()
export class GuildsService {
  private readonly logger = new Logger(GuildsService.name);

  constructor(
    private readonly client: Client,
    private readonly configService: ConfigService,
  ) {}

  async getGuildChannels(guildId: string): Promise<GuildChannel[]> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      
      if (!guild) {
        throw new Error('Guild not found');
      }

      const channels = await guild.channels.fetch();
      
      const textChannels = channels
        .filter(channel => channel?.type === 0)
        .map(channel => ({
          id: channel!.id,
          name: channel!.name,
          type: channel!.type,
          position: channel!.position,
          parentId: channel!.parentId,
        }))
        .sort((a, b) => a.position - b.position);

      this.logger.log(`Retrieved ${textChannels.length} channels for guild ${guildId}`);
      
      return textChannels;
    } catch (error) {
      this.logger.error(`Failed to get channels for guild ${guildId}`, error);
      throw error;
    }
  }

  async sendMessage(guildId: string, channelId: string, messageDto: SendMessageDto, userId: string): Promise<void> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      
      if (!guild) {
        throw new Error('Guild not found');
      }

      const channel = await guild.channels.fetch(channelId);
      
      if (!channel || !(channel instanceof TextChannel)) {
        throw new Error('Channel not found or not a text channel');
      }

      const replacePlaceholders = (text: string): string => {
        return text
          .replace(/{user_id}/g, userId)
          .replace(/{user\.id}/g, userId);
      };

      const components = messageDto.components?.map((actionRow, rowIndex) => {
        const row = new ActionRowBuilder<ButtonBuilder>();
        
        actionRow.components.forEach((button, btnIndex) => {
          const btn = new ButtonBuilder()
            .setLabel(replacePlaceholders(button.label || 'Botão'))
            .setStyle(button.style || ButtonStyle.Secondary);
          
          if (button.style === 5) {
            // Botão Link - precisa de URL
            if (button.url) {
              btn.setURL(replacePlaceholders(button.url));
            }
          } else {
            // Botões interativos (1-4) - precisam de custom_id
            btn.setCustomId(`button_${rowIndex}_${btnIndex}_${Date.now()}`);
          }
          
          row.addComponents(btn);
        });
        
        return row;
      });

      await channel.send({
        content: messageDto.content || undefined,
        embeds: messageDto.embeds,
        components: components || undefined,
      });

      this.logger.log(`Message sent to channel ${channelId} in guild ${guildId}`);
    } catch (error) {
      this.logger.error(`Failed to send message to channel ${channelId} in guild ${guildId}`, error);
      throw error;
    }
  }
}
