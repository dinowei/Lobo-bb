# Ícone novo do Lobo Binho (lobo de blusa LARANJA num quadrado laranja), tudo por código, original intacto.
# Original: web/src/assets/originais/lobo-quadrado-laranja.jpg (o azul antigo fica lá só como histórico).
# Uso: python -I scripts/icones.py
#
# (a) Ícone do app: o quadrado como está → PWA 192/512, maskable 512 (zona segura de 80%), apple-touch 180
#     e favicon 16/32/48 (+ favicon.ico).
# (b) Lobo solto (web/src/assets/lobo.png): o fundo é laranja como a blusa, então NÃO dá para recortar por
#     cor. Recorta pelo contorno escuro do desenho: inunda a partir das bordas por tudo que não é escuro
#     (laranja do fundo e a borda branca de adesivo) e para no traço. Fundo transparente, sem franja
#     laranja/branca fora do traço; depois um contorno branco fino de adesivo, para a blusa não sumir no laranja.
# (c) Marca ✦ do Gemini: manchas pequenas e claras no fundo laranja viram laranja (o fundo é liso).
from collections import deque
from pathlib import Path
import sys
from PIL import Image, ImageFilter

sys.stdout.reconfigure(encoding="utf-8")
raiz = Path(__file__).resolve().parent.parent
original = raiz / "web/src/assets/originais/lobo-quadrado-laranja.jpg"
saida = raiz / "web/public/icones"
saida.mkdir(parents=True, exist_ok=True)
TRABALHO = 1024
L_TRACO = 80  # luz abaixo disso = traço escuro do desenho (o contorno é quase preto, ≈ 30–50)


def luz(c):
    return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]


def laranja(c):
    return c[0] >= 200 and 60 <= c[1] <= 120 and c[2] <= 70


def inundar(w, h, sementes, aceita):
    marcado = bytearray(w * h)
    fila = deque()
    for x, y in sementes:
        if aceita(x, y) and not marcado[y * w + x]:
            marcado[y * w + x] = 1
            fila.append((x, y))
    while fila:
        x, y = fila.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not marcado[ny * w + nx] and aceita(nx, ny):
                marcado[ny * w + nx] = 1
                fila.append((nx, ny))
    return marcado


def componentes(mascara, w, h):
    visto = bytearray(w * h)
    for i in range(w * h):
        if not mascara[i] or visto[i]:
            continue
        comp = [i]
        visto[i] = 1
        k = 0
        while k < len(comp):
            j = comp[k]
            k += 1
            x, y = j % w, j // w
            for nj in (j + 1 if x + 1 < w else -1, j - 1 if x > 0 else -1, j + w if y + 1 < h else -1, j - w if y > 0 else -1):
                if nj >= 0 and mascara[nj] and not visto[nj]:
                    visto[nj] = 1
                    comp.append(nj)
        yield comp


quadrado = Image.open(original).convert("RGB")
lado = min(quadrado.size)
quadrado = quadrado.crop(((quadrado.width - lado) // 2, (quadrado.height - lado) // 2, (quadrado.width + lado) // 2, (quadrado.height + lado) // 2))
im = quadrado.resize((TRABALHO, TRABALHO), Image.LANCZOS)
w = h = TRABALHO
px = im.load()
cor_fundo = tuple(sorted(px[x, y][k] for x in range(0, w, 16) for y in (3, h - 4))[len(range(0, w, 16))] for k in range(3))
bordas = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]

# ---------- (c) ✦: o fundo laranja ligado à borda; o que estiver cercado por ele e for pequeno é marca ----------
fundo_laranja = inundar(w, h, bordas, lambda x, y: laranja(px[x, y]))
nao_fundo = bytearray(1 - b for b in fundo_laranja)
comps = sorted(componentes(nao_fundo, w, h), key=len, reverse=True)
marcas = [c for c in comps[1:] if len(c) < w * h * 0.01]
for c in marcas:
    for j in c:
        px[j % w, j // w] = cor_fundo
print(f"✦ marcas removidas: {len(marcas)}")
# a mesma limpeza no quadrado em tamanho cheio (para os ícones)
if marcas:
    escala = quadrado.width / w
    qp = quadrado.load()
    for c in marcas:
        xs = [j % w for j in c]
        ys = [j // w for j in c]
        for y in range(int(min(ys) * escala) - 2, int((max(ys) + 1) * escala) + 2):
            for x in range(int(min(xs) * escala) - 2, int((max(xs) + 1) * escala) + 2):
                if 0 <= x < quadrado.width and 0 <= y < quadrado.height:
                    qp[x, y] = cor_fundo

# ---------- (a) ícones do app: o quadrado como está ----------
def salvar(tam, nome, zona=1.0):
    if zona >= 1:
        quadrado.resize((tam, tam), Image.LANCZOS).save(saida / nome, optimize=True)
        return
    tela = Image.new("RGB", (tam, tam), cor_fundo)
    dentro = round(tam * zona)
    tela.paste(quadrado.resize((dentro, dentro), Image.LANCZOS), ((tam - dentro) // 2, (tam - dentro) // 2))
    tela.save(saida / nome, optimize=True)


salvar(16, "favicon-16.png")
salvar(32, "favicon-32.png")
salvar(48, "favicon-48.png")
salvar(180, "apple-touch-icon.png")
salvar(192, "icone-192.png")
salvar(512, "icone-512.png")
salvar(512, "icone-maskable-512.png", zona=0.8)  # Android corta até um círculo de 80%: o lobo inteiro fica dentro
quadrado.resize((48, 48), Image.LANCZOS).save(raiz / "web/public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

# ---------- (b) lobo solto ----------
# 1ª passada: o laranja do fundo, a partir das bordas (para na borda branca de adesivo)
fora = inundar(w, h, bordas, lambda x, y: laranja(px[x, y]))
# 2ª: a borda branca (e a mistura branco/laranja) ligada ao fundo, até o traço escuro. Embaixo a blusa
# encosta direto na borda branca, sem traço: o laranja saturado (G baixo) da blusa segura a inundação.
claro = lambda c: luz(c) >= L_TRACO and c[1] >= 150
vizinhos_do_fundo = [(i % w, i // w) for i in range(w * h) if fora[i]]
borda_branca = inundar(w, h, vizinhos_do_fundo, lambda x, y: fora[y * w + x] or claro(px[x, y]))
fora = bytearray(a | b for a, b in zip(fora, borda_branca))
corpo = bytearray(1 - b for b in fora)
comps = sorted(componentes(corpo, w, h), key=len, reverse=True)
corpo = bytearray(w * h)
for c in comps:
    if len(c) >= len(comps[0]) * 0.02:
        for j in c:
            corpo[j] = 1
mascara = Image.frombytes("L", (w, h), bytes(255 if b else 0 for b in corpo)).filter(ImageFilter.GaussianBlur(0.8))
lobo = im.convert("RGBA")
lobo.putalpha(mascara)
# contorno branco fino de adesivo (≈1% do tamanho) por baixo
adesivo = mascara.filter(ImageFilter.MaxFilter(11)).filter(ImageFilter.GaussianBlur(1))
solto = Image.new("RGBA", (w, h), (255, 255, 255, 0))
solto.putalpha(adesivo)
solto.alpha_composite(lobo)
solto = solto.crop(solto.getbbox())
solto = solto.resize((512, round(solto.height * 512 / solto.width)), Image.LANCZOS)
solto.save(raiz / "web/src/assets/lobo.png", optimize=True)
solto.save(raiz / "web/src/assets/lobo.webp", "WEBP", quality=85, method=6)
print(f"✔ lobo solto {solto.width}×{solto.height}; ícones em {saida}")
