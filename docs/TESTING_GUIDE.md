# 🧪 Guia de Testes - Sistema de Detecção de Mods

## 🚀 Fluxo Rápido de Teste (10 passos)

### **1. Criar Autor**
```
!mod author add "Seu Nome" https://patreon.com/seu-usuario
```
📋 Copie o **author_id** da resposta

### **2. Criar Mod**
```
!mod add <author_id> "Test Violence Mod" https://www.curseforge.com/sims4/mods/test
```
📋 Copie o **mod_id** da resposta

### **3. Adicionar Aliases (opcional)**
```
!mod alias add <mod_id> "TV Mod"
!mod alias add <mod_id> "Violence Test"
```

### **4. Pegar Campaign ID do Patreon**
- Acesse: `https://www.patreon.com/api/oauth2/v2/campaigns`
- Faça login se necessário
- Copie o `id` do JSON (será seu **campaign_id**)

### **5. Criar Campanha via API**
```bash
curl -X POST http://localhost:3000/patreon/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "SEU_CAMPAIGN_ID",
    "creatorName": "Seu Nome",
    "notificationChannelId": "1455897804303110338",
    "checkIntervalMins": 30
  }'
```

### **6. Vincular Autor à Campanha**
```
!mod author link <author_id> <campaign_id>
```

### **7. Criar Post no Patreon**
Crie um post público mencionando o mod:
```
🎮 Test Violence Mod v1.0.0 Update!

Nova versão do Test Violence Mod disponível!
- Fixed bugs
- New features
```

**Palavras-chave para detecção:** `mod`, `update`, `version`, `download`, `fixed`

### **8. Forçar Check (mais rápido que aguardar 10min)**
```bash
curl -X POST http://localhost:3000/patreon/campaigns/<campaign_id>/check
```

### **9. Verificar Discord**
Vá no canal `1455897804303110338` e veja a notificação:
```
📦 Post detectado com mods
🎮 Mods detectados:
1. Test Violence Mod (v1.0.0) - ✅ Identificado (95%)
[✅ Confirmar] [🔗 Vincular] [➕ Criar Novo] [❌ Ignorar]
```

### **10. Interagir**
- Clique em `[✅ Confirmar]`
- Use: `!mod update test_violence_mod 1.0.0`
- Verifique: `!mod list`

---

## ⚙️ Configuração Inicial

### 1. Variáveis de Ambiente
Adicione ao seu `.env`:
```env
GROQ_API_KEY=sua_chave_groq_aqui
ANTHROPIC_API_KEY=sua_chave_anthropic_aqui
MOD_REVIEW_CHANNEL_ID=1455897804303110338
```

**Importante:** 
- `notificationChannelId` (por campanha) = notificações de posts normais
- `MOD_REVIEW_CHANNEL_ID` (global) = notificações de mods detectados para revisão

### 2. Iniciar Aplicação
```bash
pnpm run start:dev
```

---

## 📋 Fluxo de Teste Completo

### **Teste 1: Criar Autor e Mod**

```bash
# 1. Criar um autor de mod
!mod author add "Sacrificial Mods" https://patreon.com/sacrificialmods

# 2. Copiar o ID do autor da resposta (ex: a1b2c3d4)

# 3. Criar um mod para esse autor
!mod add a1b2c3d4 "Extreme Violence" https://www.curseforge.com/sims4/mods/extreme-violence

# 4. Verificar se foi criado
!mod list

# 5. Ver detalhes do mod
!mod info extreme_violence
```

**Resultado Esperado:**
- ✅ Autor criado com ID único
- ✅ Mod criado vinculado ao autor
- ✅ Lista mostra o mod
- ✅ Info mostra todos os detalhes

---

### **Teste 2: Adicionar Alias ao Mod**

```bash
# Adicionar nomes alternativos para melhorar detecção
!mod alias add <mod_id> "EV Mod"
!mod alias add <mod_id> "Violence Mod"

# Verificar aliases
!mod info <mod_id>
```

**Resultado Esperado:**
- ✅ Aliases aparecendo na seção 🏷️ Aliases

---

### **Teste 3: Vincular Autor à Campanha do Patreon**

```bash
# 1. Criar uma campanha do Patreon (se ainda não tiver)
# POST http://localhost:3000/patreon/campaigns
{
  "campaignId": "123456",
  "creatorName": "Sacrificial Mods",
  "notificationChannelId": "1455897804303110338",
  "checkIntervalMins": 30
}

# 2. Vincular autor à campanha
!mod author link <author_id> 123456
```

**Resultado Esperado:**
- ✅ Autor vinculado à campanha
- ✅ Posts da campanha agora serão analisados automaticamente

---

### **Teste 4: Testar Detecção Automática**

**Opção A: Forçar check manual**
```bash
# POST http://localhost:3000/patreon/campaigns/123456/check
```

**Opção B: Aguardar cron (10 minutos)**

**O que acontece:**
1. Scheduler detecta novos posts
2. `ModDetectionService` analisa com Groq
3. Tenta fazer matching com mods conhecidos
4. Se encontrar mods → envia notificação no canal `MOD_REVIEW_CHANNEL_ID`

**Resultado Esperado no Discord:**
```
📦 Post detectado com mods

🔗 Post: [Extreme Violence v1.5.0](https://patreon.com/...)
📅 Publicado: há 5 minutos

🎮 Mods detectados:
1. Extreme Violence (v1.5.0) - ✅ Identificado (95%)
   └ Status: ⚠️ Precisa atualizar (sua versão: N/A)

[✅ Confirmar] [🔗 Vincular] [➕ Criar Novo] [❌ Ignorar]
```

---

### **Teste 5: Interagir com Notificações**

#### **5.1 - Confirmar Mod Identificado**
1. Clique em `[✅ Confirmar]`
2. Sistema marca como verificado
3. Atualiza versão do mod no banco

**Resultado Esperado:**
- Mensagem ephemeral: "✅ Mod **Extreme Violence** confirmado!"
- Mod marcado como `verified: true`

#### **5.2 - Vincular Manualmente**
1. Clique em `[🔗 Vincular]`
2. Modal aparece pedindo ID/nome do mod
3. Digite o ID ou nome
4. Confirme

**Resultado Esperado:**
- Mensagem ephemeral: "🔗 Vinculado a **[Nome do Mod]**!"
- Histórico registrado em `ModLinkHistory`

#### **5.3 - Criar Novo Mod**
1. Clique em `[➕ Criar Novo]`
2. Modal com campos:
   - Nome do Mod
   - URL CurseForge (opcional)
3. Preencha e confirme

**Resultado Esperado:**
- Mensagem ephemeral: "➕ Mod **[Nome]** criado com sucesso!"
- Novo mod aparece em `!mod list`

#### **5.4 - Ignorar**
1. Clique em `[❌ Ignorar]`

**Resultado Esperado:**
- Mensagem ephemeral: "❌ Mod ignorado."
- Post marcado como `needsReview: false`

---

### **Teste 6: Atualizar Versão Traduzida**

```bash
# Quando você traduzir e fazer upload no CurseForge
!mod update extreme_violence 1.5.0
```

**Resultado Esperado:**
- ✅ Versão atualizada no banco
- ✅ `isUpToDate` marcado como `true`
- ✅ `translationDate` atualizado

---

### **Teste 7: Ver Posts Pendentes**

```bash
!mod review
```

**Resultado Esperado:**
- Embed com lista de posts não confirmados
- Links para os posts
- Lista de mods detectados com confidence score

---

## 🔍 Verificações no Banco de Dados

### Verificar Mods Criados
```sql
SELECT * FROM mods;
```

### Verificar Detecções
```sql
SELECT * FROM patreon_post_mods ORDER BY created_at DESC LIMIT 10;
```

### Verificar Histórico de Ações
```sql
SELECT * FROM mod_link_history ORDER BY created_at DESC LIMIT 10;
```

---

## 🐛 Troubleshooting

### Erro: "Review channel not found"
- Verifique se `MOD_REVIEW_CHANNEL_ID` está correto no `.env`
- Verifique se o bot tem permissão de enviar mensagens no canal

### Erro: "Groq API error"
- Verifique se `GROQ_API_KEY` está correta
- Verifique se há rate limit ativo

### Notificação não aparece
- Verifique logs do servidor: `[ModNotificationService]`
- Verifique se há mods com `needsReview: true`
- Verifique se o post foi analisado: `analyzed: true`

### Comando não responde
- Verifique se você tem role STAFF ou ADMIN
- Verifique logs: `[BotService]`

---

## ✅ Checklist de Testes

- [ ] Criar autor
- [ ] Criar mod
- [ ] Adicionar alias
- [ ] Vincular autor à campanha
- [ ] Detectar post automaticamente
- [ ] Receber notificação no Discord
- [ ] Confirmar mod via botão
- [ ] Vincular mod via modal
- [ ] Criar novo mod via modal
- [ ] Ignorar detecção
- [ ] Atualizar versão traduzida
- [ ] Ver posts pendentes (!mod review)
- [ ] Listar mods (!mod list)
- [ ] Ver info de mod (!mod info)

---

## 📊 Métricas de Sucesso

✅ **Sistema está funcionando se:**
1. Posts do Patreon são detectados automaticamente
2. IA extrai corretamente nome e versão dos mods
3. Matching funciona com threshold de 80%
4. Notificações aparecem no canal correto
5. Botões e modals funcionam
6. Comandos retornam informações corretas
7. Histórico é registrado em `ModLinkHistory`

---

## 🚀 Próximos Passos Sugeridos

1. **Teste com campanha real** de criador de mods
2. **Monitore logs** por 24h para ver detecções
3. **Ajuste threshold** de fuzzy matching se necessário
4. **Adicione mais aliases** conforme aparecem variações
5. **Configure script de tradução** Python para usar versões do banco
