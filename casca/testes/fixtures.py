"""Servidor de mentira para os testes (ids de 18 dígitos inventados)."""
from casca.permissoes import BIT
from casca.testes.simulador import Simulador

SERVIDOR = "100000000000000001"
BOT = "200000000000000002"
DONO = "300000000000000003"
CARGO_BOT = "400000000000000004"
CARGO_STAFF = "400000000000000005"


def perm(*nomes):
    return str(sum(BIT[n] for n in nomes))


def servidor_simulado(canais=None, recursos=("COMMUNITY",), bot_perms=None):
    """Simulador com /users/@me, /guilds/{id}, canais e o membro bot."""
    sim = Simulador()
    sim.responder("GET", "/users/@me", 200, {"id": BOT, "username": "Alic3"})
    sim.responder("GET", f"/guilds/{SERVIDOR}", 200, {
        "id": SERVIDOR, "name": "Servidor Teste", "owner_id": DONO, "features": list(recursos),
        "rules_channel_id": "500000000000000010", "public_updates_channel_id": None, "system_channel_id": None,
        "verification_level": 1, "explicit_content_filter": 2,
        "roles": [
            {"id": SERVIDOR, "name": "@everyone", "position": 0, "permissions": perm("VIEW_CHANNEL", "SEND_MESSAGES")},
            {"id": CARGO_BOT, "name": "Alic3", "position": 2, "managed": True,
             "permissions": bot_perms or perm("MANAGE_CHANNELS", "MANAGE_ROLES", "EMBED_LINKS", "READ_MESSAGE_HISTORY")},
            {"id": CARGO_STAFF, "name": "Staff", "position": 3, "hoist": True, "permissions": perm("MANAGE_MESSAGES")},
        ],
    })
    sim.responder("GET", f"/guilds/{SERVIDOR}/channels", 200, canais if canais is not None else CANAIS)
    sim.responder("GET", f"/guilds/{SERVIDOR}/members/{BOT}", 200, {"roles": [CARGO_BOT], "user": {"id": BOT}})
    return sim


CANAIS = [
    {"id": "500000000000000020", "name": "INFORMAÇÕES", "type": 4, "position": 0, "permission_overwrites": []},
    {"id": "500000000000000010", "name": "regras", "type": 0, "position": 0, "parent_id": "500000000000000020",
     "topic": "Leia antes", "last_message_id": "999", "permission_overwrites": [
         {"id": SERVIDOR, "type": 0, "allow": "0", "deny": perm("SEND_MESSAGES")}]},
    {"id": "500000000000000030", "name": "geral", "type": 0, "position": 1, "parent_id": None, "topic": None,
     "permission_overwrites": []},
    {"id": "500000000000000040", "name": "staff", "type": 0, "position": 1, "parent_id": "500000000000000020",
     "permission_overwrites": [
         {"id": SERVIDOR, "type": 0, "allow": "0", "deny": perm("VIEW_CHANNEL")},
         {"id": CARGO_STAFF, "type": 0, "allow": perm("VIEW_CHANNEL"), "deny": "0"}]},
    {"id": "500000000000000050", "name": "suporte", "type": 15, "position": 2, "parent_id": "500000000000000020",
     "available_tags": [{"id": "1", "name": "Resolvido"}, {"id": "2", "name": "Não aparece"}],
     "permission_overwrites": []},
]
