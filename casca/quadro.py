"""Quadro de status das traduções (a partir do acervo.json, só leitura) e avisos silenciosos.

O quadro é um conjunto de mensagens do próprio bot num canal; rodar de novo edita só o que mudou.
"""
import json
from pathlib import Path

ICONE = {"Em dia": "✅", "Autor atualizou depois": "🟡"}
SEM_INFO = "⚪"
LEGENDA = "✅ em dia · 🟡 o mod original mudou, tradução na fila · ⚪ sem informação"
COR = 0x8E44AD
SILENCIOSA = 1 << 12
LIM_DESC, LIM_MSG, LIM_EMBEDS = 4096, 6000, 10


def carregar_acervo(caminho):
    return json.loads(Path(caminho).read_text(encoding="utf-8"))


def _data_br(iso):
    return f"{iso[8:10]}/{iso[5:7]}/{iso[:4]}" if iso and len(iso) >= 10 else ""


def linha(mod):
    """Uma linha do quadro: ícone, nome com link, versão (se houver) e data da tradução."""
    v = mod.get("versao_traduzida") or ""
    versao = "" if not v or v.startswith("sem-versao") else f" · versão {v}"
    data = _data_br(mod.get("data_traducao"))
    return f"{ICONE.get(mod.get('estado'), SEM_INFO)} [{mod['nome']}]({mod['publicacao_url']}){versao}" + (
        f" · traduzido em {data}" if data else "")


def _tamanho(embed):
    return sum(len(embed.get(k) or "") for k in ("title", "description")) + len((embed.get("footer") or {}).get("text", ""))


def renderizar(acervo, data_iso):
    """Lista de mensagens ({'embeds': [...]}) do quadro. Determinístico para o mesmo acervo e a mesma data."""
    publicados = [m for m in acervo if m.get("publicacao_url")]
    por_autor = {}
    for m in publicados:
        por_autor.setdefault(m["autor"], []).append(m)
    conta = {i: 0 for i in ("✅", "🟡", SEM_INFO)}
    for m in publicados:
        conta[ICONE.get(m.get("estado"), SEM_INFO)] += 1
    embeds = [{"title": "Status das traduções D3zessete", "color": COR, "description": (
        f"Atualizado em {_data_br(data_iso)} · {len(publicados)} traduções publicadas: "
        f"{conta['✅']} ✅ · {conta['🟡']} 🟡 · {conta[SEM_INFO]} {SEM_INFO}\n"
        "Antes de perguntar se uma tradução está em dia, confira aqui.")}]
    for autor in sorted(por_autor, key=str.lower):
        linhas = [linha(m) for m in sorted(por_autor[autor], key=lambda m: m["nome"].lower())]
        bloco, parte = [], 0
        for ln in linhas + [None]:
            if ln is None or len("\n".join(bloco + [ln])) > LIM_DESC:
                if bloco:
                    parte += 1
                    embeds.append({"title": autor if parte == 1 else f"{autor} (cont.)", "color": COR,
                                   "description": "\n".join(bloco)})
                bloco = [ln] if ln else []
            else:
                bloco.append(ln)
    embeds[-1]["footer"] = {"text": LEGENDA}
    mensagens, atual, total = [], [], 0
    for e in embeds:
        if atual and (len(atual) == LIM_EMBEDS or total + _tamanho(e) > LIM_MSG):
            mensagens.append({"embeds": atual})
            atual, total = [], 0
        atual.append(e)
        total += _tamanho(e)
    mensagens.append({"embeds": atual})
    return mensagens


def _normalizar(msg):
    """Só os campos que o quadro controla, para comparar o que está no Discord com o que deveria estar."""
    return {"content": msg.get("content") or "", "embeds": [
        {k: v for k, v in (("title", e.get("title")), ("description", e.get("description")), ("color", e.get("color")),
                           ("footer", {"text": (e.get("footer") or {}).get("text")} if e.get("footer") else None)) if v}
        for e in msg.get("embeds", [])]}


def e_do_quadro(msg, bot_id):
    """Mensagem do próprio bot com a assinatura do quadro (cor) ou já esvaziada ("—")."""
    if msg["author"]["id"] != bot_id:
        return False
    embeds = msg.get("embeds") or []
    return (bool(embeds) and embeds[0].get("color") == COR) or (not embeds and msg.get("content") == "—")


def sincronizar(api, canal_id, bot_id, mensagens):
    """Edita as mensagens do bot no canal (na ordem), posta as que faltam e esvazia as que sobram.
    Não toca mensagem de outra pessoa. Devolve {'editadas', 'postadas', 'esvaziadas', 'iguais'}."""
    existentes = [m for m in api.get(f"/channels/{canal_id}/messages?limit=100") if e_do_quadro(m, bot_id)]
    existentes.sort(key=lambda m: int(m["id"]))
    r = {"editadas": 0, "postadas": 0, "esvaziadas": 0, "iguais": 0}
    for i, desejada in enumerate(mensagens):
        alvo = _normalizar({"content": "", "embeds": desejada["embeds"]})
        if i < len(existentes):
            if _normalizar(existentes[i]) == alvo:
                r["iguais"] += 1
            else:
                api.patch(f"/channels/{canal_id}/messages/{existentes[i]['id']}", {"content": "", "embeds": desejada["embeds"]})
                r["editadas"] += 1
        else:
            api.post(f"/channels/{canal_id}/messages", {"embeds": desejada["embeds"], "flags": SILENCIOSA,
                                                        "allowed_mentions": {"parse": []}})
            r["postadas"] += 1
    for m in existentes[len(mensagens):]:
        if _normalizar(m) != {"content": "—", "embeds": []}:
            api.patch(f"/channels/{canal_id}/messages/{m['id']}", {"content": "—", "embeds": []})
            r["esvaziadas"] += 1
    return r


def texto_aviso(mod, nova=False):
    """Modelo fixo do aviso de tradução publicada."""
    v = mod.get("versao_traduzida") or ""
    versao = "" if not v or v.startswith("sem-versao") else f" — versão {v}"
    return f"{'Tradução nova' if nova else 'Tradução atualizada'}: {mod['nome']} ({mod['autor']}){versao} — {mod['publicacao_url']}"


def postar(api, canal, texto):
    """Mensagem silenciosa, sem menções. Em canal de anúncio, publica (crosspost) para quem segue."""
    if len(texto) > 2000:
        raise ValueError("texto com mais de 2000 caracteres")
    msg = api.post(f"/channels/{canal['id']}/messages", {"content": texto, "flags": SILENCIOSA,
                                                          "allowed_mentions": {"parse": []}})
    if canal.get("type") == 5:
        api.post(f"/channels/{canal['id']}/messages/{msg['id']}/crosspost")
    return msg
