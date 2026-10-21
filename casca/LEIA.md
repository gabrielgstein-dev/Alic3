# casca — operar o servidor do Discord pela API, a partir do PC

Ferramenta em Python (só biblioteca padrão) que usa o token do bot Alic3 para ler e organizar um servidor do Discord pela
API REST. Não precisa do bot rodando.

## Configuração
Arquivo `.env` na raiz do repo (já está no `.gitignore`; **nunca** commitar):
```
DISCORD_TOKEN=<token do Developer Portal > Bot > Reset Token>
CASCA_SERVIDOR=<id do único servidor em que a casca pode escrever>
```

## Comandos (na raiz do repo)
```
python -I casca eu        # confere o token e lista os servidores do bot
```

## Testes (sem rede, sem token real)
```
python -I -m unittest discover -s casca/testes -t .
```

## Regras
- O token nunca é impresso, gravado em arquivo nem posto em URL (há teste para isso).
- 429: espera o `Retry-After` e repete (até 5 vezes); escritas espaçadas (no máximo 5 por segundo).
