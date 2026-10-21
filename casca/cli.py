"""Comandos da casca. Toda saída passa por `saida`/`erro` (injetáveis nos testes) e nunca contém o token."""
import argparse
import sys

from casca.discord_api import Discord, ErroDiscord, TokenAusente, ler_token, ENV_PADRAO


class Contexto:
    """O que cada comando recebe: cliente da API, argumentos e onde escrever."""

    def __init__(self, api, args, saida, erro):
        self.api, self.args, self.saida, self.erro = api, args, saida, erro

    def diz(self, texto=""):
        print(texto, file=self.saida)


def cmd_eu(ctx):
    """Confere o token: mostra o nome e o id do bot e os servidores em que ele está."""
    eu = ctx.api.get("/users/@me")
    ctx.diz(f"Bot: {eu.get('username')} (id {eu.get('id')})")
    for g in ctx.api.get("/users/@me/guilds"):
        ctx.diz(f"  servidor: {g.get('name')} (id {g.get('id')})")
    return 0


COMANDOS = {"eu": cmd_eu}


def montar_parser():
    p = argparse.ArgumentParser(prog="casca", description="Opera o servidor do Discord com o token do bot Alic3.")
    sub = p.add_subparsers(dest="comando", required=True)
    sub.add_parser("eu", help="confere o token e lista os servidores do bot")
    return p


def main(argv=None, env=None, transporte=None, saida=None, erro=None, caminho_env=ENV_PADRAO, dormir=None):
    saida = saida or sys.stdout
    erro = erro or sys.stderr
    args = montar_parser().parse_args(argv)
    try:
        token = ler_token(env, caminho_env)
    except TokenAusente as e:
        print(f"ERRO: {e}", file=erro)
        return 2
    extra = {"dormir": dormir} if dormir else {}
    api = Discord(token, transporte=transporte, **extra)
    try:
        return COMANDOS[args.comando](Contexto(api, args, saida, erro))
    except ErroDiscord as e:
        print(f"ERRO: {e}", file=erro)
        return 1
