# 🚀 Deploy no Railway (Gratuito)

## 📋 Pré-requisitos

- Conta no GitHub
- Código commitado no repositório
- Conta no Railway (https://railway.app)
- Node.js 24+ (localmente para desenvolvimento)
- pnpm (gerenciador de pacotes)

## 🎯 Passo a Passo

### 1. Criar Conta no Railway

1. Acesse https://railway.app
2. Clique em **"Start a New Project"**
3. Faça login com GitHub
4. Você recebe **$5 USD/mês grátis** (suficiente para este bot)

### 2. Conectar Repositório

1. No Railway, clique em **"New Project"**
2. Selecione **"Deploy from GitHub repo"**
3. Autorize o Railway a acessar seus repositórios
4. Selecione o repositório `Alic3`

### 3. Configurar Variáveis de Ambiente

No Railway, vá em **Variables** e adicione:

```env
DISCORD_TOKEN=seu_token_aqui
DISCORD_GUILD_ID=id_do_servidor
TICKET_CHANNEL_ID=id_do_canal
STAFF_ROLE_ID=id_da_role_staff
ADMIN_ROLE_ID=id_da_role_admin
PATREON_ROLE_ID=id_da_role_patreon

LIVEPIX_CLIENT_ID=seu_client_id
LIVEPIX_CLIENT_SECRET=seu_client_secret
LIVEPIX_SCOPE=account:read wallet:read

DONATION_LOG_CHANNEL_ID=id_do_canal_logs

NODE_ENV=production
```

**IMPORTANTE:** Após adicionar as variáveis, clique em **Deploy** (o Railway não deixa vazio o BASE_URL, ele gera automaticamente)

### 4. Obter URL da Aplicação

1. Após o deploy, vá em **Settings**
2. Role até **Networking**
3. Clique em **Generate Domain**
4. Copie a URL gerada (ex: `alic3-production.up.railway.app`)

### 5. Adicionar BASE_URL

1. Volte em **Variables**
2. Adicione:
   ```
   BASE_URL=https://alic3-production.up.railway.app
   ```
3. O Railway vai fazer redeploy automaticamente

### 6. Configurar Webhook no Livepix

1. Acesse as configurações da sua conta no Livepix
2. Vá em **Aplicações** → **Sua Aplicação**
3. Configure o webhook:
   ```
   https://alic3-production.up.railway.app/livepix/webhook
   ```

Ou use a API:
```bash
curl -X POST https://api.livepix.gg/v2/webhooks \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://alic3-production.up.railway.app/livepix/webhook"}'
```

### 7. Testar Integração

1. Acesse: `https://alic3-production.up.railway.app/livepix/donate`
2. Preencha o formulário com:
   - Seu ID do Discord
   - Valor de teste (R$ 1,00)
3. Complete o pagamento
4. Verifique se a role foi adicionada automaticamente

### 8. Compartilhar Link

No Discord, use o comando:
```
!donate
```

Ou compartilhe diretamente:
```
https://alic3-production.up.railway.app/livepix/donate
```

## 🔧 Comandos Úteis Railway

### Ver Logs
No painel do Railway, clique em **View Logs** para ver logs em tempo real

### Redeploy Manual
Se precisar fazer redeploy:
1. Vá em **Deployments**
2. Clique nos 3 pontinhos da última deployment
3. **Restart**

### Monitorar Uso
Railway mostra o uso de recursos em **Metrics**:
- CPU
- Memória
- Banda (Network)

## 💰 Custos

**Plano Gratuito:**
- $5 USD/mês de crédito
- ~500 horas de execução
- Suficiente para bot pequeno/médio

**Se exceder:**
- Você será notificado
- Pode adicionar cartão (pay-as-you-go)
- Ou otimizar recursos

## ⚠️ Troubleshooting

### Deploy Falhou
- Verifique os logs no Railway
- Certifique-se que todas as variáveis de ambiente estão corretas
- Verifique se o código foi commitado corretamente

### Webhook não recebe chamadas
- Verifique se a URL está correta no Livepix
- Teste manualmente: `curl https://seu-app.railway.app/livepix/webhook`
- Veja os logs no Railway

### Bot offline
- Verifique se o DISCORD_TOKEN está correto
- Verifique os logs de erro no Railway
- Certifique-se que o bot tem as permissões corretas

## 🎉 Pronto!

Agora você tem:
- ✅ Bot rodando 24/7 no Railway
- ✅ Formulário de doação acessível
- ✅ Webhook recebendo pagamentos
- ✅ Role Patreon sendo adicionada automaticamente
- ✅ Tudo gratuitamente!

## 📱 Alternativas Gratuitas

Se o Railway não funcionar, outras opções:

### Render.com
- $0/mês (com limitações)
- 750 horas grátis
- Deploy similar ao Railway

### Fly.io
- $0/mês para apps pequenos
- 3 VMs gratuitas
- Mais configuração necessária

### Heroku
- **Não recomendado** (plano grátis foi descontinuado)
