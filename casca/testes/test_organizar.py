import copy
import datetime
import io
import json
import tempfile
import unittest
from pathlib import Path

from casca import estrutura, organizar
from casca.cli import main
from casca.discord_api import Discord
from casca.testes import fixtures as fx

T0 = datetime.datetime(2026, 10, 21, 12, 0, 0)


def api(sim):
    return Discord("TESTE.TOKEN.X", transporte=sim, dormir=lambda s: None)


def foto(canais=None, **kw):
    return estrutura.tirar_foto(api(fx.servidor_simulado(canais=canais, **kw)), fx.SERVIDOR, T0)


def alvo_igual():
    return {"servidor": fx.SERVIDOR, "arquivo": "Arquivo",
            "categorias": [{"nome": "INFORMAÇÕES", "canais": [{"nome": "regras"}, {"nome": "staff"}, {"nome": "suporte"}]}],
            "sem_categoria": [{"nome": "geral"}]}


class TestPlano(unittest.TestCase):
    def test_alvo_igual_zero_operacoes(self):
        p = organizar.planejar(foto(), alvo_igual())
        self.assertEqual(p["operacoes"], [])

    def test_casamento_ignora_emoji_e_acento(self):
        self.assertEqual(organizar.chave("📅┃diário-do-tradutor"), "diario-do-tradutor")
        self.assertEqual(organizar.chave("📢 ┃ BOLETIM D3ZESSETE"), "boletim-d3zessete")

    def test_canal_novo_de_anuncio(self):
        alvo = alvo_igual()
        alvo["categorias"][0]["canais"].insert(0, {"nome": "novidades", "tipo": "anuncio", "so_leitura": True})
        ops = organizar.planejar(foto(), alvo)["operacoes"]
        self.assertEqual(ops[0], {"op": "criar_canal", "nome": "novidades", "tipo": "anuncio", "categoria": "INFORMAÇÕES",
                                  "topico": None, "so_leitura": True})
        self.assertEqual(ops[-1]["op"], "ordenar")

    def test_canal_sobrando_vai_para_arquivo_sem_delete(self):
        alvo = alvo_igual()
        alvo["sem_categoria"] = []
        ops = organizar.planejar(foto(), alvo)["operacoes"]
        self.assertEqual([o["op"] for o in ops], ["criar_categoria", "mover"])
        self.assertEqual(ops[0], {"op": "criar_categoria", "nome": "Arquivo", "privado": True})
        self.assertEqual((ops[1]["canal"], ops[1]["categoria"], ops[1]["motivo"]), ("geral", "Arquivo", "fora do alvo"))

    def test_canal_que_o_bot_nao_ve_nunca_e_tocado(self):
        alvo = alvo_igual()
        alvo["categorias"][0]["canais"] = [{"nome": "regras"}, {"nome": "suporte"}]  # 'staff' fora do alvo
        ops = organizar.planejar(foto(), alvo)["operacoes"]
        self.assertFalse([o for o in ops if o.get("canal") == "staff"])

    def test_nome_ambiguo_para(self):
        canais = copy.deepcopy(fx.CANAIS) + [dict(fx.CANAIS[2], id="500000000000000099", name="💬geral")]
        with self.assertRaises(organizar.ErroPlano) as c:
            organizar.planejar(foto(canais), alvo_igual())
        self.assertIn("ambíguo", str(c.exception))

    def test_texto_vira_anuncio_e_forum_nao(self):
        alvo = alvo_igual()
        alvo["sem_categoria"] = [{"nome": "geral", "tipo": "anuncio"}]
        ops = organizar.planejar(foto(recursos=("COMMUNITY", "NEWS")), alvo)["operacoes"]
        self.assertEqual(ops, [{"op": "mudar_tipo", "canal": "geral", "id": "500000000000000030", "para": "anuncio"}])
        alvo["categorias"][0]["canais"][2]["tipo"] = "texto"  # suporte é fórum
        with self.assertRaises(organizar.ErroPlano):
            organizar.planejar(foto(recursos=("COMMUNITY", "NEWS")), alvo)

    def test_anuncio_sem_news_para(self):
        alvo = alvo_igual()
        alvo["sem_categoria"] = [{"nome": "geral", "tipo": "anuncio"}]
        with self.assertRaises(organizar.ErroPlano):
            organizar.planejar(foto(recursos=("COMMUNITY",)), alvo)

    def test_aviso_de_permissao_que_falta(self):
        alvo = alvo_igual()
        alvo["sem_categoria"] = [{"nome": "geral", "so_leitura": True}]
        p = organizar.planejar(foto(bot_perms=fx.perm("MANAGE_CHANNELS")), alvo)
        self.assertEqual(p["operacoes"][0]["op"], "so_leitura")
        self.assertIn("falta MANAGE_ROLES ao bot em #geral", p["avisos"])

    def test_regras_ja_so_leitura_nao_gera_operacao(self):
        alvo = alvo_igual()
        alvo["categorias"][0]["canais"][0]["so_leitura"] = True
        self.assertEqual(organizar.planejar(foto(), alvo)["operacoes"], [])


class TestAplicar(unittest.TestCase):
    def preparar(self, sim, ops_alvo):
        f = estrutura.tirar_foto(api(sim), fx.SERVIDOR, T0)
        return f, organizar.planejar(f, ops_alvo)["operacoes"]

    def test_falha_na_segunda_de_tres_para_e_registra(self):
        sim = fx.servidor_simulado(recursos=("COMMUNITY", "NEWS"))
        alvo = alvo_igual()
        alvo["sem_categoria"] = [{"nome": "geral", "tipo": "anuncio", "topico": "novo", "so_leitura": True}]
        f, ops = self.preparar(sim, alvo)
        self.assertEqual([o["op"] for o in ops], ["mudar_tipo", "mudar_topico", "so_leitura"])
        sim.responder("PATCH", r"/channels/\d+", 200, {})
        sim.responder("PATCH", r"/channels/\d+", 403, {"message": "Missing Permissions", "code": 50013})
        with tempfile.TemporaryDirectory() as d:
            diario = Path(d) / "registro.jsonl"
            feitas, erro = organizar.Aplicador(api(sim), f, diario).aplicar(ops)
            linhas = [json.loads(x) for x in diario.read_text(encoding="utf-8").splitlines()]
        self.assertEqual(feitas, 1)
        self.assertEqual(erro.status, 403)
        self.assertEqual([x["resultado"] for x in linhas], ["ok", "erro"])
        self.assertIn("não tem permissão", linhas[1]["erro"])
        self.assertFalse([c for c in sim.escritas() if c[0] == "PUT"])  # a 3ª não rodou
        self.assertFalse([c for c in sim.chamadas if c[0] == "DELETE"])

    def test_corpos_das_operacoes(self):
        sim = fx.servidor_simulado(recursos=("COMMUNITY", "NEWS"))
        alvo = alvo_igual()
        alvo["categorias"][0]["canais"].insert(0, {"nome": "status", "so_leitura": True, "topico": "Quadro"})
        alvo["sem_categoria"] = []
        f, ops = self.preparar(sim, alvo)
        sim.responder("POST", f"/guilds/{fx.SERVIDOR}/channels", 200, {"id": "600000000000000001"})
        sim.responder("POST", f"/guilds/{fx.SERVIDOR}/channels", 200, {"id": "600000000000000002"})
        sim.responder("PATCH", f"/guilds/{fx.SERVIDOR}/channels", 204)
        with tempfile.TemporaryDirectory() as d:
            feitas, erro = organizar.Aplicador(api(sim), f, Path(d) / "r.jsonl").aplicar(ops)
        self.assertIsNone(erro)
        criar = [c for c in sim.escritas() if c[0] == "POST"]
        status = next(c[2] for c in criar if c[2]["name"] == "status")
        todos = next(o for o in status["permission_overwrites"] if o["id"] == fx.SERVIDOR)
        self.assertTrue(int(todos["deny"]) & organizar.permissoes.BIT["SEND_MESSAGES"])
        bot = next(o for o in status["permission_overwrites"] if o["id"] == fx.BOT)
        self.assertTrue(int(bot["allow"]) & organizar.permissoes.BIT["SEND_MESSAGES"])
        self.assertEqual(status["parent_id"], "500000000000000020")
        arquivo = next(c[2] for c in criar if c[2]["name"] == "Arquivo")
        self.assertEqual(arquivo["type"], 4)
        mover = [c for c in sim.escritas() if c[0] == "PATCH" and c[2] and "parent_id" in c[2][0]]
        self.assertEqual(mover[0][2], [{"id": "500000000000000030", "parent_id": "600000000000000002"}])

    def test_registro_no_discord_quando_o_canal_existe(self):
        canais = copy.deepcopy(fx.CANAIS) + [{"id": "500000000000000077", "name": "🤖registro-do-alic3", "type": 0,
                                               "position": 3, "parent_id": None, "permission_overwrites": []}]
        sim = fx.servidor_simulado(canais=canais)
        alvo = alvo_igual()
        alvo["sem_categoria"] = [{"nome": "geral", "topico": "oi"}, {"nome": "registro-do-alic3"}]
        f, ops = self.preparar(sim, alvo)
        sim.responder("PATCH", r"/channels/\d+", 200, {})
        sim.responder("POST", r"/channels/500000000000000077/messages", 200, {"id": "1"})
        with tempfile.TemporaryDirectory() as d:
            organizar.Aplicador(api(sim), f, Path(d) / "r.jsonl").aplicar(ops)
        msg = [c for c in sim.escritas() if c[1].endswith("/messages")]
        self.assertEqual(len(msg), 1)
        self.assertEqual(msg[0][2]["flags"], organizar.SILENCIOSA)
        self.assertEqual(msg[0][2]["allowed_mentions"], {"parse": []})
        self.assertIn("tópico de #geral", msg[0][2]["content"])


class TestCliOrganizar(unittest.TestCase):
    def rodar(self, argv, env, sim):
        saida, erro = io.StringIO(), io.StringIO()
        c = main(argv, env=env, transporte=sim, saida=saida, erro=erro, caminho_env=Path("/nao/existe"),
                 dormir=lambda s: None)
        return c, saida.getvalue(), erro.getvalue()

    def test_ensaio_nao_escreve(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "alvo.json"
            alvo = alvo_igual()
            alvo["sem_categoria"] = []
            p.write_text(json.dumps(alvo), encoding="utf-8")
            sim = fx.servidor_simulado()
            c, saida, _ = self.rodar(["aplicar", "--alvo", str(p), "--ensaio"],
                                     {"DISCORD_TOKEN": "A.B.C", "CASCA_SERVIDOR": fx.SERVIDOR}, sim)
        self.assertEqual(c, 0)
        self.assertIn("mover #geral para 'Arquivo'", saida)
        self.assertEqual(sim.escritas(), [])

    def test_servidor_errado_sai_com_2_sem_escrever(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "alvo.json"
            alvo = alvo_igual()
            alvo["servidor"] = "999999999999999999"
            p.write_text(json.dumps(alvo), encoding="utf-8")
            sim = fx.servidor_simulado()
            env = {"DISCORD_TOKEN": "A.B.C", "CASCA_SERVIDOR": fx.SERVIDOR, "CASCA_FOTOS": d,
                   "CASCA_REGISTRO": str(Path(d) / "r.jsonl")}
            c, _, erro = self.rodar(["aplicar", "--alvo", str(p)], env, sim)
        self.assertEqual(c, 2)
        self.assertIn("nada foi feito", erro)
        self.assertEqual(sim.chamadas, [])

    def test_aplicar_para_se_falta_permissao(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "alvo.json"
            alvo = alvo_igual()
            alvo["sem_categoria"] = [{"nome": "geral", "so_leitura": True}]
            p.write_text(json.dumps(alvo), encoding="utf-8")
            sim = fx.servidor_simulado(bot_perms=fx.perm("MANAGE_CHANNELS"))
            env = {"DISCORD_TOKEN": "A.B.C", "CASCA_SERVIDOR": fx.SERVIDOR, "CASCA_FOTOS": d,
                   "CASCA_REGISTRO": str(Path(d) / "r.jsonl")}
            c, saida, _ = self.rodar(["aplicar", "--alvo", str(p)], env, sim)
        self.assertEqual(c, 1)
        self.assertIn("Parado", saida)
        self.assertEqual(sim.escritas(), [])


if __name__ == "__main__":
    unittest.main()


class TestRegressaoVozTextoMesmoNome(unittest.TestCase):
    """Bug 2026-10-21 (alvo real): voz 'Geral' e texto 'geral' tinham a mesma chave e o alvo era recusado."""

    def test_voz_e_texto_com_mesmo_nome_casam_pelo_tipo(self):
        canais = copy.deepcopy(fx.CANAIS) + [{"id": "500000000000000088", "name": "Geral", "type": 2, "position": 0,
                                               "parent_id": None, "permission_overwrites": []}]
        alvo = alvo_igual()
        alvo["sem_categoria"] = [{"nome": "Geral", "tipo": "voz"}, {"nome": "geral", "tipo": "texto"}]
        self.assertEqual(organizar.planejar(foto(canais), alvo)["operacoes"], [])

    def test_mesmo_nome_sem_tipo_continua_ambiguo(self):
        alvo = alvo_igual()
        alvo["sem_categoria"] = [{"nome": "Geral"}, {"nome": "geral"}]
        with self.assertRaises(organizar.ErroPlano):
            organizar.planejar(foto(), alvo)
