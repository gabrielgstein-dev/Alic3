import { Injectable, Logger } from '@nestjs/common';
import { EmbedBuilder, ColorResolvable, TextChannel } from 'discord.js';

export interface EmbedData {
  title?: string;
  description?: string;
  color?: string;
  footer?: {
    text: string;
    iconUrl?: string;
  };
  author?: {
    name: string;
    iconUrl?: string;
    url?: string;
  };
  thumbnail?: string;
  image?: string;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  timestamp?: boolean;
  url?: string;
}

@Injectable()
export class EmbedBuilderService {
  private readonly logger = new Logger(EmbedBuilderService.name);

  buildEmbed(data: EmbedData): EmbedBuilder {
    const embed = new EmbedBuilder();

    if (data.title) embed.setTitle(data.title);
    if (data.description) embed.setDescription(data.description);
    if (data.color) {
      const color = this.parseColor(data.color);
      if (color) embed.setColor(color);
    }
    if (data.url) embed.setURL(data.url);
    
    if (data.footer) {
      embed.setFooter({
        text: data.footer.text,
        iconURL: data.footer.iconUrl,
      });
    }

    if (data.author) {
      embed.setAuthor({
        name: data.author.name,
        iconURL: data.author.iconUrl,
        url: data.author.url,
      });
    }

    if (data.thumbnail) embed.setThumbnail(data.thumbnail);
    if (data.image) embed.setImage(data.image);

    if (data.fields && data.fields.length > 0) {
      embed.addFields(data.fields);
    }

    if (data.timestamp) embed.setTimestamp();

    return embed;
  }

  private parseColor(color: string): ColorResolvable | null {
    if (color.startsWith('#')) {
      return color as ColorResolvable;
    }

    const hexColor = color.toLowerCase();
    const colorMap: Record<string, number> = {
      'azul': 0x3498db,
      'verde': 0x2ecc71,
      'vermelho': 0xe74c3c,
      'amarelo': 0xf1c40f,
      'roxo': 0x9b59b6,
      'rosa': 0xe91e63,
      'laranja': 0xe67e22,
      'cinza': 0x95a5a6,
      'preto': 0x000000,
      'branco': 0xffffff,
    };

    if (colorMap[hexColor]) {
      return colorMap[hexColor];
    }

    const hexMatch = color.match(/^(?:#)?([0-9a-f]{6})$/i);
    if (hexMatch) {
      return parseInt(hexMatch[1], 16);
    }

    return 0x3498db;
  }

  async sendEmbedToChannel(
    channel: TextChannel,
    embedData: EmbedData,
  ): Promise<void> {
    try {
      const embed = this.buildEmbed(embedData);
      await channel.send({ embeds: [embed] });
      this.logger.log(`Embed enviado para o canal ${channel.name}`);
    } catch (error) {
      this.logger.error(`Erro ao enviar embed para o canal ${channel.name}`, error);
      throw error;
    }
  }

  validateEmbedData(data: Partial<EmbedData>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.title && !data.description) {
      errors.push('Embed deve ter pelo menos um título ou descrição');
    }

    if (data.title && data.title.length > 256) {
      errors.push('Título não pode ter mais de 256 caracteres');
    }

    if (data.description && data.description.length > 4096) {
      errors.push('Descrição não pode ter mais de 4096 caracteres');
    }

    if (data.fields) {
      if (data.fields.length > 25) {
        errors.push('Embed não pode ter mais de 25 campos');
      }

      data.fields.forEach((field, index) => {
        if (field.name.length > 256) {
          errors.push(`Campo ${index + 1}: Nome não pode ter mais de 256 caracteres`);
        }
        if (field.value.length > 1024) {
          errors.push(`Campo ${index + 1}: Valor não pode ter mais de 1024 caracteres`);
        }
      });
    }

    if (data.footer && data.footer.text.length > 2048) {
      errors.push('Footer não pode ter mais de 2048 caracteres');
    }

    if (data.author && data.author.name.length > 256) {
      errors.push('Nome do autor não pode ter mais de 256 caracteres');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
