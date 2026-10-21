"""Foto da estrutura do servidor (só leitura): servidor, cargos, categorias, canais, overwrites e o que o bot pode."""
import datetime
import json
from pathlib import Path

from casca import permissoes

TIPOS = {0: "texto", 2: "voz", 4: "categoria", 5: "anuncio", 13: "palco", 15: "forum", 16: "midia"}


def tirar_foto(api, servidor_id, agora=None):
    """Lê o servidor pela API (só GET) e devolve a foto normalizada (dict)."""
    eu = api.get("/users/@me")
    g = api.get(f"/guilds/{servidor_id}")
    canais = api.get(f"/guilds/{servidor_id}/channels")
    membro = api.get(f"/guilds/{servidor_id}/members/{eu['id']}")

    cargos_perm = {r["id"]: int(r["permissions"]) for r in g.get("roles", [])}
    cargos_nome = {r["id"]: r["name"] for r in g.get("roles", [])}
    meus = list(membro.get("roles", []))
    perm_base = permissoes.base(g["id"], g.get("owner_id"), eu["id"], meus, cargos_perm)
    pos_cat = {c["id"]: c.get("position", 0) for c in canais if c.get("type") == 4}

    def ordem(c):
        if c.get("type") == 4:
            return (c.get("position", 0), c["id"], 0, 0, "")
        cat = c.get("parent_id")
        return (pos_cat.get(cat, -1), cat or "", 1, c.get("position", 0), c["id"])

    lista = []
    for c in sorted(canais, key=ordem):
        ows = c.get("permission_overwrites", [])
        item = {
            "id": c["id"], "nome": c.get("name"), "tipo": TIPOS.get(c.get("type"), f"tipo_{c.get('type')}"),
            "posicao": c.get("position", 0), "categoria_id": c.get("parent_id"),
            "overwrites": [{
                "id": o["id"], "tipo": "cargo" if o.get("type") in (0, "0") else "membro",
                "alvo": cargos_nome.get(o["id"], "@everyone" if o["id"] == g["id"] else o["id"]),
                "permite": permissoes.nomes(o.get("allow", 0)), "nega": permissoes.nomes(o.get("deny", 0)),
            } for o in sorted(ows, key=lambda o: o["id"])],
            "bot_pode": permissoes.nomes(permissoes.no_canal(perm_base, g["id"], eu["id"], meus, ows)),
        }
        if c.get("type") != 4:
            item["topico"] = c.get("topic") or ""
            item["nsfw"] = bool(c.get("nsfw"))
        if c.get("type") == 15:
            item["etiquetas"] = sorted(t.get("name", "") for t in c.get("available_tags", []))
        lista.append(item)

    return {
        "data": (agora or datetime.datetime.now()).isoformat(timespec="seconds"),
        "servidor": {
            "id": g["id"], "nome": g.get("name"), "dono_id": g.get("owner_id"),
            "recursos": sorted(g.get("features", [])),
            "canal_regras_id": g.get("rules_channel_id"), "canal_avisos_mod_id": g.get("public_updates_channel_id"),
            "canal_sistema_id": g.get("system_channel_id"),
            "verificacao": g.get("verification_level"), "filtro_conteudo": g.get("explicit_content_filter"),
        },
        "cargos": [{
            "id": r["id"], "nome": r["name"], "posicao": r.get("position", 0),
            "permissoes": permissoes.nomes(r.get("permissions", 0)), "gerenciado": bool(r.get("managed")),
            "separado": bool(r.get("hoist")), "mencionavel": bool(r.get("mentionable")),
        } for r in sorted(g.get("roles", []), key=lambda r: (-r.get("position", 0), r["id"]))],
        "canais": lista,
        "bot": {"id": eu["id"], "nome": eu.get("username"), "cargos": sorted(meus),
                "permissoes_servidor": permissoes.nomes(perm_base)},
    }


def gravar_foto(foto, pasta):
    """Grava a foto em `pasta/AAAA-MM-DDTHHMMSS.json` (JSON ordenado, UTF-8). Devolve o caminho."""
    pasta = Path(pasta)
    pasta.mkdir(parents=True, exist_ok=True)
    caminho = pasta / (foto["data"].replace(":", "") + ".json")
    caminho.write_text(json.dumps(foto, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    return caminho


def resumo(foto):
    """Linhas em linguagem simples sobre a foto."""
    s, canais = foto["servidor"], foto["canais"]
    por_tipo = {}
    for c in canais:
        por_tipo[c["tipo"]] = por_tipo.get(c["tipo"], 0) + 1
    cego = [c["nome"] for c in canais if "VIEW_CHANNEL" not in c["bot_pode"]]
    linhas = [
        f"Servidor: {s['nome']} (id {s['id']}) — modo Comunidade: {'sim' if 'COMMUNITY' in s['recursos'] else 'não'}",
        "Canais: " + ", ".join(f"{n} {t}" for t, n in sorted(por_tipo.items())),
        f"Cargos: {len(foto['cargos'])}",
        "Bot pode no servidor: " + (", ".join(foto["bot"]["permissoes_servidor"]) or "nada"),
    ]
    if cego:
        linhas.append(f"Canais que o bot NÃO vê ({len(cego)}): " + ", ".join(cego))
    return linhas
