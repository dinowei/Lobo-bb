# Gera os ícones do PWA a partir do mascote (web/src/assets/lobo.png), sobre o fundo escuro do app.
# Uso: python -I scripts/icones.py   (gera web/public/icones/*.png)
# O ADENDO-BINHO-VOZ refaz os ícones a partir da cabeça do lobo; este é o provisório.
from pathlib import Path
from PIL import Image

raiz = Path(__file__).resolve().parent.parent
lobo = Image.open(raiz / "web/src/assets/lobo.png").convert("RGBA")
saida = raiz / "web/public/icones"
saida.mkdir(parents=True, exist_ok=True)
FUNDO = (18, 18, 18, 255)  # --bg #121212


def icone(tam: int, margem: float, nome: str):
    tela = Image.new("RGBA", (tam, tam), FUNDO)
    caixa = int(tam * (1 - 2 * margem))
    escala = min(caixa / lobo.width, caixa / lobo.height)
    l = lobo.resize((max(1, round(lobo.width * escala)), max(1, round(lobo.height * escala))), Image.LANCZOS)
    tela.alpha_composite(l, ((tam - l.width) // 2, (tam - l.height) // 2))
    tela.save(saida / nome, optimize=True)


icone(32, 0.04, "favicon-32.png")
icone(48, 0.04, "favicon-48.png")
icone(180, 0.10, "apple-touch-icon.png")
icone(192, 0.08, "icone-192.png")
icone(512, 0.08, "icone-512.png")
icone(512, 0.20, "icone-maskable-512.png")  # zona segura do Android
print("ícones gerados em", saida)
