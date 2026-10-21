# casca — operar o servidor do Discord pela API, a partir do PC

Ferramenta em Python (só biblioteca padrão) que usa o token do bot Alic3 para ler e organizar um servidor do Discord pela
API REST. Não precisa do bot rodando.

## Configuração
Arquivo `.env` na raiz do repo (já está no `.gitignore`; **nunca** commitar). Use barras normais (`/`) nos caminhos:
```
DISCORD_TOKEN=<token do Developer Portal > Bot > Reset Token>
CASCA_SERVIDOR=<id do único servidor em que a casca atua>
CASCA_FOTOS=<pasta das fotos da estrutura>
CASCA_REGISTRO=<arquivo .jsonl do registro de ações>
CASCA_ACERVO=<acervo.json usado pelo quadro e pelos avisos>
```

## Comandos (na raiz do repo)
```
python -I casca eu                          # confere o token e lista os servidores do bot
python -I casca foto                        # grava a estrutura do servidor (só leitura)
python -I casca plano --alvo <alvo.json>    # o que mudaria para chegar ao alvo (não escreve)
python -I casca aplicar --alvo <alvo.json> [--ensaio]   # foto antes, executa, registra cada ação
python -I casca quadro [--ensaio] [--canal <nome>] [--data AAAA-MM-DD]   # quadro de status (edita só o que mudou)
python -I casca aviso --mod <Autor/Mod> [--nova] [--ensaio]              # aviso silencioso de tradução publicada
python -I casca diario "<frase curta>" [--ensaio]                         # frase no diário do tradutor
```

## Alvo (JSON)
`servidor`, `arquivo` (categoria para onde vão os canais fora do alvo), `categorias` (em ordem, cada uma com `canais`) e
`sem_categoria`. Por canal: `nome` e, opcionalmente, `tipo` (texto, anuncio, forum, voz), `topico`, `so_leitura`,
`sincronizar` (copiar as permissões da categoria ao mover). Campo ausente = não mexer.

## Regras
- O token nunca é impresso, gravado em arquivo nem posto em URL (há teste para isso).
- Só escreve no servidor de `CASCA_SERVIDOR`. Nada é apagado: canal fora do alvo vai para a categoria de arquivo; canal
  que o bot não vê nunca é tocado; nome ambíguo para em vez de adivinhar.
- Mensagens do bot saem silenciosas e sem menções. O quadro só edita as mensagens com a assinatura dele.
- 429: espera o `Retry-After` e repete (até 5 vezes); escritas espaçadas (no máximo 5 por segundo).

## Testes (sem rede, sem token real)
```
python -I -m unittest discover -s casca/testes -t .
```
