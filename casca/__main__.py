"""Ponto de entrada: `python -I casca <comando>` (na raiz do repo Alic3) ou `python -I <caminho>/casca <comando>`.

Executando o diretório, o Python põe só a pasta `casca/` em sys.path[0]; trocamos essa entrada pela raiz do
repo (calculada a partir deste arquivo, nunca do diretório atual) para importar `casca` como pacote.
"""
import sys
from pathlib import Path

if not __package__:
    _pasta = Path(__file__).resolve().parent
    _raiz = str(_pasta.parent)
    sys.path[:] = [p for p in sys.path if Path(p or ".").resolve() != _pasta]
    if _raiz not in sys.path:
        sys.path.insert(0, _raiz)

from casca.cli import main  # noqa: E402

sys.exit(main())
