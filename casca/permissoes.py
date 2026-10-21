"""Bits de permissão do Discord e cálculo das permissões efetivas (fórmula da documentação oficial,
docs.discord.com/developers/topics/permissions, conferida em 2026-10-21)."""

NOMES = {
    0: "CREATE_INSTANT_INVITE", 1: "KICK_MEMBERS", 2: "BAN_MEMBERS", 3: "ADMINISTRATOR", 4: "MANAGE_CHANNELS",
    5: "MANAGE_GUILD", 6: "ADD_REACTIONS", 7: "VIEW_AUDIT_LOG", 8: "PRIORITY_SPEAKER", 9: "STREAM",
    10: "VIEW_CHANNEL", 11: "SEND_MESSAGES", 12: "SEND_TTS_MESSAGES", 13: "MANAGE_MESSAGES", 14: "EMBED_LINKS",
    15: "ATTACH_FILES", 16: "READ_MESSAGE_HISTORY", 17: "MENTION_EVERYONE", 18: "USE_EXTERNAL_EMOJIS",
    19: "VIEW_GUILD_INSIGHTS", 20: "CONNECT", 21: "SPEAK", 22: "MUTE_MEMBERS", 23: "DEAFEN_MEMBERS",
    24: "MOVE_MEMBERS", 25: "USE_VAD", 26: "CHANGE_NICKNAME", 27: "MANAGE_NICKNAMES", 28: "MANAGE_ROLES",
    29: "MANAGE_WEBHOOKS", 30: "MANAGE_GUILD_EXPRESSIONS", 31: "USE_APPLICATION_COMMANDS", 32: "REQUEST_TO_SPEAK",
    33: "MANAGE_EVENTS", 34: "MANAGE_THREADS", 35: "CREATE_PUBLIC_THREADS", 36: "CREATE_PRIVATE_THREADS",
    37: "USE_EXTERNAL_STICKERS", 38: "SEND_MESSAGES_IN_THREADS", 39: "USE_EMBEDDED_ACTIVITIES",
    40: "MODERATE_MEMBERS", 41: "VIEW_CREATOR_MONETIZATION_ANALYTICS", 42: "USE_SOUNDBOARD",
    43: "CREATE_GUILD_EXPRESSIONS", 44: "CREATE_EVENTS", 45: "USE_EXTERNAL_SOUNDS", 46: "SEND_VOICE_MESSAGES",
    48: "SET_VOICE_CHANNEL_STATUS", 49: "SEND_POLLS", 50: "USE_EXTERNAL_APPS", 51: "PIN_MESSAGES",
    52: "BYPASS_SLOWMODE",
}
BIT = {nome: 1 << b for b, nome in NOMES.items()}
TODAS = sum(BIT.values())


def nomes(valor):
    """Lista ordenada de nomes dos bits ligados em `valor` (bit desconhecido vira BIT_n)."""
    valor = int(valor)
    return [NOMES.get(b, f"BIT_{b}") for b in range(64) if valor >> b & 1]


def base(servidor_id, dono_id, membro_id, cargos_membro, cargos):
    """Permissões no servidor: dono = tudo; senão @everyone | cargos do membro; ADMINISTRATOR = tudo.
    `cargos` = {id: permissões (int)}; o cargo @everyone tem o id do servidor."""
    if membro_id == dono_id:
        return TODAS
    perm = int(cargos.get(servidor_id, 0))
    for c in cargos_membro:
        perm |= int(cargos.get(c, 0))
    return TODAS if perm & BIT["ADMINISTRATOR"] else perm


def no_canal(perm_base, servidor_id, membro_id, cargos_membro, overwrites):
    """Aplica os overwrites do canal: @everyone, depois cargos (nega tudo, libera tudo), depois o membro."""
    if perm_base & BIT["ADMINISTRATOR"]:
        return TODAS
    perm = perm_base
    por_id = {o["id"]: o for o in overwrites}
    todos = por_id.get(servidor_id)
    if todos:
        perm = (perm & ~int(todos["deny"])) | int(todos["allow"])
    nega = libera = 0
    for c in cargos_membro:
        o = por_id.get(c)
        if o and o.get("type") in (0, "0", "role"):
            nega |= int(o["deny"])
            libera |= int(o["allow"])
    perm = (perm & ~nega) | libera
    m = por_id.get(membro_id)
    if m and m.get("type") in (1, "1", "member"):
        perm = (perm & ~int(m["deny"])) | int(m["allow"])
    return perm
