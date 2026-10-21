"""Comandos da casca. Toda saída passa por `saida`/`erro` (injetáveis nos testes) e nunca contém o token."""
import argparse
import sys

import json
from pathlib import Path

import datetime

from casca import estrutura, organizar, quadro
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


def _canal(ctx, nome):
    """Canal do servidor configurado cujo nome normalizado é `nome` (exatamente um)."""
    sid = servidor_configurado(ctx)
    achados = [c for c in ctx.api.get(f"/guilds/{sid}/channels") if organizar.chave(c.get("name")) == organizar.chave(nome)]
    if len(achados) != 1:
        raise FaltaConfig(f"canal '{nome}': {len(achados)} encontrado(s) no servidor configurado (esperado 1)")
    return achados[0]


def _acervo(ctx):
    caminho = ctx.args.acervo or ctx.config("CASCA_ACERVO")
    if not caminho:
        raise FaltaConfig("defina CASCA_ACERVO=<caminho do acervo.json> no .env ou use --acervo")
    return quadro.carregar_acervo(caminho)


def cmd_quadro(ctx):
    """Monta o quadro de status a partir do acervo e sincroniza com o canal (edita só o que mudou)."""
    data = ctx.args.data or datetime.date.today().isoformat()
    mensagens = quadro.renderizar(_acervo(ctx), data)
    ctx.diz(f"Quadro: {len(mensagens)} mensagem(ns), {sum(len(m['embeds']) for m in mensagens)} bloco(s)")
    if ctx.args.ensaio:
        for m in mensagens:
            for e in m["embeds"]:
                ctx.diz(f"## {e['title']}")
                ctx.diz(e["description"])
        ctx.diz("Ensaio: nada foi alterado.")
        return 0
    canal = _canal(ctx, ctx.args.canal)
    eu = ctx.api.get("/users/@me")
    r = quadro.sincronizar(ctx.api, canal["id"], eu["id"], mensagens)
    ctx.diz(f"#{canal['name']}: {r['postadas']} postada(s), {r['editadas']} editada(s), {r['iguais']} igual(is), "
            f"{r['esvaziadas']} esvaziada(s)")
    return 0


def cmd_aviso(ctx):
    """Aviso silencioso de tradução publicada (modelo fixo) no canal de novidades."""
    mods = [m for m in _acervo(ctx) if m["mod"].lower() == ctx.args.mod.lower()]
    if len(mods) != 1 or not mods[0].get("publicacao_url"):
        raise FaltaConfig(f"mod '{ctx.args.mod}' não encontrado no acervo ou sem link de publicação")
    texto = quadro.texto_aviso(mods[0], nova=ctx.args.nova)
    if ctx.args.ensaio:
        ctx.diz(texto)
        return 0
    canal = _canal(ctx, ctx.args.canal)
    quadro.postar(ctx.api, canal, texto)
    ctx.diz(f"#{canal['name']}: {texto}")
    return 0


def cmd_diario(ctx):
    """Frase curta e silenciosa no diário do tradutor."""
    frase = " ".join(ctx.args.frase).strip()
    if not frase or len(frase) > 300:
        raise FaltaConfig("a frase do diário precisa ter de 1 a 300 caracteres")
    if ctx.args.ensaio:
        ctx.diz(frase)
        return 0
    canal = _canal(ctx, ctx.args.canal)
    quadro.postar(ctx.api, canal, frase)
    ctx.diz(f"#{canal['name']}: {frase}")
    return 0


COMANDOS = {"eu": cmd_eu, "foto": cmd_foto, "plano": cmd_plano, "aplicar": cmd_aplicar, "quadro": cmd_quadro,
            "aviso": cmd_aviso, "diario": cmd_diario}


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
    q = sub.add_parser("quadro", help="atualiza o quadro de status das traduções")
    q.add_argument("--canal", default="status-das-traducoes")
    q.add_argument("--acervo", help="acervo.json (padrão: CASCA_ACERVO do .env)")
    q.add_argument("--data", help="data do cabeçalho AAAA-MM-DD (padrão: hoje)")
    q.add_argument("--ensaio", action="store_true", help="só mostra o quadro, sem escrever")
    av = sub.add_parser("aviso", help="aviso silencioso de tradução publicada")
    av.add_argument("--mod", required=True, help="Autor/Mod como no acervo")
    av.add_argument("--nova", action="store_true", help="tradução nova (em vez de atualizada)")
    av.add_argument("--canal", default="novidades-quentes")
    av.add_argument("--acervo")
    av.add_argument("--ensaio", action="store_true")
    di = sub.add_parser("diario", help="frase curta no diário do tradutor")
    di.add_argument("frase", nargs="+")
    di.add_argument("--canal", default="diario-do-tradutor")
    di.add_argument("--ensaio", action="store_true")
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
    except (FaltaConfig, organizar.ErroPlano, ValueError) as e:
        print(f"ERRO: {e}", file=erro)
        return 2
    except ErroDiscord as e:
        print(f"ERRO: {e}", file=erro)
        return 1
