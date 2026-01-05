# 📚 Guia Completo de Comandos !mod

## 📖 Índice

- [O que é o Sistema de Mods?](#o-que-é-o-sistema-de-mods)
- [Conceitos Básicos](#conceitos-básicos)
- [Comandos de Autores](#comandos-de-autores)
- [Comandos de Mods](#comandos-de-mods)
- [Comandos de Aliases](#comandos-de-aliases)
- [Comandos de Revisão](#comandos-de-revisão)
- [Exemplos Práticos Completos](#exemplos-práticos-completos)
- [Perguntas Frequentes](#perguntas-frequentes)

---

## O que é o Sistema de Mods?

Este sistema monitora automaticamente posts do Patreon e detecta quando você anuncia atualizações de mods traduzidos. Ele usa inteligência artificial para identificar qual mod foi atualizado e qual a nova versão.

### Como funciona?

1. **Você posta no Patreon** anunciando uma atualização de mod
2. **O sistema detecta automaticamente** usando IA (Groq)
3. **Você recebe notificação no Discord** com botões para confirmar
4. **O banco de dados é atualizado** automaticamente

---

## Conceitos Básicos

### 🔑 Termos Importantes

**Autor (Author)**
- Pessoa que cria/traduz mods
- Pode ter vários mods vinculados
- Precisa ter uma campanha do Patreon associada

**Mod**
- Tradução específica de um mod do The Sims 4
- Tem um nome principal (ex: "Violência Extrema PT-BR")
- Tem uma URL no CurseForge
- Rastreia versões (original e traduzida)

**Alias**
- Nome alternativo para o mod
- Ajuda a IA a identificar o mod em posts
- Ex: "Extreme Violence" pode ter alias "EV Mod", "Violência"

**Versão Original (Latest Version)**
- Versão mais recente do mod em inglês

**Versão Traduzida (Translated Version)**
- Versão da sua tradução atual

**Campaign ID**
- Identificador único da sua campanha do Patreon
- Encontrado na URL da API do Patreon

---

## Comandos de Autores

### 1️⃣ Criar um Autor

**Comando:**
```
!mod author add <nome> [url_patreon]
```

**Quando usar:**
- Primeira vez configurando o sistema
- Adicionando outro tradutor/criador

**Parâmetros:**
- `<nome>` - Nome do autor (entre aspas se tiver espaços)
- `[url_patreon]` - (Opcional) URL do Patreon

**Exemplo:**
```
!mod author add "Gabriel Traduções" https://patreon.com/gabrieltraducoes
```

**Resultado:**
```
✅ Autor "Gabriel Traduções" criado!
ID: a1b2c3d4-5678-90ab-cdef
```

**⚠️ IMPORTANTE:** Guarde esse ID! Você vai precisar dele para criar mods.

---

### 2️⃣ Listar Todos os Autores

**Comando:**
```
!mod author list
```

**Quando usar:**
- Ver todos os autores cadastrados
- Descobrir o ID de um autor

**Exemplo de resposta:**
```
👥 Autores Cadastrados (2)

1. Gabriel Traduções
   ID: a1b2c3d4-5678-90ab-cdef
   Patreon: https://patreon.com/gabrieltraducoes
   Mods: 5

2. Maria Tradutora
   ID: b2c3d4e5-6789-01bc-defg
   Mods: 3
```

---

### 3️⃣ Vincular Autor à Campanha

**Comando:**
```
!mod author link <author_id> <campaign_id>
```

**Quando usar:**
- Depois de criar a campanha via API
- Para ativar o monitoramento automático

**Como pegar o Campaign ID:**

1. Acesse no navegador:
```
https://www.patreon.com/api/oauth2/v2/campaigns
```

2. Faça login se necessário

3. Copie o valor de `"id"` que aparecer

**Exemplo:**
```
!mod author link a1b2c3d4-5678-90ab-cdef 15336996
```

**Resultado:**
```
✅ Autor Gabriel Traduções vinculado à campanha Gabriel Traduções!
```

---

## Comandos de Mods

### 1️⃣ Adicionar Mod Manualmente

**Comando:**
```
!mod add <author_id> <nome> <curseforge_url>
```

**Quando usar:**
- Criar um mod do zero
- Se preferir digitar tudo manualmente

**Parâmetros:**
- `<author_id>` - ID do autor (obtido em !mod author list)
- `<nome>` - Nome do mod (pode ter espaços)
- `<curseforge_url>` - URL da sua tradução no CurseForge

**Exemplo:**
```
!mod add a1b2c3d4-5678-90ab-cdef Violência Extrema PT-BR https://www.curseforge.com/sims4/mods/extreme-violence-pt-br
```

**Resultado:**
```
✅ Mod "Violência Extrema PT-BR" criado!
ID: x9y8z7w6-5432-10ab-cdef
```

---

### 2️⃣ Importar Mod do CurseForge (RECOMENDADO)

**Comando:**
```
!mod import <author_id> <curseforge_url>
```

**Quando usar:**
- Importar traduções que já estão no CurseForge
- Forma mais rápida e automática

**Vantagens:**
- ✅ Extrai o nome automaticamente da URL
- ✅ Previne duplicatas
- ✅ Mais rápido

**Exemplo:**
```
!mod import a1b2c3d4-5678-90ab-cdef https://www.curseforge.com/sims4/mods/extreme-violence-pt-br
```

**Resultado:**
```
✅ Mod Importado com Sucesso!

📦 Nome: Extreme Violence Pt Br
🆔 ID: x9y8z7w6-5432-10ab-cdef
👤 Autor: Gabriel Traduções
🔗 CurseForge: https://www.curseforge.com/...

Use !mod update para definir a versão atual
```

**⚠️ ATENÇÃO:** Use sempre a URL da **SUA tradução**, não do mod original!

---

### 3️⃣ Atualizar Versão do Mod

**Comando:**
```
!mod update <mod_id_ou_nome> <versão>
```

**Quando usar:**
- Depois de importar/criar um mod
- Quando atualizar sua tradução
- Para manter versões sincronizadas

**Parâmetros:**
- `<mod_id_ou_nome>` - ID do mod OU nome parcial
- `<versão>` - Versão da sua tradução (ex: 2.5.0)

**Exemplo 1 - Usando ID:**
```
!mod update x9y8z7w6-5432-10ab-cdef 2.5.0
```

**Exemplo 2 - Usando nome:**
```
!mod update "violencia extrema" 2.5.0
```

**Resultado:**
```
✅ Mod Violência Extrema PT-BR atualizado!
Versão traduzida: 2.5.0
```

---

### 4️⃣ Listar Mods

**Comando:**
```
!mod list [autor_id_ou_nome]
```

**Quando usar:**
- Ver todos os mods cadastrados
- Ver mods de um autor específico
- Descobrir IDs de mods

**Exemplo 1 - Todos os mods:**
```
!mod list
```

**Exemplo 2 - Mods de um autor:**
```
!mod list gabriel
```

**Resultado:**
```
🎮 Mods Cadastrados (5)

1. Violência Extrema PT-BR
   ID: x9y8z7w6-5432-10ab-cdef
   Autor: Gabriel Traduções
   Versão Original: 2.6.0
   Versão Traduzida: 2.5.0
   Status: ⚠️ Desatualizado
   Aliases: 2

2. Sistema de Magia PT-BR
   ID: a1b2c3d4-5678-90ab-cdef
   Autor: Gabriel Traduções
   Versão Traduzida: 1.2.0
   Status: ✅ Atualizado
   Aliases: 1
```

---

### 5️⃣ Ver Detalhes de um Mod

**Comando:**
```
!mod info <mod_id_ou_nome>
```

**Quando usar:**
- Ver informações completas de um mod
- Verificar aliases cadastrados
- Ver histórico de versões

**Exemplo:**
```
!mod info violencia
```

**Resultado:**
```
📦 Violência Extrema PT-BR

🆔 ID: x9y8z7w6-5432-10ab-cdef
👤 Autor: Gabriel Traduções
🔗 CurseForge: https://www.curseforge.com/...

📊 Versões:
  • Original: 2.6.0
  • Traduzida: 2.5.0
  • Status: ⚠️ Desatualizado

🏷️ Aliases:
  • EV Mod
  • Violência
```

---

## Comandos de Aliases

### ➕ Adicionar Alias

**Comando:**
```
!mod alias add <mod_id> <alias>
```

**O que são aliases?**
- Nomes alternativos que você usa para o mod
- Ajudam a IA a identificar o mod nos seus posts
- Quanto mais aliases, melhor a detecção

**Quando usar:**
- Depois de criar/importar um mod
- Sempre que você perceber que usa outro nome

**Exemplos de aliases úteis:**
```
Mod: "Violência Extrema PT-BR"
Aliases: 
- "Extreme Violence"
- "EV Mod"
- "Violência"
- "ExV"
```

**Exemplo de comando:**
```
!mod alias add x9y8z7w6-5432-10ab-cdef "EV Mod"
!mod alias add x9y8z7w6-5432-10ab-cdef Violência
!mod alias add x9y8z7w6-5432-10ab-cdef "Extreme Violence"
```

**Resultado:**
```
✅ Alias "EV Mod" adicionado ao mod Violência Extrema PT-BR!
```

---

## Comandos de Revisão

### 📋 Ver Posts Pendentes

**Comando:**
```
!mod review
```

**Quando usar:**
- Ver quais posts ainda precisam de confirmação
- Verificar se há detecções pendentes

**Resultado:**
```
⚠️ Posts Pendentes de Revisão
2 post(s) aguardando confirmação

📦 Atualização EV Mod 2.6.0
[Ver Post](https://patreon.com/...)
• Violência Extrema (95%)

📦 Magic System Update
[Ver Post](https://patreon.com/...)
• Sistema de Magia (88%)
```

---

### ❓ Ver Ajuda

**Comando:**
```
!mod help
```

**Quando usar:**
- Esquecer a sintaxe de um comando
- Ver lista rápida de todos os comandos

---

## Exemplos Práticos Completos

### 🚀 Cenário 1: Configuração Inicial Completa

Você é um tradutor novo e quer configurar tudo do zero.

**Passo 1: Criar você como autor**
```
!mod author add "Meu Nome" https://patreon.com/meunome
```
↳ Guarde o ID: `a1b2c3d4-5678-90ab-cdef`

**Passo 2: Criar campanha do Patreon (via API)**
```bash
curl -X POST http://localhost:3000/patreon/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "15336996",
    "creatorName": "Meu Nome",
    "notificationChannelId": "1455897804303110338",
    "checkIntervalMins": 30
  }'
```

**Passo 3: Vincular autor à campanha**
```
!mod author link a1b2c3d4-5678-90ab-cdef 15336996
```

**Passo 4: Importar suas traduções**
```
!mod import a1b2c3d4-5678-90ab-cdef https://www.curseforge.com/sims4/mods/extreme-violence-pt-br
!mod import a1b2c3d4-5678-90ab-cdef https://www.curseforge.com/sims4/mods/magic-system-pt-br
```

**Passo 5: Definir versões atuais**
```
!mod update extreme-violence 2.5.0
!mod update magic-system 1.2.0
```

**Passo 6: Adicionar aliases**
```
!mod alias add <mod_id_ev> "EV Mod"
!mod alias add <mod_id_ev> "Violência"
!mod alias add <mod_id_magic> "Magia"
!mod alias add <mod_id_magic> "Sistema Mágico"
```

✅ **Pronto! Sistema configurado e funcionando!**

---

### 🔄 Cenário 2: Importar Vários Mods Rapidamente

Você tem 10 traduções e quer importar todas.

**Passo 1: Listar autores para pegar ID**
```
!mod author list
```
↳ Copie seu ID: `a1b2c3d4-5678-90ab-cdef`

**Passo 2: Importar todos de uma vez**
```
!mod import a1b2c3d4-5678-90ab-cdef https://www.curseforge.com/sims4/mods/mod1-pt-br
!mod import a1b2c3d4-5678-90ab-cdef https://www.curseforge.com/sims4/mods/mod2-pt-br
!mod import a1b2c3d4-5678-90ab-cdef https://www.curseforge.com/sims4/mods/mod3-pt-br
```
(repita para todos)

**Passo 3: Listar todos e anotar IDs**
```
!mod list
```

**Passo 4: Atualizar versões**
```
!mod update mod1 1.0.0
!mod update mod2 2.3.0
!mod update mod3 1.5.0
```

---

### 📱 Cenário 3: Fluxo Diário de Uso

Você atualizou uma tradução e quer que o sistema saiba.

**Situação:** Você atualizou "Violência Extrema" para v2.6.0

**Passo 1: Atualizar versão no sistema**
```
!mod update violencia 2.6.0
```

**Passo 2: Fazer post no Patreon**
```
🎮 Violência Extrema v2.6.0 Atualizado!

Nova versão disponível com correções e melhorias!
Download: https://...
```

**Passo 3: Sistema detecta automaticamente**
- IA analisa o post
- Envia notificação no Discord
- Você clica em "Confirmar"

**Passo 4: Versão atualizada automaticamente!**

---

## Perguntas Frequentes

### ❓ Qual a diferença entre !mod add e !mod import?

**!mod add:**
- Você digita tudo manualmente
- Útil se quiser controle total

**!mod import:**
- Extrai informações da URL automaticamente
- Mais rápido e menos propenso a erros
- **RECOMENDADO**

---

### ❓ Preciso criar um autor para mim mesmo?

**Sim!** Você é o "autor" das traduções. O sistema precisa saber:
- Quem você é
- Qual sua campanha do Patreon
- Quais mods são seus

---

### ❓ O que é Campaign ID e onde encontro?

É o identificador único da sua campanha do Patreon.

**Como pegar:**
1. Acesse: `https://www.patreon.com/api/oauth2/v2/campaigns`
2. Faça login
3. Copie o valor de `"id"` (geralmente um número como `15336996`)

---

### ❓ Posso ter vários autores?

**Sim!** Se você gerencia traduções de várias pessoas ou times:
```
!mod author add "Time A"
!mod author add "Time B"
```

Cada um pode ter sua própria campanha e mods.

---

### ❓ Como adicionar um mod que não está no CurseForge?

Use `!mod add` em vez de `!mod import`:
```
!mod add <author_id> "Nome do Mod" https://link-qualquer.com
```

---

### ❓ Posso deletar um mod?

Atualmente não há comando de delete. Entre em contato com o desenvolvedor se precisar remover algo.

---

### ❓ O que acontece se eu não confirmar uma detecção?

Nada! O post fica marcado como "pendente de revisão". Use `!mod review` para ver os pendentes.

---

### ❓ Posso usar nomes parciais nos comandos?

**Sim!** O sistema aceita:
- ID completo: `x9y8z7w6-5432-10ab-cdef`
- Nome completo: `"Violência Extrema PT-BR"`
- Nome parcial: `violencia`
- Slug: `extreme-violence-pt-br`

---

### ❓ Quantos aliases devo adicionar?

**Recomendação:** 3-5 aliases por mod.

**Exemplos:**
- Nome em inglês original
- Abreviação comum
- Nome que você usa nos posts
- Variações de escrita

Quanto mais, melhor a detecção!

---

### ❓ O sistema funciona offline?

**Não.** Precisa de:
- ✅ Servidor rodando
- ✅ Conexão com internet
- ✅ API do Groq funcionando
- ✅ Discord online

---

### ❓ Como sei se o sistema está funcionando?

**Sinais de que está OK:**
```
[ModNotificationService] Mod review channel configured: 1455897...
[PatreonSchedulerService] Found 1 active campaigns to check
```

**Teste manual:**
```bash
curl -X POST http://localhost:3000/patreon/campaigns/<campaign_id>/check
```

---

## 🎯 Dicas Importantes

### ✅ Boas Práticas

1. **Use !mod import sempre que possível**
   - Mais rápido e seguro

2. **Adicione muitos aliases**
   - Melhora muito a detecção automática

3. **Mantenha versões atualizadas**
   - Use !mod update regularmente

4. **Verifique !mod review periodicamente**
   - Confirme detecções pendentes

5. **Use nomes descritivos**
   - Facilita encontrar mods depois

### ⚠️ Erros Comuns

**Erro: "Autor não encontrado"**
- Solução: Use !mod author list para ver o ID correto

**Erro: "Mod já existe"**
- Solução: O mod já foi importado, use !mod list para ver

**Erro: "URL inválida"**
- Solução: Use uma URL do curseforge.com

**Nada está sendo detectado**
- Solução: 
  1. Verifique se autor está vinculado à campanha
  2. Adicione mais aliases
  3. Use palavras-chave nos posts (mod, update, version)

---

## 📞 Suporte

Se algo não funcionar:

1. Verifique os logs do servidor
2. Use !mod help para ver sintaxe
3. Teste com !mod list para verificar cadastros
4. Entre em contato com o desenvolvedor

---

**Versão:** 1.0.0  
**Última atualização:** 31/12/2025
