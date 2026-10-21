"""Simulador da API do Discord para os testes (sem rede).

`Simulador.responder(metodo, padrao_rota, status, corpo, cabecalhos)` enfileira respostas para uma rota
(regex sobre o caminho depois de /api/v10). Sem resposta enfileirada, usa a última registrada para a rota
(fixa). Toda requisição fica em `.chamadas` como (metodo, rota, corpo_json, cabecalhos).
"""
import json
import re

from casca.discord_api import API


class Simulador:
    def __init__(self):
        self.rotas = []  # [ [metodo, regex, fila de respostas] ]
        self.chamadas = []

    def responder(self, metodo, padrao, status=200, corpo=None, cabecalhos=None):
        resp = (status, {k.lower(): v for k, v in (cabecalhos or {}).items()},
                b"" if corpo is None else json.dumps(corpo).encode("utf-8"))
        for r in self.rotas:
            if r[0] == metodo and r[1].pattern == f"^{padrao}$":
                r[2].append(resp)
                return self
        self.rotas.append([metodo, re.compile(f"^{padrao}$"), [resp]])
        return self

    def __call__(self, metodo, url, cabecalhos, corpo):
        assert url.startswith(API), url
        rota = url[len(API):]
        self.chamadas.append((metodo, rota, json.loads(corpo) if corpo else None, dict(cabecalhos)))
        for m, rx, fila in self.rotas:
            if m == metodo and rx.match(rota):
                return fila.pop(0) if len(fila) > 1 else fila[0]
        return 404, {}, json.dumps({"message": f"sem rota simulada: {metodo} {rota}", "code": 0}).encode()

    def escritas(self):
        return [c for c in self.chamadas if c[0] != "GET"]
