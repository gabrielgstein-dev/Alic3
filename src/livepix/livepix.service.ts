import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Client } from 'discord.js';
import { firstValueFrom } from 'rxjs';
import { LivepixWebhookDto, PaymentDetailsDto } from './dto/livepix-webhook.dto';

@Injectable()
export class LivepixService {
  private readonly logger = new Logger(LivepixService.name);
  private accessToken: string;
  private tokenExpiresAt: number;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
    @Inject(Client) private client: Client,
  ) {}

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    
    if (this.accessToken && this.tokenExpiresAt > now) {
      return this.accessToken;
    }

    const clientId = this.configService.get<string>('LIVEPIX_CLIENT_ID');
    const clientSecret = this.configService.get<string>('LIVEPIX_CLIENT_SECRET');
    const scope = this.configService.get<string>('LIVEPIX_SCOPE') || 'account:read wallet:read';

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          'https://oauth.livepix.gg/oauth2/token',
          new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
            scope: scope,
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = now + (response.data.expires_in * 1000) - 60000;
      
      this.logger.log('Livepix access token obtido com sucesso');
      return this.accessToken;
    } catch (error) {
      this.logger.error('Erro ao obter access token do Livepix', error);
      throw error;
    }
  }

  async getPaymentDetails(paymentId: string): Promise<PaymentDetailsDto> {
    const token = await this.getAccessToken();

    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `https://api.livepix.gg/v2/payments/${paymentId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        ),
      );

      return response.data.data;
    } catch (error) {
      this.logger.error(`Erro ao buscar detalhes do pagamento ${paymentId}`, error);
      throw error;
    }
  }

  async createPayment(discordId: string, amount: number): Promise<any> {
    const token = await this.getAccessToken();

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          'https://api.livepix.gg/v2/payments',
          {
            value: amount * 100,
            reference: discordId,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      this.logger.log(`Pagamento criado para usuário Discord ${discordId}`);
      return response.data.data;
    } catch (error) {
      this.logger.error('Erro ao criar pagamento no Livepix', error);
      throw error;
    }
  }

  async handlePaymentReceived(webhook: LivepixWebhookDto): Promise<void> {
    try {
      this.logger.log(`Webhook recebido: ${JSON.stringify(webhook)}`);

      if (webhook.resource.type !== 'payment') {
        this.logger.warn(`Tipo de recurso não suportado: ${webhook.resource.type}`);
        return;
      }

      const paymentDetails = await this.getPaymentDetails(webhook.resource.id);
      
      this.logger.log(`Detalhes do pagamento: ${JSON.stringify(paymentDetails)}`);

      if (paymentDetails.status === 'approved' || paymentDetails.status === 'paid') {
        await this.addPatreonRole(paymentDetails);
      }
    } catch (error) {
      this.logger.error('Erro ao processar webhook de pagamento', error);
      throw error;
    }
  }

  private async findDiscordUserId(payment: PaymentDetailsDto): Promise<string | null> {
    if (payment.reference) {
      return payment.reference;
    }

    const guild = await this.client.guilds.fetch(
      this.configService.get<string>('DISCORD_GUILD_ID')
    );
    
    if (payment.payer.username) {
      const members = await guild.members.fetch();
      const member = members.find(
        m => m.user.username.toLowerCase() === payment.payer.username.toLowerCase()
      );
      if (member) {
        this.logger.log(`Usuário encontrado por username: ${payment.payer.username}`);
        return member.id;
      }
    }

    if (payment.payer.email) {
      this.logger.warn(`Pagamento com email mas sem match no Discord: ${payment.payer.email}`);
    }

    return null;
  }

  private async addPatreonRole(payment: PaymentDetailsDto): Promise<void> {
    const guildId = this.configService.get<string>('DISCORD_GUILD_ID');
    const patreonRoleId = this.configService.get<string>('PATREON_ROLE_ID');
    
    const discordUserId = await this.findDiscordUserId(payment);

    if (!discordUserId) {
      this.logger.warn('Não foi possível identificar o usuário do Discord para este pagamento');
      
      const logChannelId = this.configService.get<string>('DONATION_LOG_CHANNEL_ID');
      if (logChannelId) {
        const logChannel = await this.client.channels.fetch(logChannelId);
        if (logChannel && 'send' in logChannel) {
          await logChannel.send({
            content: `⚠️ **Doação recebida mas sem usuário identificado!**\n**Valor:** R$ ${(payment.value / 100).toFixed(2)}\n**Pagador:** ${payment.payer.name || payment.payer.username || payment.payer.email || 'Desconhecido'}\n**ID Pagamento:** ${payment.id}\n\n*Por favor, adicione a role Patreon manualmente.*`,
          });
        }
      }
      return;
    }

    try {
      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(discordUserId);
      const role = guild.roles.cache.get(patreonRoleId);

      if (!role) {
        this.logger.error(`Role Patreon não encontrada: ${patreonRoleId}`);
        return;
      }

      if (member.roles.cache.has(patreonRoleId)) {
        this.logger.log(`Usuário ${discordUserId} já possui a role Patreon`);
        return;
      }

      await member.roles.add(role);
      this.logger.log(`Role Patreon adicionada ao usuário ${discordUserId}`);

      const logChannelId = this.configService.get<string>('DONATION_LOG_CHANNEL_ID');
      if (logChannelId) {
        const logChannel = await this.client.channels.fetch(logChannelId);
        if (logChannel && 'send' in logChannel) {
          await logChannel.send({
            content: `💰 **Nova doação recebida!**\n**Usuário:** <@${discordUserId}>\n**Valor:** R$ ${(payment.value / 100).toFixed(2)}\n**Status:** ✅ Role Patreon adicionada com sucesso!`,
          });
        }
      }
    } catch (error) {
      this.logger.error(`Erro ao adicionar role Patreon ao usuário ${discordUserId}`, error);
      throw error;
    }
  }
}
