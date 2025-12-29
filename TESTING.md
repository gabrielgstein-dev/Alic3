# Testando o Sistema de Doações

## Como funciona o LivePix

**O LivePix NÃO possui ambiente de sandbox/teste separado.** Todas as credenciais criadas processam pagamentos reais quando aprovados.

### URLs da API

- OAuth: `https://oauth.livepix.gg/oauth2/token`
- API: `https://api.livepix.gg/v2`

## Obtendo Credenciais

### 1. Acesse o Dashboard

🔗 **Link direto:** https://dashboard.livepix.gg/settings/api

Ou navegue:
- Acesse: https://livepix.gg
- Faça login
- Vá em **Configurações**

### 2. Crie uma Aplicação

1. No painel de API, clique em **"Nova Aplicação"**
2. Preencha:
   - **Nome:** Ex: "Bot Discord" 
   - **Descrição:** Opcional
3. Após criar, você receberá:
   - `client_id` 
   - `client_secret`

### 3. Configure no .env

```env
LIVEPIX_CLIENT_ID=seu_client_id_aqui
LIVEPIX_CLIENT_SECRET=seu_client_secret_aqui
LIVEPIX_SCOPE=account:read wallet:read wallet:write
```

⚠️ **Importante:** Certifique-se de que a aplicação tem o escopo `wallet:write` para criar pagamentos.

### Como Testar

1. **Certifique-se que está em modo sandbox:**
   ```bash
   # No .env
   LIVEPIX_ENV=sandbox
   ```

2. **Reinicie o servidor:**
   ```bash
   pnpm run start:dev
   ```

3. **Verifique nos logs:**
   ```
   [NestFactory] Starting Nest application...
   [DonateService] Modo LivePix: sandbox (use credenciais de teste)
   ```

4. **Acesse o formulário de doação:**
   ```
   http://localhost:3000/donate
   ```

5. **Teste o fluxo completo:**
   - Verificação de Discord ID
   - Criação de pagamento
   - No sandbox, pagamentos podem ser aprovados manualmente no painel

### Pagamentos de Teste

Com credenciais de aplicação de teste:
- ✅ Pagamentos **não processam transações reais**
- ✅ Você pode **simular aprovações/rejeições** no painel LivePix
- ✅ Webhooks funcionam normalmente
- ✅ Todo o fluxo pode ser testado sem risco
- ⚠️ Certifique-se de usar uma aplicação marcada como **teste** no painel

### Migração para Produção

Quando estiver pronto para produção:

1. **Configure credenciais de produção:**
   ```env
   LIVEPIX_ENV=production
   LIVEPIX_CLIENT_ID=seu_client_id_producao
   LIVEPIX_CLIENT_SECRET=seu_client_secret_producao
   ```

2. **Configure webhook de produção** no painel LivePix:
   ```
   https://seu-dominio.com/webhook
   ```

3. **Teste com valor pequeno real** antes de divulgar

### Troubleshooting

**Erro 401 ao criar pagamento:**
- Verifique se as credenciais estão corretas
- Confirme que o escopo inclui `wallet:write`
- Verifique se a aplicação tem as permissões necessárias no painel LivePix

**Webhook não recebe notificações:**
- Em sandbox, webhooks podem ter delay maior
- Use ngrok para testar localmente
- Verifique a URL do webhook no painel LivePix

**Modo não muda nos logs:**
- Reinicie o servidor após alterar `LIVEPIX_ENV`
- Verifique os logs para confirmar o modo ativo
- Lembre-se: o que define teste vs produção são as **credenciais**, não a URL
