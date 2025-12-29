import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { Client, TextChannel } from 'discord.js';
import { ConfigService } from '@nestjs/config';
import { TicketsService } from '../tickets/tickets.service';
import { hasStaff } from 'src/utils/permissions';
import { clearChannel } from 'src/utils/clearChannel';

@Injectable()
export class BotService implements OnModuleInit {
  private ticketChannelId: string;
  private staffRoleId: string;
  private adminRoleId: string;

  constructor(
    @Inject(Client) private client: Client,
    private configService: ConfigService,
    private ticketsService: TicketsService,
  ) {
    this.ticketChannelId = this.configService.get<string>('TICKET_CHANNEL_ID');
    this.staffRoleId = this.configService.get<string>('STAFF_ROLE_ID');
    this.adminRoleId = this.configService.get<string>('ADMIN_ROLE_ID');
  }

  async onModuleInit() {
    const token = this.configService.get<string>('DISCORD_TOKEN');
    if (!token) {
      throw new Error(
        'DISCORD_TOKEN is not defined in the environment variables',
      );
    }
    await this.client.login(token);

    this.client.on('ready', async () => {
      console.log(`Logged in as ${this.client.user.tag}!`);
      const channel = this.client.channels.cache.get(
        this.ticketChannelId,
      ) as TextChannel;
      if (channel) {
        await clearChannel(channel);
        await this.ticketsService.createTicketMessage();
      }
    });

    this.client.on('messageCreate', async (message) => {
      if (message.content === '!ping') {
        message.reply('Pong!');
      }
      
      if (message.content === '!donate' || message.content === '!doar') {
        const baseUrl = this.configService.get<string>('BASE_URL') || 'http://localhost:3000';
        const donationUrl = `${baseUrl}/livepix/donate`;
        
        const embed = {
          color: 0x667eea,
          title: '💜 Apoie o Servidor',
          description:
            'Faça uma doação e receba a role **Patreon** automaticamente!\n\n' +
            '**Como funciona:**\n' +
            '1️⃣ Clique no link abaixo\n' +
            '2️⃣ Preencha o formulário com seu ID do Discord\n' +
            '3️⃣ Escolha o valor da doação\n' +
            '4️⃣ Complete o pagamento\n' +
            '5️⃣ Receba a role Patreon automaticamente!\n\n' +
            `🔗 **Link:** ${donationUrl}\n\n` +
            '**Como copiar seu ID:**\n' +
            'Configurações → Avançado → Ativar Modo Desenvolvedor\n' +
            'Clique com botão direito no seu perfil → Copiar ID do Usuário',
          footer: { text: 'Obrigado pelo apoio! ❤️' },
          timestamp: new Date().toISOString(),
        };
        
        message.reply({ embeds: [embed] });
      }
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (
        interaction.isButton() ||
        interaction.isStringSelectMenu() ||
        interaction.isModalSubmit()
      ) {
        console.log('CUSTOM ID CHAMADO', interaction.customId);
      }

      if (
        interaction.isStringSelectMenu() &&
        interaction.customId === 'select_ticket'
      ) {
        await this.ticketsService.handleSelectMenuInteraction(interaction);
      } else if (
        interaction.isButton() &&
        interaction.customId === 'close_ticket'
      ) {
        await this.ticketsService.closeTicket(interaction);
      } else if (
        interaction.isButton() &&
        interaction.customId === 'add_member'
      ) {
        if (!hasStaff(interaction)) return;
        await this.ticketsService.handleAddMember(interaction);
      } else if (
        interaction.isButton() &&
        interaction.customId === 'remove_member'
      ) {
        if (!hasStaff(interaction)) return;
        await this.ticketsService.handleRemoveMember(interaction);
      } else if (
        interaction.isModalSubmit() &&
        interaction.customId === 'addMemberModal'
      ) {
        if (!hasStaff(interaction)) return;
        await this.ticketsService.handleModalSubmit(interaction);
      } else if (
        interaction.isModalSubmit() &&
        interaction.customId === 'removeMemberModal'
      ) {
        if (!hasStaff(interaction)) return;
        await this.ticketsService.handleModalSubmit(interaction);
      }
    });
  }
}
