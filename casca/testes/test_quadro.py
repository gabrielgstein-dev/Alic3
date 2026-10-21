import io
import json
import tempfile
import unittest
from pathlib import Path

from casca import quadro
from casca.cli import main
from casca.discord_api import Discord
from casca.testes import fixtures as fx
from casca.testes.simulador import Simulador

DOURADO = Path(__file__).with_name("dourado_quadro.json")
ESTADOS = ["Em dia", "Autor atualizou depois", "Talvez (sem arquivo para conferir)", "Sem data para comparar"]


def acervo_teste():
    """45 mods de 9 autores; 26 publicados (os de índice par até 50, menos alguns), estados e versões variados."""
    mods = []
    for i in range(45):
        autor = f"Autor{chr(65 + i % 9)}"
        publicado = i < 26
        mods.append({
            "mod": f"{autor}/Mod{i:02d}", "autor": autor, "nome": f"Mod Número {i:02d}",
            "situacao": "Publicado" if publicado else "Não traduzido",
            "versao_traduzida": ["1.2.3", "sem-versao", "sem-versao-2026-05-15", "2025-08-22", ""][i % 5],
            "data_traducao": f"2026-0{1 + i % 9}-1{i % 10}" if publicado else "",
            "estado": ESTADOS[i % 4], "publicacao_url": f"https://www.curseforge.com/sims4/translations/mod-{i}" if publicado else "",
        })
    return mods


def api(sim):
    return Discord("TESTE.TOKEN.X", transporte=sim, dormir=lambda s: None)


class TestRender(unittest.TestCase):
    def test_uma_linha_por_publicado(self):
        msgs = quadro.renderizar(acervo_teste(), "2026-10-21")
        linhas = [ln for m in msgs for e in m["embeds"][0:] if e["title"] != "Status das traduções D3zessete"
                  for ln in e["description"].split("\n")]
        self.assertEqual(len(linhas), sum(1 for m in acervo_teste() if m["publicacao_url"]))
        self.assertEqual(len(linhas), 26)

    def test_icones_versao_e_data(self):
        m = {"nome": "X", "publicacao_url": "https://u", "estado": "Autor atualizou depois",
             "versao_traduzida": "sem-versao-2026-05-15", "data_traducao": "2026-10-21"}
        self.assertEqual(quadro.linha(m), "🟡 [X](https://u) · traduzido em 21/10/2026")
        m.update(estado="Em dia", versao_traduzida="5.9.3")
        self.assertEqual(quadro.linha(m), "✅ [X](https://u) · versão 5.9.3 · traduzido em 21/10/2026")
        m.update(estado="Talvez (sem arquivo para conferir)")
        self.assertTrue(quadro.linha(m).startswith("⚪ "))

    def test_cabecalho_conta_e_legenda(self):
        msgs = quadro.renderizar(acervo_teste(), "2026-10-21")
        cab = msgs[0]["embeds"][0]["description"]
        self.assertIn("Atualizado em 21/10/2026 · 26 traduções publicadas: 7 ✅ · 7 🟡 · 12 ⚪", cab)
        self.assertEqual(msgs[-1]["embeds"][-1]["footer"]["text"], quadro.LEGENDA)

    def test_limites_do_discord(self):
        grande = [dict(m, nome=m["nome"] * 12, publicacao_url=m["publicacao_url"] or "https://x/" + "a" * 80,
                       autor="UmSo") for m in acervo_teste()]
        for msgs in (quadro.renderizar(acervo_teste(), "2026-10-21"), quadro.renderizar(grande, "2026-10-21")):
            for m in msgs:
                self.assertLessEqual(len(m["embeds"]), quadro.LIM_EMBEDS)
                self.assertLessEqual(sum(quadro._tamanho(e) for e in m["embeds"]), quadro.LIM_MSG)
                for e in m["embeds"]:
                    self.assertLessEqual(len(e["description"]), quadro.LIM_DESC)
        self.assertGreater(len(quadro.renderizar(grande, "2026-10-21")), 1)

    def test_dourado(self):
        msgs = quadro.renderizar(acervo_teste(), "2026-10-21")
        if not DOURADO.exists():  # 1ª geração: gravar e revisar à mão
            DOURADO.write_text(json.dumps(msgs, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        self.assertEqual(msgs, json.loads(DOURADO.read_text(encoding="utf-8")))
        self.assertEqual(msgs, quadro.renderizar(acervo_teste(), "2026-10-21"))


def canal_simulado(mensagens_existentes):
    sim = Simulador()
    sim.responder("GET", r"/channels/700/messages\?limit=100", 200, mensagens_existentes)
    sim.responder("PATCH", r"/channels/700/messages/\d+", 200, {})
    sim.responder("POST", r"/channels/700/messages", 200, {"id": "999"})
    return sim


def msg_discord(mid, autor, embeds=None, content=""):
    """Como o Discord devolve: embeds com campos extras (type) que o quadro ignora."""
    return {"id": mid, "author": {"id": autor}, "content": content,
            "embeds": [dict(e, type="rich") for e in (embeds or [])]}


class TestSincronizar(unittest.TestCase):
    def test_segunda_rodada_sem_mudanca_zero_escritas(self):
        msgs = quadro.renderizar(acervo_teste(), "2026-10-21")
        existentes = [msg_discord(str(100 + i), fx.BOT, m["embeds"]) for i, m in enumerate(msgs)]
        sim = canal_simulado(list(reversed(existentes)))  # API devolve do mais novo para o mais velho
        r = quadro.sincronizar(api(sim), "700", fx.BOT, msgs)
        self.assertEqual(sim.escritas(), [])
        self.assertEqual(r["iguais"], len(msgs))

    def test_primeira_rodada_posta_silenciosa(self):
        msgs = quadro.renderizar(acervo_teste(), "2026-10-21")
        sim = canal_simulado([])
        quadro.sincronizar(api(sim), "700", fx.BOT, msgs)
        posts = sim.escritas()
        self.assertEqual(len(posts), len(msgs))
        self.assertTrue(all(p[2]["flags"] == quadro.SILENCIOSA and p[2]["allowed_mentions"] == {"parse": []} for p in posts))

    def test_quadro_encolheu_esvazia_a_sobra(self):
        um = [{"embeds": [{"title": "Status das traduções D3zessete", "color": quadro.COR, "description": "a"}]},
              {"embeds": [{"title": "B", "color": quadro.COR, "description": "b"}]}]
        tres = um + [{"embeds": [{"title": "C", "color": quadro.COR, "description": "c"}]}]
        existentes = [msg_discord(str(100 + i), fx.BOT, m["embeds"]) for i, m in enumerate(tres)]
        sim = canal_simulado(existentes)
        r = quadro.sincronizar(api(sim), "700", fx.BOT, um)
        self.assertEqual((r["iguais"], r["esvaziadas"]), (2, 1))
        self.assertEqual(sim.escritas()[0][1], "/channels/700/messages/102")
        self.assertEqual(sim.escritas()[0][2], {"content": "—", "embeds": []})
        self.assertFalse([c for c in sim.chamadas if c[0] == "DELETE"])

    def test_nao_toca_mensagem_de_outros_nem_registro_do_bot(self):
        msgs = [{"embeds": [{"title": "Status das traduções D3zessete", "color": quadro.COR, "description": "novo"}]}]
        existentes = [msg_discord("100", "outra-pessoa", [{"title": "x", "color": quadro.COR, "description": "y"}]),
                      msg_discord("101", fx.BOT, content="✅ criar canal #x"),  # registro do bot (texto)
                      msg_discord("102", fx.BOT, [{"title": "Status das traduções D3zessete", "color": quadro.COR,
                                                    "description": "velho"}])]
        sim = canal_simulado(existentes)
        r = quadro.sincronizar(api(sim), "700", fx.BOT, msgs)
        self.assertEqual(r["editadas"], 1)
        self.assertEqual([c[1] for c in sim.escritas()], ["/channels/700/messages/102"])


class TestAvisoEDiario(unittest.TestCase):
    def rodar(self, argv, sim, acervo):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "acervo.json"
            p.write_text(json.dumps(acervo), encoding="utf-8")
            saida, erro = io.StringIO(), io.StringIO()
            env = {"DISCORD_TOKEN": "A.B.C", "CASCA_SERVIDOR": fx.SERVIDOR, "CASCA_ACERVO": str(p)}
            c = main(argv, env=env, transporte=sim, saida=saida, erro=erro, caminho_env=Path("/nao/existe"),
                     dormir=lambda s: None)
        return c, saida.getvalue(), erro.getvalue()

    def sim_com_canais(self):
        sim = Simulador()
        sim.responder("GET", f"/guilds/{fx.SERVIDOR}/channels", 200, [
            {"id": "800", "name": "novidades-quentes", "type": 5},
            {"id": "801", "name": "📅┃diário-do-tradutor", "type": 0}])
        sim.responder("POST", r"/channels/80\d/messages", 200, {"id": "55"})
        sim.responder("POST", r"/channels/800/messages/55/crosspost", 200, {})
        return sim

    def test_aviso_silencioso_sem_ping_e_publicado(self):
        sim = self.sim_com_canais()
        c, saida, _ = self.rodar(["aviso", "--mod", "AutorA/Mod00"], sim, acervo_teste())
        self.assertEqual(c, 0)
        post, cross = sim.escritas()
        self.assertEqual(post[2]["flags"], quadro.SILENCIOSA)
        self.assertEqual(post[2]["allowed_mentions"], {"parse": []})
        self.assertTrue(post[2]["content"].startswith("Tradução atualizada: Mod Número 00 (AutorA) — versão 1.2.3 — https://"))
        self.assertEqual(cross[1], "/channels/800/messages/55/crosspost")

    def test_diario_em_canal_de_texto_nao_publica(self):
        sim = self.sim_com_canais()
        c, _, _ = self.rodar(["diario", "Começamos", "a", "traduzir", "o", "Mod", "X."], sim, acervo_teste())
        self.assertEqual(c, 0)
        self.assertEqual(len(sim.escritas()), 1)
        self.assertEqual(sim.escritas()[0][2]["content"], "Começamos a traduzir o Mod X.")

    def test_mod_inexistente_sai_com_2(self):
        c, _, erro = self.rodar(["aviso", "--mod", "Ninguem/Nada"], self.sim_com_canais(), acervo_teste())
        self.assertEqual(c, 2)
        self.assertIn("não encontrado", erro)


if __name__ == "__main__":
    unittest.main()
