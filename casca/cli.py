"""Comandos da casca. Toda saída passa por `saida`/`erro` (injetáveis nos testes) e nunca contém o token."""
import argparse
import sys

import json
from pathlib import Path

from casca import estrutura, organizar
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


def _ler_alvo(ctx):
    alvo = json.loads(Path(ctx.args.alvo).read_text(encoding="utf-8"))
    sid = servidor_configurado(ctx)
    if str(alvo.get("servidor")) != sid:
        raise FaltaConfig(f"o alvo é do servidor {alvo.get('servidor')}, mas CASCA_SERVIDOR é {sid}: nada foi feito")
    return alvo, sid


def _mostrar_plano(ctx, plano):
    ops = plano["operacoes"]
    ctx.diz(f"Plano: {len(ops)} operação(ões)")
    for i, op in enumerate(ops, 1):
        ctx.diz(f"  {i}. {organizar.descrever(op)}")
    for a in plano["avisos"]:
        ctx.diz(f"  ATENÇÃO: {a}")


def cmd_plano(ctx):
    """Compara a estrutura atual com o alvo e lista as operações (não escreve nada)."""
    alvo, sid = _ler_alvo(ctx)
    foto = estrutura.tirar_foto(ctx.api, sid)
    _mostrar_plano(ctx, organizar.planejar(foto, alvo))
    return 0


def cmd_aplicar(ctx):
    """Tira foto, planeja e executa (ou só mostra, com --ensaio). Para na 1ª falha; registra cada operação."""
    alvo, sid = _ler_alvo(ctx)
    pasta = ctx.config("CASCA_FOTOS")
    registro = ctx.config("CASCA_REGISTRO")
    if not ctx.args.ensaio and not (pasta and registro):
        raise FaltaConfig("defina CASCA_FOTOS e CASCA_REGISTRO no .env antes de aplicar")
    foto = estrutura.tirar_foto(ctx.api, sid)
    plano = organizar.planejar(foto, alvo)
    _mostrar_plano(ctx, plano)
    if ctx.args.ensaio:
        ctx.diz("Ensaio: nada foi alterado.")
        return 0
    if plano["avisos"]:
        ctx.diz("Parado: o bot não tem as permissões listadas acima. Nada foi alterado.")
        return 1
    ctx.diz(f"Foto antes: {estrutura.gravar_foto(foto, pasta)}")
    feitas, erro = organizar.Aplicador(ctx.api, foto, registro).aplicar(plano["operacoes"])
    ctx.diz(f"Feitas: {feitas} de {len(plano['operacoes'])}. Registro: {registro}")
    if erro:
        print(f"ERRO na operação {feitas + 1}: {erro}", file=ctx.erro)
        return 1
    return 0


COMANDOS = {"eu": cmd_eu, "foto": cmd_foto, "plano": cmd_plano, "aplicar": cmd_aplicar}


def montar_parser():
    p = argparse.ArgumentParser(prog="casca", description="Opera o servidor do Discord com o token do bot Alic3.")
    sub = p.add_subparsers(dest="comando", required=True)
    sub.add_parser("eu", help="confere o token e lista os servidores do bot")
    f = sub.add_parser("foto", help="grava a estrutura do servidor (só leitura)")
    f.add_argument("--saida", help="pasta da foto (padrão: CASCA_FOTOS do .env)")
    pl = sub.add_parser("plano", help="lista as operações para chegar ao alvo (não escreve)")
    pl.add_argument("--alvo", required=True, help="JSON com a estrutura desejada")
    ap = sub.add_parser("aplicar", help="executa o plano (foto antes, registro de cada operação)")
    ap.add_argument("--alvo", required=True, help="JSON com a estrutura desejada")
    ap.add_argument("--ensaio", action="store_true", help="só mostra o plano, sem escrever nada")
    return p


def main(argv=None, env=None, transporte=None, saida=None, erro=None, caminho_env=ENV_PADRAO, dormir=None):
    saida = saida or sys.stdout
    erro = erro or sys.stderr
    for fluxo in (saida, erro):  # console do Windows (cp1252) não imprime emoji de nome de canal
        if hasattr(fluxo, "reconfigure"):
            try:
                fluxo.reconfigure(encoding="utf-8", errors="replace")
            except (ValueError, OSError):
                fluxo.reconfigure(errors="replace")
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
    except (FaltaConfig, organizar.ErroPlano) as e:
        print(f"ERRO: {e}", file=erro)
        return 2
    except ErroDiscord as e:
        print(f"ERRO: {e}", file=erro)
        return 1
