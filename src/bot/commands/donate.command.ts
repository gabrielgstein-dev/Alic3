import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder 
} from 'discord.js';

@Injectable()
export class DonateCommand {
  private donationUrl: string;

  constructor(private configService: ConfigService) {
    const baseUrl = this.configService.get<string>('BASE_URL') || 'http://localhost:3000';
    this.donationUrl = `${baseUrl}/donate`;
  }

  createDonateEmbed() {
    const embed = new EmbedBuilder()
      .setColor('#667eea')
      .setTitle('💜 Apoie o Servidor')
      .setDescription(
        'Faça uma doação e receba benefícios exclusivos automaticamente!\n\n' +
        '**Níveis de Apoio:**\n' +
        '⭐ **Apoiador** - A partir de R$ 5,00\n' +
        '🥇 **Apoiador Dourado** - A partir de R$ 20,00\n' +
        '💎 **Apoiador Diamante** - A partir de R$ 50,00\n\n' +
        '**Como funciona:**\n' +
        '1️⃣ Clique no botão abaixo\n' +
        '2️⃣ Escolha o valor da doação\n' +
        '3️⃣ Complete o pagamento\n' +
        '4️⃣ Receba sua role automaticamente!\n\n' +
        '✨ A role é válida por 30 dias!'
      )
      .setFooter({ text: 'Obrigado pelo apoio! ❤️' })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('donate_button')
        .setLabel('💰 Fazer Doação')
        .setStyle(ButtonStyle.Primary),
    );

    return { embeds: [embed], components: [row] };
  }

  getDonationUrl(discordId: string): string {
    return `${this.donationUrl}?discord_id=${discordId}`;
  }
}
