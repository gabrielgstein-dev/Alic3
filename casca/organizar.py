"""Plano (foto × alvo → operações) e aplicação das operações, com registro de cada uma.

Regras: nada é apagado; canal fora do alvo vai para a categoria de arquivo; canal que o bot não vê nunca é tocado;
campo ausente no alvo = não mexer; nome ambíguo = erro (nunca adivinhar).
"""
import datetime
import json
import re
import unicodedata

from casca import permissoes
from casca.discord_api import ErroDiscord

TIPO_N = {"texto": 0, "anuncio": 5, "forum": 15, "voz": 2, "categoria": 4}
SO_LEITURA_NEGA = (permissoes.BIT["SEND_MESSAGES"] | permissoes.BIT["SEND_MESSAGES_IN_THREADS"]
                   | permissoes.BIT["CREATE_PUBLIC_THREADS"] | permissoes.BIT["CREATE_PRIVATE_THREADS"])
BOT_PERMITE = (permissoes.BIT["VIEW_CHANNEL"] | permissoes.BIT["SEND_MESSAGES"] | permissoes.BIT["EMBED_LINKS"]
               | permissoes.BIT["READ_MESSAGE_HISTORY"])
SILENCIOSA = 1 << 12


class ErroPlano(Exception):
    """Alvo inválido, nome ambíguo ou mudança não suportada."""


def chave(nome):
    """Nome normalizado para casar alvo × servidor: sem emoji, acento e símbolos; minúsculas; hífens."""
    sem_acento = "".join(c for c in unicodedata.normalize("NFKD", nome or "") if not unicodedata.combining(c))
    return "-".join(re.findall(r"[a-z0-9]+", sem_acento.lower()))


def _bits(nomes):
    return sum(permissoes.BIT.get(n, 0) for n in nomes)


def _overwrites_api(item):
    """Overwrites da foto (nomes) → formato da API (ints em string)."""
    return [{"id": o["id"], "type": 0 if o["tipo"] == "cargo" else 1,
             "allow": str(_bits(o["permite"])), "deny": str(_bits(o["nega"]))} for o in item["overwrites"]]


def _e_so_leitura(item, servidor_id):
    return any(o["id"] == servidor_id and "SEND_MESSAGES" in o["nega"] for o in item["overwrites"])


def grupo(tipo):
    """Família do tipo para desempatar nomes iguais: voz/palco × o resto. None = qualquer."""
    if tipo is None:
        return None
    return "voz" if tipo in ("voz", "palco") else "texto"


def validar_alvo(alvo):
    if not isinstance(alvo, dict) or not alvo.get("servidor") or not isinstance(alvo.get("categorias"), list):
        raise ErroPlano("alvo precisa de 'servidor' e da lista 'categorias'")
    if not alvo.get("arquivo"):
        raise ErroPlano("alvo precisa de 'arquivo' (nome da categoria para onde vão os canais fora do alvo)")
    vistos = {}
    for cat in alvo["categorias"] + [{"nome": None, "canais": alvo.get("sem_categoria", [])}]:
        for c in cat.get("canais", []):
            k, gr = chave(c["nome"]), grupo(c.get("tipo"))
            if any(g is None or gr is None or g == gr for g in vistos.get(k, [])):
                raise ErroPlano(f"canal repetido no alvo: {c['nome']} (dê o 'tipo' para diferenciar voz de texto)")
            vistos.setdefault(k, []).append(gr)
            if c.get("tipo") and c["tipo"] not in TIPO_N:
                raise ErroPlano(f"tipo desconhecido em {c['nome']}: {c['tipo']}")


def planejar(foto, alvo):
    """Devolve {'operacoes': [...], 'avisos': [...]} sem chamar a API."""
    validar_alvo(alvo)
    sid = foto["servidor"]["id"]
    if str(alvo["servidor"]) != sid:
        raise ErroPlano(f"o alvo é do servidor {alvo['servidor']}, a foto é de {sid}")
    cats, canais = {}, {}
    for c in foto["canais"]:
        (cats if c["tipo"] == "categoria" else canais).setdefault(chave(c["nome"]), []).append(c)
    pode_servidor = set(foto["bot"]["permissoes_servidor"])
    ops, avisos, usados = [], [], set()

    def unico(indice, nome, tipo, tipo_spec=None):
        achados = indice.get(chave(nome), [])
        if tipo_spec:
            achados = [a for a in achados if grupo(a["tipo"]) == grupo(tipo_spec)]
        if len(achados) > 1:
            raise ErroPlano(f"{tipo} ambíguo: '{nome}' casa com {len(achados)} itens do servidor; renomeie um deles")
        return achados[0] if achados else None

    def exige(perm, onde, item=None):
        tem = set(item["bot_pode"]) if item else pode_servidor
        if perm not in tem:
            avisos.append(f"falta {perm} ao bot em {onde}")

    destino_cat = {}
    for cat in alvo["categorias"]:
        if chave(cat["nome"]) in destino_cat:
            continue
        existente = unico(cats, cat["nome"], "categoria")
        destino_cat[chave(cat["nome"])] = existente["id"] if existente else None
        if not existente:
            ops.append({"op": "criar_categoria", "nome": cat["nome"], "privado": bool(cat.get("privado"))})
            exige("MANAGE_CHANNELS", "servidor")
            if cat.get("privado"):
                exige("MANAGE_ROLES", "servidor")

    ordem_cat = []
    for cat in alvo["categorias"] + [{"nome": None, "canais": alvo.get("sem_categoria", [])}]:
        nomes_ordem = []
        for spec in cat.get("canais", []):
            atual = unico(canais, spec["nome"], "canal", spec.get("tipo"))
            nomes_ordem.append(spec["nome"])
            if atual is None:
                ops.append({"op": "criar_canal", "nome": spec["nome"], "tipo": spec.get("tipo", "texto"),
                            "categoria": cat["nome"], "topico": spec.get("topico"),
                            "so_leitura": bool(spec.get("so_leitura"))})
                exige("MANAGE_CHANNELS", "servidor")
                exige("MANAGE_ROLES", "servidor")
                continue
            usados.add(atual["id"])
            if "VIEW_CHANNEL" not in atual["bot_pode"]:
                continue  # canal que o bot não vê: nunca é tocado
            cat_atual = atual["categoria_id"]
            cat_alvo = destino_cat.get(chave(cat["nome"])) if cat["nome"] else None
            if cat["nome"] and (cat_alvo is None or cat_alvo != cat_atual) or (not cat["nome"] and cat_atual):
                ops.append({"op": "mover", "canal": atual["nome"], "id": atual["id"], "categoria": cat["nome"],
                            "sincronizar": bool(spec.get("sincronizar"))})
                exige("MANAGE_CHANNELS", f"#{atual['nome']}", atual)
            if spec.get("tipo") and spec["tipo"] != atual["tipo"]:
                if {spec["tipo"], atual["tipo"]} != {"texto", "anuncio"}:
                    raise ErroPlano(f"#{atual['nome']}: só dá para trocar entre texto e anúncio (pedido {atual['tipo']} → {spec['tipo']})")
                if spec["tipo"] == "anuncio" and "NEWS" not in foto["servidor"]["recursos"]:
                    raise ErroPlano("canal de anúncio exige o recurso NEWS (servidor Community)")
                ops.append({"op": "mudar_tipo", "canal": atual["nome"], "id": atual["id"], "para": spec["tipo"]})
                exige("MANAGE_CHANNELS", f"#{atual['nome']}", atual)
            if "topico" in spec and (spec["topico"] or "") != atual.get("topico", ""):
                ops.append({"op": "mudar_topico", "canal": atual["nome"], "id": atual["id"], "topico": spec["topico"]})
                exige("MANAGE_CHANNELS", f"#{atual['nome']}", atual)
            if spec.get("so_leitura") and not _e_so_leitura(atual, foto["servidor"]["id"]):
                ops.append({"op": "so_leitura", "canal": atual["nome"], "id": atual["id"]})
                exige("MANAGE_ROLES", f"#{atual['nome']}", atual)
        if cat["nome"] and len(nomes_ordem) > 1:
            ordem_cat.append((cat["nome"], nomes_ordem))

    k_arq = chave(alvo["arquivo"])
    if k_arq not in destino_cat:
        existente = unico(cats, alvo["arquivo"], "categoria")
        destino_cat[k_arq] = existente["id"] if existente else None
    criar_arquivo = k_arq not in {chave(o["nome"]) for o in ops if o["op"] == "criar_categoria"} and not destino_cat[k_arq]
    for c in foto["canais"]:
        if c["tipo"] == "categoria" or c["id"] in usados or "VIEW_CHANNEL" not in c["bot_pode"]:
            continue
        id_arquivo = destino_cat.get(k_arq)
        if id_arquivo and c["categoria_id"] == id_arquivo:
            continue
        if criar_arquivo:
            ops.append({"op": "criar_categoria", "nome": alvo["arquivo"], "privado": True})
            exige("MANAGE_CHANNELS", "servidor")
            exige("MANAGE_ROLES", "servidor")
            criar_arquivo = False
        ops.append({"op": "mover", "canal": c["nome"], "id": c["id"], "categoria": alvo["arquivo"],
                    "sincronizar": False, "motivo": "fora do alvo"})
        exige("MANAGE_CHANNELS", f"#{c['nome']}", c)

    # ordem dentro de cada categoria: só quando muda algo (canal novo, movido ou fora de ordem)
    atual_por_cat = {}
    for c in foto["canais"]:
        if c["tipo"] != "categoria" and c["categoria_id"]:
            atual_por_cat.setdefault(c["categoria_id"], []).append(chave(c["nome"]))
    for nome_cat, nomes in ordem_cat:
        cid = destino_cat.get(chave(nome_cat))
        if [chave(n) for n in nomes] != atual_por_cat.get(cid, []):
            ops.append({"op": "ordenar", "categoria": nome_cat, "canais": nomes})
    return {"operacoes": ops, "avisos": sorted(set(avisos))}


def descrever(op):
    """Uma linha em português para a operação."""
    o = op["op"]
    if o == "criar_categoria":
        return f"criar categoria '{op['nome']}'" + (" (privada)" if op["privado"] else "")
    if o == "criar_canal":
        extra = " só leitura" if op["so_leitura"] else ""
        return f"criar canal #{op['nome']} ({op['tipo']}{extra}) em '{op['categoria']}'"
    if o == "mover":
        return (f"mover #{op['canal']} para '{op['categoria']}'" + (" (sincronizar permissões)" if op["sincronizar"] else "")
                + (f" — {op['motivo']}" if op.get("motivo") else ""))
    if o == "mudar_tipo":
        return f"#{op['canal']} vira {op['para']}"
    if o == "mudar_topico":
        return f"tópico de #{op['canal']}: {op['topico']!r}"
    if o == "so_leitura":
        return f"#{op['canal']} fica só leitura (membros não postam; o bot posta)"
    if o == "ordenar":
        return f"ordenar '{op['categoria']}': " + ", ".join(op["canais"])
    return json.dumps(op, ensure_ascii=False)


class Aplicador:
    """Executa operações em ordem, para na 1ª falha e registra cada uma (JSONL + #registro-do-alic3)."""

    def __init__(self, api, foto, diario, agora=None, canal_registro="registro-do-alic3"):
        self.api, self.foto, self.diario = api, foto, diario
        self.sid, self.bot = foto["servidor"]["id"], foto["bot"]["id"]
        self.agora = agora or (lambda: datetime.datetime.now().isoformat(timespec="seconds"))
        self.chave_registro = chave(canal_registro)
        self.ids = {chave(c["nome"]): c for c in foto["canais"]}
        self.registro_id = next((c["id"] for c in foto["canais"] if chave(c["nome"]) == self.chave_registro), None)

    def _cat_id(self, nome):
        c = self.ids.get(chave(nome))
        return c["id"] if c else None

    def _overwrites_categoria(self, nome_cat):
        c = self.ids.get(chave(nome_cat)) if nome_cat else None
        return _overwrites_api(c) if c and c.get("overwrites") is not None else []

    def _com_bot(self, ows):
        ows = [o for o in ows if o["id"] != self.bot]
        return ows + [{"id": self.bot, "type": 1, "allow": str(BOT_PERMITE), "deny": "0"}]

    def executar(self, op):
        o, g = op["op"], self.sid
        if o == "criar_categoria":
            ows = []
            if op["privado"]:
                ows = self._com_bot([{"id": g, "type": 0, "allow": "0", "deny": str(permissoes.BIT["VIEW_CHANNEL"])}])
            r = self.api.post(f"/guilds/{g}/channels", {"name": op["nome"], "type": 4, "permission_overwrites": ows})
            self.ids[chave(op["nome"])] = {"id": r["id"], "nome": op["nome"], "overwrites": [
                {"id": x["id"], "tipo": "cargo" if x["type"] == 0 else "membro",
                 "permite": permissoes.nomes(x["allow"]), "nega": permissoes.nomes(x["deny"])} for x in ows]}
            return r["id"]
        if o == "criar_canal":
            ows = self._overwrites_categoria(op["categoria"])
            if op["so_leitura"]:
                todos = next((x for x in ows if x["id"] == g), None)
                if todos:
                    todos["deny"] = str(int(todos["deny"]) | SO_LEITURA_NEGA)
                else:
                    ows.append({"id": g, "type": 0, "allow": "0", "deny": str(SO_LEITURA_NEGA)})
            corpo = {"name": op["nome"], "type": TIPO_N[op["tipo"]], "permission_overwrites": self._com_bot(ows)}
            if op["categoria"]:
                corpo["parent_id"] = self._cat_id(op["categoria"])
            if op.get("topico"):
                corpo["topic"] = op["topico"]
            r = self.api.post(f"/guilds/{g}/channels", corpo)
            self.ids[chave(op["nome"])] = {"id": r["id"], "nome": op["nome"], "overwrites": []}
            if chave(op["nome"]) == self.chave_registro:
                self.registro_id = r["id"]
            return r["id"]
        if o == "mover":
            item = {"id": op["id"], "parent_id": self._cat_id(op["categoria"]) if op["categoria"] else None}
            if op["sincronizar"]:
                item["lock_permissions"] = True
            self.api.patch(f"/guilds/{g}/channels", [item])
            return op["id"]
        if o == "mudar_tipo":
            self.api.patch(f"/channels/{op['id']}", {"type": TIPO_N[op["para"]]})
            return op["id"]
        if o == "mudar_topico":
            self.api.patch(f"/channels/{op['id']}", {"topic": op["topico"] or ""})
            return op["id"]
        if o == "so_leitura":
            atual = next((c for c in self.foto["canais"] if c["id"] == op["id"]), {"overwrites": []})
            todos = next((x for x in _overwrites_api(atual) if x["id"] == g), {"allow": "0", "deny": "0"})
            self.api.put(f"/channels/{op['id']}/permissions/{g}",
                         {"type": 0, "allow": todos["allow"], "deny": str(int(todos["deny"]) | SO_LEITURA_NEGA)})
            self.api.put(f"/channels/{op['id']}/permissions/{self.bot}", {"type": 1, "allow": str(BOT_PERMITE), "deny": "0"})
            return op["id"]
        if o == "ordenar":
            cid = self._cat_id(op["categoria"])
            todos = self.api.get(f"/guilds/{g}/channels")
            por_chave = {chave(c["name"]): c for c in todos if c.get("parent_id") == cid}
            filhos = [por_chave[chave(n)] for n in op["canais"] if chave(n) in por_chave]
            base = min((c.get("position", 0) for c in filhos), default=0)
            self.api.patch(f"/guilds/{g}/channels", [{"id": c["id"], "position": base + i} for i, c in enumerate(filhos)])
            return cid
        raise ErroPlano(f"operação desconhecida: {o}")

    def _registrar(self, linha):
        with open(self.diario, "a", encoding="utf-8") as f:
            f.write(json.dumps(linha, ensure_ascii=False) + "\n")
        if self.registro_id:
            texto = ("✅ " if linha["resultado"] == "ok" else "❌ ") + linha["descricao"]
            if linha.get("erro"):
                texto += f" — {linha['erro']}"
            try:
                self.api.post(f"/channels/{self.registro_id}/messages",
                              {"content": texto[:1900], "flags": SILENCIOSA, "allowed_mentions": {"parse": []}})
            except ErroDiscord as e:  # o registro no Discord não derruba a aplicação; o JSONL já tem a linha
                with open(self.diario, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"data": self.agora(), "aviso": f"registro no Discord falhou: {e}"},
                                       ensure_ascii=False) + "\n")

    def aplicar(self, ops):
        """Executa em ordem. Devolve (feitas, erro ou None)."""
        feitas = 0
        for op in ops:
            linha = {"data": self.agora(), "op": op["op"], "descricao": descrever(op)}
            try:
                self.executar(op)
            except ErroDiscord as e:
                linha.update(resultado="erro", erro=str(e))
                self._registrar(linha)
                return feitas, e
            linha["resultado"] = "ok"
            self._registrar(linha)
            feitas += 1
        return feitas, None
