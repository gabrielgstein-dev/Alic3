# Configuração Livepix + Discord

## Integração implementada

A integração permite que quando alguém faça uma doação via Livepix, automaticamente receba a role "Patreon" no Discord.

## Configuração

### 1. Variáveis de Ambiente

Adicione as seguintes variáveis no arquivo `.env`:

```env
DISCORD_TOKEN=seu_token_do_bot
DISCORD_GUILD_ID=id_do_seu_servidor_discord
PATREON_ROLE_ID=id_da_role_patreon

LIVEPIX_CLIENT_ID=seu_client_id_livepix
LIVEPIX_CLIENT_SECRET=seu_client_secret_livepix
LIVEPIX_SCOPE=account:read wallet:read

DONATION_LOG_CHANNEL_ID=id_do_canal_de_logs (opcional)
```

### 2. Configurar Aplicação no Livepix

1. Acesse as configurações da sua conta no Livepix
2. Crie uma nova aplicação para obter o `client_id` e `client_secret`
3. Configure as permissões necessárias: `account:read` e `wallet:read`

### 3. Configurar Webhook no Livepix

Após deployar sua aplicação, você precisa registrar o webhook no Livepix.

#### Usando a API do Livepix:

```bash
curl -X POST https://api.livepix.gg/v2/webhooks \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://seu-dominio.com/livepix/webhook"}'
```

**Importante:** A URL do webhook deve ser acessível publicamente (HTTPS recomendado).

### 4. Configurar Bot do Discord

O bot precisa ter as seguintes permissões no servidor:
- **Manage Roles** - Para adicionar a role Patreon
- **Read Messages/View Channels** - Para acessar o canal de logs
- **Send Messages** - Para enviar mensagens de log

E ativar os seguintes **Privileged Gateway Intents**:
- Server Members Intent
- Message Content Intent

### 5. Como Funciona

**Fluxo completo:**

1. **Usuário acessa** `https://seu-dominio.com/livepix/donate`
2. **Preenche o formulário** com:
   - Seu ID do Discord (copiado do próprio perfil)
   - Valor da doação em R$
3. **Clica em "Continuar para Pagamento"**
4. **É redirecionado** para a página de pagamento do Livepix
5. **Realiza o pagamento** (PIX, cartão, etc)
6. **Livepix envia webhook** para `POST /livepix/webhook`
7. **Sistema busca detalhes** do pagamento na API
8. **Role Patreon é adicionada** automaticamente ao usuário
9. **Log é enviado** no canal de doações (opcional)

### 6. Compartilhando o Link de Doação

Você pode compartilhar o link `https://seu-dominio.com/livepix/donate` em:
- Mensagens fixadas no Discord
- Descrição do servidor
- Canais específicos
- Comandos do bot

O formulário já explica ao usuário como copiar o ID do Discord dele.

## Testando a Integração

1. Inicie o servidor: `yarn start:dev`
2. Use uma ferramenta como ngrok para expor sua aplicação: `ngrok http 3000`
3. Configure o webhook no Livepix com a URL do ngrok: `https://xxx.ngrok.io/livepix/webhook`
4. Acesse `http://localhost:3000/livepix/donate` (ou use a URL do ngrok)
5. Preencha o formulário com:
   - Seu ID do Discord
   - Valor de teste (ex: R$ 1,00)
6. Complete o pagamento no Livepix
7. Verifique se a role foi adicionada automaticamente e os logs foram enviados

## Troubleshooting

- **Role não é adicionada:** Verifique se o bot tem permissão "Manage Roles" e se sua role está acima da role Patreon na hierarquia
- **Webhook não recebe chamadas:** Verifique se a URL está correta e acessível publicamente
- **Erro ao buscar detalhes do pagamento:** Verifique as credenciais do Livepix e se o token OAuth está válido
