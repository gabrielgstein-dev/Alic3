import { Controller, Post, Body, Logger, HttpCode, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { LivepixService } from './livepix.service';
import { LivepixWebhookDto } from './dto/livepix-webhook.dto';
import { CreateDonationDto } from './dto/create-donation.dto';

@Controller('livepix')
export class LivepixController {
  private readonly logger = new Logger(LivepixController.name);

  constructor(private readonly livepixService: LivepixService) {}

  @Get('donate')
  showDonationForm(@Res() res: Response) {
    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Fazer Doação - Patreon</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          }
          h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 28px;
          }
          .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
          }
          .form-group {
            margin-bottom: 20px;
          }
          label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 600;
            font-size: 14px;
          }
          input {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 16px;
            transition: border-color 0.3s;
          }
          input:focus {
            outline: none;
            border-color: #667eea;
          }
          .hint {
            font-size: 12px;
            color: #999;
            margin-top: 5px;
          }
          button {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
          }
          button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
          }
          button:active {
            transform: translateY(0);
          }
          button:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
          }
          .error {
            background: #fee;
            border: 2px solid #fcc;
            color: #c33;
            padding: 12px;
            border-radius: 10px;
            margin-bottom: 20px;
            display: none;
          }
          .loading {
            display: none;
            text-align: center;
            padding: 20px;
          }
          .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>💜 Apoie o Servidor</h1>
          <p class="subtitle">Faça uma doação e receba a role Patreon automaticamente!</p>
          
          <div id="error" class="error"></div>
          <div id="loading" class="loading">
            <div class="spinner"></div>
            <p style="margin-top: 15px; color: #666;">Processando...</p>
          </div>
          
          <form id="donationForm">
            <div class="form-group">
              <label for="discordId">Seu ID do Discord *</label>
              <input 
                type="text" 
                id="discordId" 
                name="discordId" 
                placeholder="123456789012345678"
                pattern="[0-9]{17,19}"
                required
              >
              <div class="hint">
                Para copiar seu ID: Configurações → Avançado → Modo Desenvolvedor → Clique com botão direito no seu perfil → Copiar ID do Usuário
              </div>
            </div>
            
            <div class="form-group">
              <label for="amount">Valor da Doação (R$) *</label>
              <input 
                type="number" 
                id="amount" 
                name="amount" 
                placeholder="10.00"
                min="1"
                step="0.01"
                required
              >
              <div class="hint">Valor mínimo: R$ 1,00</div>
            </div>
            
            <button type="submit">🚀 Continuar para Pagamento</button>
          </form>
        </div>

        <script>
          document.getElementById('donationForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const discordId = document.getElementById('discordId').value;
            const amount = parseFloat(document.getElementById('amount').value);
            const errorDiv = document.getElementById('error');
            const loadingDiv = document.getElementById('loading');
            const form = document.getElementById('donationForm');
            
            errorDiv.style.display = 'none';
            loadingDiv.style.display = 'block';
            form.style.display = 'none';
            
            try {
              const response = await fetch('/livepix/create-donation', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ discordId, amount }),
              });
              
              if (!response.ok) {
                throw new Error('Erro ao criar doação');
              }
              
              const data = await response.json();
              
              if (data.paymentUrl) {
                window.location.href = data.paymentUrl;
              } else {
                throw new Error('URL de pagamento não recebida');
              }
            } catch (error) {
              errorDiv.textContent = 'Erro ao processar doação. Tente novamente.';
              errorDiv.style.display = 'block';
              loadingDiv.style.display = 'none';
              form.style.display = 'block';
            }
          });
        </script>
      </body>
      </html>
    `);
  }

  @Post('create-donation')
  async createDonation(@Body() createDonationDto: CreateDonationDto) {
    this.logger.log(`Criando doação para Discord ID: ${createDonationDto.discordId}`);
    
    try {
      const payment = await this.livepixService.createPayment(
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
      await this.livepixService.handlePaymentReceived(webhookData);
      return { success: true };
    } catch (error) {
      this.logger.error('Erro ao processar webhook', error);
      throw error;
    }
  }
}
