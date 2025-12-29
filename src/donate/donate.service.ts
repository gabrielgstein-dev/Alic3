import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Client } from 'discord.js';
import { firstValueFrom } from 'rxjs';
import { LivepixWebhookDto, PaymentDetailsDto } from './dto/livepix-webhook.dto';

@Injectable()
export class DonateService {
  private readonly logger = new Logger(DonateService.name);
  private accessToken: string;
  private tokenExpiresAt: number;
  private readonly apiBaseUrl = 'https://api.livepix.gg/v2';
  private readonly oauthBaseUrl = 'https://oauth.livepix.gg';

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
    @Inject(Client) private client: Client,
  ) {}

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    
    if (this.accessToken && this.tokenExpiresAt > now) {
      this.logger.debug('Usando token em cache');
      return this.accessToken;
    }

    const clientId = this.configService.get<string>('LIVEPIX_CLIENT_ID');
    const clientSecret = this.configService.get<string>('LIVEPIX_CLIENT_SECRET');
    const scope = this.configService.get<string>('LIVEPIX_SCOPE') || 'account:read wallet:read';

    this.logger.log(`Obtendo novo token OAuth - Client ID: ${clientId?.substring(0, 8)}...`);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.oauthBaseUrl}/oauth2/token`,
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
      this.logger.debug(`Token scope retornado: ${response.data.scope}`);
      this.logger.debug(`Token expira em: ${response.data.expires_in}s`);
      return this.accessToken;
    } catch (error) {
      this.logger.error('Erro ao obter access token do Livepix', error.response?.data || error.message);
      throw error;
    }
  }

  async getPaymentDetails(paymentId: string): Promise<PaymentDetailsDto> {
    const token = await this.getAccessToken();

    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.apiBaseUrl}/payments/${paymentId}`,
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

  async getDiscordUserById(userId: string): Promise<any> {
    try {
      const guildId = this.configService.get<string>('DISCORD_GUILD_ID');
      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId);
      
      if (!member) {
        return null;
      }
      
      return {
        id: member.user.id,
        username: member.user.username,
        discriminator: member.user.discriminator,
        avatar: member.user.avatar,
        displayName: member.displayName,
      };
    } catch (error) {
      this.logger.error(`Erro ao buscar usuário Discord ${userId}`, error);
      return null;
    }
  }

  async createPayment(discordId: string, amount: number): Promise<any> {
    const token = await this.getAccessToken();
    const valueInCents = Math.round(amount * 100);
    const baseUrl = this.configService.get<string>('BASE_URL') || 'http://localhost:3000';

    this.logger.log(`Criando pagamento: Valor=R$${amount} (${valueInCents} centavos), Discord=${discordId}`);
    this.logger.debug(`Token sendo usado: ${token?.substring(0, 20)}...`);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiBaseUrl}/payments`,
          {
            amount: valueInCents,
            currency: 'BRL',
            redirectUrl: `${baseUrl}/donate?payment=success&discord=${discordId}`,
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

      this.logger.log(`Pagamento criado com sucesso - Reference: ${response.data.data?.reference}`);
      
      return {
        id: response.data.data?.reference,
        paymentUrl: response.data.data?.redirectUrl,
        discordId: discordId,
      };
    } catch (error) {
      if (error.response) {
        this.logger.error(
          `Erro ao criar pagamento - Status: ${error.response.status}, Dados: ${JSON.stringify(error.response.data)}`
        );
      } else {
        this.logger.error('Erro ao criar pagamento no Livepix', error.message);
      }
      throw error;
    }
  }

  async handlePaymentReceived(webhook: any): Promise<void> {
    try {
      this.logger.log(`Webhook recebido (RAW): ${JSON.stringify(webhook, null, 2)}`);

      if (!webhook) {
        this.logger.warn('Webhook vazio recebido');
        return;
      }

      if (!webhook.resource) {
        this.logger.log('Webhook de confirmação ignorado (sem campo resource)');
        return;
      }

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
    const supporterRoleId = this.configService.get<string>('SUPPORTER_ROLE_ID');
    const goldenSupporterRoleId = this.configService.get<string>('GOLDEN_SUPPORTER_ROLE_ID');
    const diamondSupporterRoleId = this.configService.get<string>('DIAMOND_SUPPORTER_ROLE_ID');
    
    const discordUserId = await this.findDiscordUserId(payment);

    if (!discordUserId) {
      this.logger.warn('Não foi possível identificar o usuário do Discord para este pagamento');
      
      const logChannelId = this.configService.get<string>('DONATION_LOG_CHANNEL_ID');
      if (logChannelId) {
        const logChannel = await this.client.channels.fetch(logChannelId);
        if (logChannel && 'send' in logChannel) {
          await logChannel.send({
            content: `⚠️ **Doação recebida mas sem usuário identificado!**\n**Valor:** R$ ${(payment.value / 100).toFixed(2)}\n**Pagador:** ${payment.payer.name || payment.payer.username || payment.payer.email || 'Desconhecido'}\n**ID Pagamento:** ${payment.id}\n\n*Por favor, adicione a role de Apoiador manualmente.*`,
          });
        }
      }
      return;
    }

    try {
      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(discordUserId);
      
      const valueInReais = payment.value / 100;
      
      if (valueInReais < 5) {
        this.logger.warn(`Valor da doação abaixo do mínimo: R$ ${valueInReais.toFixed(2)}`);
        
        const logChannelId = this.configService.get<string>('DONATION_LOG_CHANNEL_ID');
        if (logChannelId) {
          const logChannel = await this.client.channels.fetch(logChannelId);
          if (logChannel && 'send' in logChannel) {
            await logChannel.send({
              content: `⚠️ **Doação recebida abaixo do valor mínimo!**\n**Usuário:** <@${discordUserId}>\n**Valor:** R$ ${valueInReais.toFixed(2)}\n**Mínimo:** R$ 5,00\n\n*Role não adicionada.*`,
            });
          }
        }
        return;
      }
      
      let roleId: string;
      let roleName: string;
      
      if (valueInReais >= 50) {
        roleId = diamondSupporterRoleId;
        roleName = '💎 Apoiador Diamante';
      } else if (valueInReais >= 20) {
        roleId = goldenSupporterRoleId;
        roleName = '🥇 Apoiador Dourado';
      } else {
        roleId = supporterRoleId;
        roleName = '⭐ Apoiador';
      }

      const role = guild.roles.cache.get(roleId);

      if (!role) {
        this.logger.error(`Role ${roleName} não encontrada: ${roleId}`);
        return;
      }

      if (member.roles.cache.has(roleId)) {
        this.logger.log(`Usuário ${discordUserId} já possui a role ${roleName}`);
        return;
      }

      await member.roles.add(role);
      this.logger.log(`Role ${roleName} adicionada ao usuário ${discordUserId}`);

      const logChannelId = this.configService.get<string>('DONATION_LOG_CHANNEL_ID');
      if (logChannelId) {
        const logChannel = await this.client.channels.fetch(logChannelId);
        if (logChannel && 'send' in logChannel) {
          await logChannel.send({
            content: `💰 **Nova doação recebida!**\n**Usuário:** <@${discordUserId}>\n**Valor:** R$ ${valueInReais.toFixed(2)}\n**Role:** ${roleName}\n**Status:** ✅ Role adicionada com sucesso!`,
          });
        }
      }
    } catch (error) {
      this.logger.error(`Erro ao adicionar role de Apoiador ao usuário ${discordUserId}`, error);
      throw error;
    }
  }
}
