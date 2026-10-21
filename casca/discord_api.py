"""Cliente único da API REST do Discord. Toda requisição passa por aqui.

Regras: o token nunca aparece em repr, exceção, log ou URL; 429 espera o Retry-After e repete (até 5 vezes);
escritas ficam espaçadas (no máximo 5 por segundo). O transporte é injetável (os testes usam um simulador).
"""
import json
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

API = "https://discord.com/api/v10"
USER_AGENT = "DiscordBot (https://github.com/gabrielgstein-dev/Alic3, casca)"
ENV_PADRAO = Path(__file__).resolve().parent.parent / ".env"
_SNOWFLAKE = re.compile(r"\d{15,}")


class TokenAusente(Exception):
    """Não há DISCORD_TOKEN no ambiente nem no .env."""


class ErroDiscord(Exception):
    """Erro devolvido pela API. Guarda método, rota (ids trocados por {id}), status e a mensagem da API."""

    def __init__(self, metodo, rota, status, mensagem, codigo=None):
        self.metodo, self.rota, self.status, self.codigo = metodo, _SNOWFLAKE.sub("{id}", rota), status, codigo
        if status == 401:
            explicacao = "token inválido ou revogado (gere outro no Developer Portal > Bot > Reset Token)"
        elif status == 403:
            explicacao = "o bot não tem permissão para isso"
        else:
            explicacao = mensagem or "erro da API"
        self.mensagem = explicacao
        super().__init__(f"{metodo} {self.rota} -> HTTP {status}: {explicacao}"
                         + (f" (código {codigo}: {mensagem})" if codigo and status != 401 else ""))


def ler_config(chave, env=None, caminho_env=ENV_PADRAO):
    """Valor de `chave`: primeiro do ambiente, depois da linha `CHAVE=` do .env. Vazio → None."""
    env = os.environ if env is None else env
    valor = (env.get(chave) or "").strip()
    if valor:
        return valor
    caminho = Path(caminho_env)
    if caminho.is_file():
        for linha in caminho.read_text(encoding="utf-8").splitlines():
            linha = linha.strip()
            if linha.startswith(chave + "="):
                valor = linha.split("=", 1)[1].strip().strip('"').strip("'")
                if valor:
                    return valor
    return None


def ler_token(env=None, caminho_env=ENV_PADRAO):
    """Devolve o token (DISCORD_TOKEN do ambiente ou do .env) ou levanta TokenAusente."""
    valor = ler_config("DISCORD_TOKEN", env, caminho_env)
    if valor:
        return valor
    raise TokenAusente(f"Sem token do bot. Coloque a linha DISCORD_TOKEN=<token> em {Path(caminho_env)} "
                       "(arquivo ignorado pelo git) ou na variável de ambiente DISCORD_TOKEN.")


def transporte_urllib(metodo, url, cabecalhos, corpo):
    """Faz a requisição de verdade. Devolve (status, cabeçalhos em minúsculas, corpo em bytes)."""
    req = urllib.request.Request(url, data=corpo, method=metodo, headers=cabecalhos)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, {k.lower(): v for k, v in resp.headers.items()}, resp.read()
    except urllib.error.HTTPError as erro:
        return erro.code, {k.lower(): v for k, v in erro.headers.items()}, erro.read()


class Discord:
    """Cliente da API. `transporte(metodo, url, cabecalhos, corpo) -> (status, cabecalhos, corpo)`."""

    def __init__(self, token, transporte=None, dormir=time.sleep, relogio=time.monotonic,
                 intervalo_escrita=0.2, max_tentativas=5):
        self.__token = token
        self._transporte = transporte or transporte_urllib
        self._dormir, self._relogio = dormir, relogio
        self._intervalo, self._max = intervalo_escrita, max_tentativas
        self._ultima_escrita = None

    def __repr__(self):
        return "Discord(token=***)"

    def req(self, metodo, rota, corpo=None):
        """Chama `metodo rota` (rota começa com /). Devolve o JSON da resposta (None em 204)."""
        if metodo != "GET":
            self._espacar_escrita()
        cabecalhos = {"Authorization": f"Bot {self.__token}", "User-Agent": USER_AGENT}
        dados = None
        if corpo is not None:
            dados = json.dumps(corpo, ensure_ascii=False).encode("utf-8")
            cabecalhos["Content-Type"] = "application/json"
        for tentativa in range(1, self._max + 1):
            status, resp_cab, resp = self._transporte(metodo, API + rota, cabecalhos, dados)
            if status == 429 and tentativa < self._max:
                self._dormir(_retry_after(resp_cab, resp))
                continue
            if 200 <= status < 300:
                return json.loads(resp.decode("utf-8")) if resp else None
            info = _json_ou_vazio(resp)
            raise ErroDiscord(metodo, rota, status, info.get("message"), info.get("code"))
        raise ErroDiscord(metodo, rota, 429, "limite de taxa: tentativas esgotadas")  # pragma: no cover

    def get(self, rota):
        return self.req("GET", rota)

    def post(self, rota, corpo=None):
        return self.req("POST", rota, corpo if corpo is not None else {})

    def patch(self, rota, corpo):
        return self.req("PATCH", rota, corpo)

    def put(self, rota, corpo=None):
        return self.req("PUT", rota, corpo if corpo is not None else {})

    def _espacar_escrita(self):
        agora = self._relogio()
        if self._ultima_escrita is not None:
            falta = self._intervalo - (agora - self._ultima_escrita)
            if falta > 0:
                self._dormir(falta)
                agora += falta
        self._ultima_escrita = agora


def _json_ou_vazio(corpo):
    try:
        dado = json.loads(corpo.decode("utf-8")) if corpo else {}
        return dado if isinstance(dado, dict) else {}
    except (ValueError, UnicodeDecodeError):
        return {}


def _retry_after(cabecalhos, corpo):
    """Segundos de espera: cabeçalho Retry-After, senão `retry_after` do JSON, senão 1 s."""
    for fonte in (cabecalhos.get("retry-after"), _json_ou_vazio(corpo).get("retry_after")):
        try:
            if fonte is not None:
                return max(0.0, float(fonte))
        except (TypeError, ValueError):
            pass
    return 1.0
