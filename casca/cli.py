"""Comandos da casca. Toda saída passa por `saida`/`erro` (injetáveis nos testes) e nunca contém o token."""
import argparse
import sys

from casca import estrutura
from casca.discord_api import Discord, ErroDiscord, TokenAusente, ler_config, ler_token, ENV_PADRAO


class Contexto:
    """O que cada comando recebe: cliente da API, argumentos e onde escrever."""

    def __init__(self, api, args, saida, erro, env=None, caminho_env=ENV_PADRAO):
        self.api, self.args, self.saida, self.erro = api, args, saida, erro
        self.env, self.caminho_env = env, caminho_env

    def config(self, chave):
        return ler_config(chave, self.env, self.caminho_env)

    def diz(self, texto=""):
        print(texto, file=self.saida)


def cmd_eu(ctx):
    """Confere o token: mostra o nome e o id do bot e os servidores em que ele está."""
    eu = ctx.api.get("/users/@me")
    ctx.diz(f"Bot: {eu.get('username')} (id {eu.get('id')})")
    for g in ctx.api.get("/users/@me/guilds"):
        ctx.diz(f"  servidor: {g.get('name')} (id {g.get('id')})")
    return 0


class FaltaConfig(Exception):
    """Configuração obrigatória ausente (sai com código 2)."""


def servidor_configurado(ctx):
    sid = ctx.config("CASCA_SERVIDOR")
    if not sid:
        raise FaltaConfig("defina CASCA_SERVIDOR=<id do servidor> no .env (único servidor em que a casca atua)")
    return sid


def cmd_foto(ctx):
    """Foto da estrutura do servidor (só leitura), gravada em CASCA_FOTOS (ou --saida)."""
    sid = servidor_configurado(ctx)
    pasta = ctx.args.saida or ctx.config("CASCA_FOTOS")
    if not pasta:
        raise FaltaConfig("defina CASCA_FOTOS=<pasta> no .env ou use --saida <pasta>")
    foto = estrutura.tirar_foto(ctx.api, sid)
    caminho = estrutura.gravar_foto(foto, pasta)
    for linha in estrutura.resumo(foto):
        ctx.diz(linha)
    ctx.diz(f"Foto gravada: {caminho}")
    return 0


COMANDOS = {"eu": cmd_eu, "foto": cmd_foto}


def montar_parser():
    p = argparse.ArgumentParser(prog="casca", description="Opera o servidor do Discord com o token do bot Alic3.")
    sub = p.add_subparsers(dest="comando", required=True)
    sub.add_parser("eu", help="confere o token e lista os servidores do bot")
    f = sub.add_parser("foto", help="grava a estrutura do servidor (só leitura)")
    f.add_argument("--saida", help="pasta da foto (padrão: CASCA_FOTOS do .env)")
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
        return COMANDOS[args.comando](Contexto(api, args, saida, erro, env, caminho_env))
    except FaltaConfig as e:
        print(f"ERRO: {e}", file=erro)
        return 2
    except ErroDiscord as e:
        print(f"ERRO: {e}", file=erro)
        return 1
