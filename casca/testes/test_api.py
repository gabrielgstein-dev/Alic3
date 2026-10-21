import io
import tempfile
import unittest
from pathlib import Path

from casca.cli import main
from casca.discord_api import Discord, ErroDiscord, TokenAusente, ler_token
from casca.testes.simulador import Simulador

TOKEN = "TESTE0token.SECRETO.nao-deve-vazar-123"


def rodar(argv, sim, env=None, caminho_env=None):
    saida, erro = io.StringIO(), io.StringIO()
    codigo = main(argv, env={"DISCORD_TOKEN": TOKEN} if env is None else env, transporte=sim,
                  saida=saida, erro=erro, caminho_env=caminho_env or Path("/nao/existe/.env"),
                  dormir=lambda s: None)
    return codigo, saida.getvalue(), erro.getvalue()


class TestToken(unittest.TestCase):
    def test_sem_token_sai_com_2_e_aponta_o_env(self):
        codigo, saida, erro = rodar(["eu"], Simulador(), env={}, caminho_env=Path("/nao/existe/.env"))
        self.assertEqual(codigo, 2)
        self.assertIn(".env", erro)
        self.assertIn("DISCORD_TOKEN", erro)

    def test_le_token_do_env_arquivo(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / ".env"
            p.write_text("# comentario\nOUTRA=1\nDISCORD_TOKEN=abc.def.ghi\n", encoding="utf-8")
            self.assertEqual(ler_token({}, p), "abc.def.ghi")

    def test_env_vazio_no_arquivo_e_ausente(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / ".env"
            p.write_text("DISCORD_TOKEN=\n", encoding="utf-8")
            with self.assertRaises(TokenAusente):
                ler_token({}, p)

    def test_401_nao_vaza_o_token(self):
        sim = Simulador().responder("GET", "/users/@me", 401, {"message": "401: Unauthorized", "code": 0})
        with tempfile.TemporaryDirectory() as d:
            codigo, saida, erro = rodar(["eu"], sim)
            arquivos = "".join(p.read_text(encoding="utf-8", errors="replace")
                               for p in Path(d).rglob("*") if p.is_file())
        self.assertEqual(codigo, 1)
        self.assertIn("token inválido ou revogado", erro)
        for texto in (saida, erro, arquivos, repr(Discord(TOKEN))):
            self.assertNotIn(TOKEN, texto)
            self.assertNotIn("SECRETO", texto)

    def test_cabecalho_de_autenticacao_e_user_agent(self):
        sim = Simulador().responder("GET", "/users/@me", 200, {"id": "1", "username": "Alic3"})
        sim.responder("GET", "/users/@me/guilds", 200, [{"id": "123456789012345678", "name": "D3zesseteSims"}])
        codigo, saida, _ = rodar(["eu"], sim)
        self.assertEqual(codigo, 0)
        self.assertIn("D3zesseteSims", saida)
        cab = sim.chamadas[0][3]
        self.assertEqual(cab["Authorization"], f"Bot {TOKEN}")
        self.assertTrue(cab["User-Agent"].startswith("DiscordBot ("))


class TestLimites(unittest.TestCase):
    def test_429_espera_e_repete(self):
        sim = Simulador().responder("GET", "/users/@me", 429, {"retry_after": 0.5}, {"Retry-After": "0.01"})
        sim.responder("GET", "/users/@me", 200, {"id": "1"})
        esperas = []
        api = Discord(TOKEN, transporte=sim, dormir=esperas.append)
        self.assertEqual(api.get("/users/@me"), {"id": "1"})
        self.assertEqual(len(sim.chamadas), 2)
        self.assertEqual(esperas, [0.01])

    def test_429_sem_fim_vira_erro(self):
        sim = Simulador().responder("GET", "/x", 429, {"retry_after": 0.01})
        api = Discord(TOKEN, transporte=sim, dormir=lambda s: None)
        with self.assertRaises(ErroDiscord) as c:
            api.get("/x")
        self.assertEqual(c.exception.status, 429)
        self.assertEqual(len(sim.chamadas), 5)

    def test_escritas_espacadas_no_maximo_5_por_segundo(self):
        sim = Simulador().responder("POST", "/channels/1/messages", 200, {"id": "9"})
        relogio = [100.0]
        esperas = []

        def dormir(s):
            esperas.append(round(s, 3))
            relogio[0] += s

        api = Discord(TOKEN, transporte=sim, dormir=dormir, relogio=lambda: relogio[0])
        for _ in range(3):
            api.post("/channels/1/messages", {"content": "oi"})
        self.assertEqual(esperas, [0.2, 0.2])

    def test_leitura_nao_espera(self):
        sim = Simulador().responder("GET", "/x", 200, {})
        esperas = []
        api = Discord(TOKEN, transporte=sim, dormir=esperas.append, relogio=lambda: 0.0)
        for _ in range(3):
            api.get("/x")
        self.assertEqual(esperas, [])

    def test_erro_403_troca_ids_e_explica(self):
        sim = Simulador().responder("POST", r"/guilds/\d+/channels", 403, {"message": "Missing Permissions", "code": 50013})
        api = Discord(TOKEN, transporte=sim, dormir=lambda s: None)
        with self.assertRaises(ErroDiscord) as c:
            api.post("/guilds/123456789012345678/channels", {"name": "x"})
        texto = str(c.exception)
        self.assertIn("/guilds/{id}/channels", texto)
        self.assertIn("não tem permissão", texto)
        self.assertIn("50013", texto)


if __name__ == "__main__":
    unittest.main()
