# Recorta as poses do Binho (fundo branco/cinza do Gemini → transparente), tira a marca ✦ do canto e
# gera WebP + PNG de reserva nos tamanhos usados no site (240 e 520 px de largura = 1x/2x).
# Fonte: web/src/assets/lobos/originais/ (os originais do dono; nada é apagado).
# uso: python -I scripts/binho-recortar.py
#
# Como separa (medido nas imagens): o fundo é branco NEUTRO (R≈G≈B, L 250–255); a sombra no chão é
# cinza NEUTRO (L 228–250); luvas e sapatos são claros mas AZULADOS (B−R ≈ 6–14) e escurecem até
# L ≈ 170. Então: fundo = pixel neutro e claro ligado à borda (não entra na luva); a sombra clara vira
# sombra escura translúcida (fica natural no tema escuro); ilhas pequenas (a ✦) saem.
from collections import deque
from pathlib import Path
import sys
from PIL import Image, ImageFilter

sys.stdout.reconfigure(encoding="utf-8")
raiz = Path(__file__).resolve().parent.parent
pasta = raiz / "web/src/assets/lobos"
originais = pasta / "originais"
TRABALHO = 1024
LARGURAS = (240, 520)
L_FUNDO = 228  # neutro e mais claro que isso, ligado à borda = fundo ou sombra clara
L_TRANSPARENTE = 250  # acima disso: some de vez; entre L_FUNDO e isso: vira sombra escura suave


def luz(c):
    return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]


def neutro(c):
    return c[3] >= 128 and max(c[:3]) - min(c[:3]) <= 4 and abs(c[2] - c[0]) <= 3


L_SOMBRA = 175  # 2ª passada (só na faixa de baixo): cinza neutro mais escuro = sombra do chão
FAIXA_SOMBRA = 0.24
PASSO_SOMBRA = 8  # sombra esmaece devagar (com ruído de JPEG); objeto cinza (notebook, cadeira) tem borda marcada


# Sombra azulada no chão só aparece nas poses sentadas no chão; nas outras, a mesma tolerância comia o
# sapato (também azulado e de sombreado suave). Medido em 18/10/2026 nas 11 poses.
SOMBRA_AZULADA = {"binho-lendo", "binho-notebook", "binho-escrevendo", "lo-lendo"}  # mesa, lo-e-binho e lo-quadro: comia o sapato


def dist(a, b):
    return max(abs(a[0] - b[0]), abs(a[1] - b[1]), abs(a[2] - b[2]))


def componentes(mascara: bytearray, w: int, h: int):
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
            for nj in ((j + 1) if x + 1 < w else -1, (j - 1) if x > 0 else -1, j + w if y + 1 < h else -1, j - w if y > 0 else -1):
                if nj >= 0 and mascara[nj] and not visto[nj]:
                    visto[nj] = 1
                    comp.append(nj)
        yield comp


def recortar(im: Image.Image, nome: str) -> Image.Image:
    tinha_alfa = im.mode == "RGBA" and im.getextrema()[3][0] < 250
    im = im.convert("RGBA")
    if im.width > TRABALHO:
        im = im.resize((TRABALHO, round(im.height * TRABALHO / im.width)), Image.LANCZOS)
    w, h = im.size
    px = im.load()
    fundo = bytearray(w * h)
    if tinha_alfa:  # já veio transparente: o alfa do original manda
        for i in range(w * h):
            fundo[i] = px[i % w, i // w][3] < 128
    else:
        # limiar do fundo adaptado à imagem: a borda pode ser branca (≈254) ou cinza degradê (≈215)
        borda = sorted(luz(px[x, y]) for x in range(0, w, 8) for y in (2, h - 3)) + sorted(luz(px[x, y]) for y in range(0, h, 8) for x in (2, w - 3))
        borda.sort()
        l_fundo = min(L_FUNDO, borda[len(borda) // 50] - 15)  # o mais escuro da borda (cantos do degradê), com folga
        degrade = borda[len(borda) // 2] < 240  # fundo cinza em degradê (às vezes azulado, como as luvas)
        if degrade:
            # degradê: anda só por passos mínimos (o fundo varia devagar; a borda da luva é um salto)
            aceita_fundo = lambda c, y, pai: c[3] >= 128 and max(c[:3]) - min(c[:3]) <= 9 and luz(c) >= 150 and dist(c, pai) <= 3
        else:
            # fundo branco é 254–255 em toda parte (as áreas mais escuras são a sombra do chão, que tem passada
            # própria); a borda iluminada da luva fica em 237–248: limiar alto evita entrar nela
            l_fundo = 249
            aceita_fundo = lambda c, y, pai: neutro(c) and luz(c) >= l_fundo
        # sombra pode ser levemente azulada (luz ambiente); o passo pequeno é o que segura sapato e notebook
        tom = 12 if nome in SOMBRA_AZULADA else 4
        aceita_sombra = lambda c, y, pai: c[3] >= 128 and max(c[:3]) - min(c[:3]) <= tom and luz(c) >= L_SOMBRA and y >= h * (1 - FAIXA_SOMBRA) and dist(c, pai) <= PASSO_SOMBRA

        def inundar(sementes, aceita):
            fila = deque(sementes)
            while fila:
                x, y = fila.popleft()
                pai = px[x, y]
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not fundo[ny * w + nx] and aceita(px[nx, ny], ny, pai):
                        fundo[ny * w + nx] = 1
                        fila.append((nx, ny))

        sementes = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
        sementes = [(x, y) for x, y in sementes if aceita_fundo(px[x, y], y, px[x, y])]
        for x, y in sementes:
            fundo[y * w + x] = 1
        inundar(sementes, aceita_fundo)
        # 2ª passada: a sombra do chão, mais escura, a partir do fundo já achado (só embaixo)
        inundar([(i % w, i // w) for i in range(w * h) if fundo[i] and i // w >= h * (1 - FAIXA_SOMBRA)], aceita_sombra)
        # 3ª: chão FECHADO (entre as pernas da mesa, embaixo de quem está sentado), só na faixa de baixo:
        # no meio da imagem, branco cercado é desenho (as letras BINHO do moletom). Brilho da luva também é
        # branco neutro, mas fica cercado pela luva AZULADA; o chão fechado é cercado de madeira, sombra, pelo…
        if not degrade:
            corte_y = h * (1 - 0.3)
            # só o chão quase branco (≥ 240): o sapato fica abaixo disso e não entra
            candidato = bytearray(1 if (i // w >= corte_y and not fundo[i] and neutro(px[i % w, i // w]) and luz(px[i % w, i // w]) >= 240) else 0 for i in range(w * h))
            for comp in componentes(candidato, w, h):
                if len(comp) < 2500:  # chão fechado é grande; brilho de sapato/luva/notebook é pequeno
                    continue
                dentro = set(comp)
                vizinhos = azulados = 0
                for j in comp[:: max(1, len(comp) // 4000)]:
                    x, y = j % w, j // w
                    for nj in (j + 1 if x + 1 < w else -1, j - 1 if x > 0 else -1, j + w if y + 1 < h else -1, j - w if y > 0 else -1):
                        if nj >= 0 and nj not in dentro:
                            vizinhos += 1
                            c = px[nj % w, nj // w]
                            azulados += c[2] - c[0] >= 4 and luz(c) >= 140
                if vizinhos and azulados / vizinhos < 0.3:
                    for j in comp:
                        fundo[j] = 1
    # personagem = o que não é fundo; ilhas pequenas (marca ✦, sujeira) saem
    corpo = bytearray(1 - b for b in fundo)
    comps = sorted(componentes(corpo, w, h), key=len, reverse=True)
    corpo = bytearray(w * h)
    for comp in comps:
        if len(comp) >= max(400, len(comps[0]) * 0.02):
            for j in comp:
                corpo[j] = 1
    mascara = Image.frombytes("L", (w, h), bytes(255 if b else 0 for b in corpo))
    mascara = mascara.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    saida = im.copy()
    saida.putalpha(mascara)
    # sombra clara do chão → sombra escura translúcida (só embaixo do personagem, perto dele)
    if not tinha_alfa:
        # referência de "sem sombra": o claro do fundo desta imagem (branco ou o cinza do degradê)
        l_ref = min(L_TRANSPARENTE, borda[len(borda) // 2] - 4)
        caixa = mascara.getbbox()
        sombra = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        sp = sombra.load()
        mp = mascara.load()
        for y in range(max(0, caixa[3] - h // 6), h):
            for x in range(w):
                c = px[x, y]
                if fundo[y * w + x] and mp[x, y] < 10 and luz(c) < l_ref:
                    sp[x, y] = (0, 0, 0, min(120, int((l_ref - luz(c)) * 3)))
        sombra = sombra.filter(ImageFilter.GaussianBlur(2))
        sombra.alpha_composite(saida)
        saida = sombra
    return saida.crop(saida.getbbox())


import json

dimensoes = {}
so = set(sys.argv[1:])  # opcional: só estas poses (ex.: lo-quadro)
try:
    dimensoes = json.loads((pasta / "dimensoes.json").read_text(encoding="utf-8"))
except FileNotFoundError:
    pass
# Binho (mascote) e Lo (assistente, blusa turquesa): mesmo fundo branco do Gemini, mesmo recorte
for arq in sorted([*originais.glob("binho-*.*"), *originais.glob("lo-*.*")]):
    nome = arq.name.split(".")[0]  # binho-lendo.png.jpg → binho-lendo
    if so and nome not in so:
        continue
    recorte = recortar(Image.open(arq), nome)
    dimensoes[nome.removeprefix("binho-")] = [recorte.width, recorte.height]
    for larg in LARGURAS:
        alt = round(recorte.height * larg / recorte.width)
        r = recorte.resize((larg, alt), Image.LANCZOS)
        r.save(pasta / f"{nome}-{larg}.webp", "WEBP", quality=82, method=6)
        r.save(pasta / f"{nome}-{larg}.png", optimize=True)
    print(f"✔ {nome}: {recorte.width}×{recorte.height}")

# proporção de cada pose para o <img> já nascer com width/height certos (sem pular layout)
(pasta / "dimensoes.json").write_text(json.dumps(dimensoes, indent=2), encoding="utf-8")
