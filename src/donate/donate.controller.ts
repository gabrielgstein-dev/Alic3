import { Controller, Post, Body, Logger, HttpCode, Get, Res, Param, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { DonateService } from './donate.service';
import { LivepixWebhookDto } from './dto/livepix-webhook.dto';
import { CreateDonationDto } from './dto/create-donation.dto';
import * as fs from 'fs';
import * as path from 'path';

@Controller()
export class DonateController {
  private readonly logger = new Logger(DonateController.name);

  constructor(
    private readonly donateService: DonateService,
  ) {}

  @Get('verify-discord/:id')
  async verifyDiscordUser(@Param('id') discordId: string) {
    this.logger.log(`Verificando Discord ID: ${discordId}`);
    
    try {
      const user = await this.donateService.getDiscordUserById(discordId);
      
      if (!user) {
        throw new NotFoundException('Usuário não encontrado no servidor');
      }
      
      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          discriminator: user.discriminator,
          avatar: user.avatar,
          displayName: user.displayName,
        },
      };
    } catch (error) {
      this.logger.error(`Erro ao verificar Discord ID ${discordId}`, error);
      throw new NotFoundException('Usuário não encontrado no servidor');
    }
  }

  @Get('donate')
  showDonationForm(@Res() res: Response) {
    let htmlPath = path.join(__dirname, 'views', 'donate.html');
    
    if (!fs.existsSync(htmlPath)) {
      htmlPath = path.join(process.cwd(), 'src', 'donate', 'views', 'donate.html');
    }
    
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    res.type('text/html').send(htmlContent);
  }

  @Post('create-donation')
  async createDonation(@Body() createDonationDto: CreateDonationDto) {
    this.logger.log(`Criando doação para Discord ID: ${createDonationDto.discordId}`);
    
    try {
      const payment = await this.donateService.createPayment(
        createDonationDto.discordId,
        createDonationDto.amount,
      );
      
      return {
        success: true,
        paymentUrl: payment.paymentUrl || payment.url,
        paymentId: payment.id,
      };
    } catch (error) {
      this.logger.error('Erro ao criar doação', error);
      throw error;
    }
  }

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Body() webhookData: LivepixWebhookDto) {
    this.logger.log('Webhook recebido do Livepix');
    
    try {
      await this.donateService.handlePaymentReceived(webhookData);
      return { success: true };
    } catch (error) {
      this.logger.error('Erro ao processar webhook', error);
      throw error;
    }
  }
}
