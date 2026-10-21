import datetime
import io
import json
import tempfile
import unittest
from pathlib import Path

from casca import estrutura, permissoes
from casca.cli import main
from casca.discord_api import Discord
from casca.testes import fixtures as fx

T0 = datetime.datetime(2026, 10, 21, 12, 0, 0)


def api(sim):
    return Discord("TESTE.TOKEN.X", transporte=sim, dormir=lambda s: None)


class TestFoto(unittest.TestCase):
    def test_foto_so_faz_get(self):
        sim = fx.servidor_simulado()
        estrutura.tirar_foto(api(sim), fx.SERVIDOR, T0)
        self.assertTrue(sim.chamadas)
        self.assertEqual({c[0] for c in sim.chamadas}, {"GET"})

    def test_uma_entrada_por_canal_e_por_cargo(self):
        foto = estrutura.tirar_foto(api(fx.servidor_simulado()), fx.SERVIDOR, T0)
        self.assertEqual(sorted(c["id"] for c in foto["canais"]), sorted(c["id"] for c in fx.CANAIS))
        self.assertEqual(len(foto["cargos"]), 3)
        self.assertEqual(foto["cargos"][0]["nome"], "Staff")  # maior posição primeiro
        forum = next(c for c in foto["canais"] if c["tipo"] == "forum")
        self.assertEqual(forum["etiquetas"], ["Não aparece", "Resolvido"])

    def test_campos_volateis_ficam_fora(self):
        foto = estrutura.tirar_foto(api(fx.servidor_simulado()), fx.SERVIDOR, T0)
        self.assertNotIn("last_message_id", json.dumps(foto))

    def test_duas_fotos_iguais_menos_a_data(self):
        with tempfile.TemporaryDirectory() as d:
            a = estrutura.gravar_foto(estrutura.tirar_foto(api(fx.servidor_simulado()), fx.SERVIDOR, T0), Path(d) / "a")
            b = estrutura.gravar_foto(estrutura.tirar_foto(api(fx.servidor_simulado()), fx.SERVIDOR,
                                                           T0 + datetime.timedelta(minutes=5)), Path(d) / "b")
            ja, jb = json.loads(a.read_text(encoding="utf-8")), json.loads(b.read_text(encoding="utf-8"))
        self.assertNotEqual(ja["data"], jb["data"])
        ja.pop("data"), jb.pop("data")
        self.assertEqual(json.dumps(ja, sort_keys=True), json.dumps(jb, sort_keys=True))

    def test_overwrite_nega_ver_canal_da_staff(self):
        foto = estrutura.tirar_foto(api(fx.servidor_simulado()), fx.SERVIDOR, T0)
        staff = next(c for c in foto["canais"] if c["nome"] == "staff")
        geral = next(c for c in foto["canais"] if c["nome"] == "geral")
        self.assertNotIn("VIEW_CHANNEL", staff["bot_pode"])
        self.assertIn("VIEW_CHANNEL", geral["bot_pode"])
        self.assertIn("MANAGE_CHANNELS", geral["bot_pode"])
        self.assertIn("staff", "\n".join(estrutura.resumo(foto)))

    def test_ordem_categoria_antes_dos_filhos(self):
        foto = estrutura.tirar_foto(api(fx.servidor_simulado()), fx.SERVIDOR, T0)
        nomes = [c["nome"] for c in foto["canais"]]
        self.assertEqual(nomes, ["geral", "INFORMAÇÕES", "regras", "staff", "suporte"])


class TestPermissoes(unittest.TestCase):
    def test_dono_e_admin_tem_tudo(self):
        self.assertEqual(permissoes.base("g", "u", "u", [], {}), permissoes.TODAS)
        cargos = {"g": 0, "r": permissoes.BIT["ADMINISTRATOR"]}
        b = permissoes.base("g", "dono", "u", ["r"], cargos)
        self.assertEqual(permissoes.no_canal(b, "g", "u", ["r"], [{"id": "g", "type": 0, "allow": 0,
                                                                     "deny": permissoes.TODAS}]), permissoes.TODAS)

    def test_ordem_dos_overwrites(self):
        V, S = permissoes.BIT["VIEW_CHANNEL"], permissoes.BIT["SEND_MESSAGES"]
        b = V | S
        ows = [{"id": "g", "type": 0, "allow": 0, "deny": V | S},
               {"id": "r", "type": 0, "allow": V, "deny": 0},
               {"id": "u", "type": 1, "allow": S, "deny": 0}]
        self.assertEqual(permissoes.no_canal(b, "g", "u", ["r"], ows), V | S)
        self.assertEqual(permissoes.no_canal(b, "g", "u", [], ows[:1]), 0)

    def test_nomes_conhecidos_e_desconhecidos(self):
        self.assertEqual(permissoes.nomes(1 << 51), ["PIN_MESSAGES"])
        self.assertEqual(permissoes.nomes(1 << 60), ["BIT_60"])


class TestCliFoto(unittest.TestCase):
    def rodar(self, argv, env, sim):
        saida, erro = io.StringIO(), io.StringIO()
        c = main(argv, env=env, transporte=sim, saida=saida, erro=erro, caminho_env=Path("/nao/existe"),
                 dormir=lambda s: None)
        return c, saida.getvalue(), erro.getvalue()

    def test_sem_servidor_configurado_sai_com_2(self):
        sim = fx.servidor_simulado()
        c, _, erro = self.rodar(["foto", "--saida", "x"], {"DISCORD_TOKEN": "A.B.C"}, sim)
        self.assertEqual(c, 2)
        self.assertIn("CASCA_SERVIDOR", erro)
        self.assertEqual(sim.chamadas, [])

    def test_foto_grava_e_resume(self):
        with tempfile.TemporaryDirectory() as d:
            env = {"DISCORD_TOKEN": "A.B.SEGREDO", "CASCA_SERVIDOR": fx.SERVIDOR, "CASCA_FOTOS": d}
            c, saida, _ = self.rodar(["foto"], env, fx.servidor_simulado())
            arquivos = list(Path(d).glob("*.json"))
            conteudo = arquivos[0].read_text(encoding="utf-8")
        self.assertEqual(c, 0)
        self.assertEqual(len(arquivos), 1)
        self.assertIn("modo Comunidade: sim", saida)
        self.assertNotIn("SEGREDO", conteudo + saida)


if __name__ == "__main__":
    unittest.main()


class TestRegressaoConsoleWindows(unittest.TestCase):
    """Bug 2026-10-21: o console do Windows (cp1252) quebrava ao imprimir nome de canal com emoji."""

    def test_saida_cp1252_com_emoji_nao_quebra(self):
        canais = [dict(fx.CANAIS[2], name="💎・apoiadores")]
        bruto = io.BytesIO()
        saida = io.TextIOWrapper(bruto, encoding="cp1252")
        with tempfile.TemporaryDirectory() as d:
            env = {"DISCORD_TOKEN": "A.B.C", "CASCA_SERVIDOR": fx.SERVIDOR, "CASCA_FOTOS": d}
            sim = fx.servidor_simulado(canais=canais, bot_perms=fx.perm("EMBED_LINKS"))
            sim.rotas = [r for r in sim.rotas if "channels" not in r[1].pattern]
            sim.responder("GET", f"/guilds/{fx.SERVIDOR}/channels", 200,
                          [dict(c, permission_overwrites=[{"id": fx.SERVIDOR, "type": 0, "allow": "0",
                                                           "deny": fx.perm("VIEW_CHANNEL")}]) for c in canais])
            c = main(["foto"], env=env, transporte=sim, saida=saida, erro=io.StringIO(),
                     caminho_env=Path("/nao/existe"), dormir=lambda s: None)
        saida.flush()
        self.assertEqual(c, 0)
        self.assertIn("apoiadores", bruto.getvalue().decode("utf-8", errors="replace"))
