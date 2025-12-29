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
        'Faça uma doação e receba a role **Patreon** automaticamente!\n\n' +
        '**Como funciona:**\n' +
        '1️⃣ Clique no botão abaixo\n' +
        '2️⃣ Preencha o formulário com seu ID do Discord\n' +
        '3️⃣ Escolha o valor da doação\n' +
        '4️⃣ Complete o pagamento\n' +
        '5️⃣ Receba a role Patreon automaticamente!\n\n' +
        '**Como copiar seu ID:**\n' +
        'Configurações → Avançado → Ativar Modo Desenvolvedor\n' +
        'Clique com botão direito no seu perfil → Copiar ID do Usuário'
      )
      .setFooter({ text: 'Obrigado pelo apoio! ❤️' })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('💰 Fazer Doação')
        .setStyle(ButtonStyle.Link)
        .setURL(this.donationUrl),
    );

    return { embeds: [embed], components: [row] };
  }
}
