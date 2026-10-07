"""Gera ícones do app a partir do logo original: marca JM grande + 'FINANCE' menor em dourado."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
SRC = 'brand/jm-logo-original.png'
FONT = '/usr/share/fonts/truetype/sand-box/google/Montserrat/Montserrat-VariableFont_wght.ttf'
BG = (8, 7, 7)
src = Image.open(SRC).convert('RGB'); W = src.size[0]

def font(px, wght=650):
    f = ImageFont.truetype(FONT, px)
    try: f.set_variation_by_axes([wght])
    except Exception: pass
    return f

def gold_text(text, px, tracking):
    f = font(px)
    adv = [f.getlength(c) for c in text]
    w = int(sum(adv) + tracking * (len(text) - 1)) + 4
    asc, desc = f.getmetrics(); h = asc + desc
    mask = Image.new('L', (w, h)); d = ImageDraw.Draw(mask); x = 2
    for c, a in zip(text, adv): d.text((x, 0), c, font=f, fill=255); x += a + tracking
    stops = [(0, (253, 239, 137)), (.5, (247, 183, 49)), (1, (193, 121, 37))]  # amostrado do logo
    grad = Image.new('RGB', (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
            if t0 <= t <= t1:
                k = (t - t0) / (t1 - t0); grad.putpixel((0, y), tuple(int(c0[i] + (c1[i] - c0[i]) * k) for i in range(3))); break
    grad = grad.resize((w, h)); out = Image.new('RGBA', (w, h)); out.paste(grad, (0, 0), mask)
    return out.crop(out.getbbox())

def compose(S, content=1.0):
    # fundo: preto do logo com brilho radial quente e sutil
    canvas = Image.new('RGB', (S, S), BG)
    glow = Image.new('L', (S, S), 0); ImageDraw.Draw(glow).ellipse((S * .1, S * .05, S * .9, S * .85), fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(S / 6))
    canvas.paste(Image.new('RGB', (S, S), (37, 27, 17)), (0, 0), glow)
    box = S * content
    ms = int(box * 0.76)
    c = int(W * 0.11); off = int(W * .02)
    mark = src.crop((c, c - off, W - c, W - c - off)).resize((ms, ms), Image.LANCZOS)
    m = Image.new('L', (ms, ms), 0); ImageDraw.Draw(m).ellipse((ms * .04, ms * .04, ms * .96, ms * .96), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(ms / 16))
    txt = gold_text('FINANCE', max(9, int(box * 0.105)), max(1, int(box * 0.03)))
    total_h = ms * 0.93 + txt.size[1]
    top = int((S - total_h) / 2 - ms * 0.04)
    canvas.paste(mark, ((S - ms) // 2, top), m)
    canvas.paste(txt, ((S - txt.size[0]) // 2, int(top + ms * 0.93)), txt)
    return canvas

def q(im, path):
    im.quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(path, optimize=True)

for S in (192, 512):
    q(compose(S), f'public/icons/icon-{S}.png'); q(compose(S, 0.74), f'public/icons/maskable-{S}.png')
q(compose(180, 0.92), 'public/icons/apple-touch-icon.png')
compose(1024).save('brand/jm-finance-icon-1024.png', optimize=True)
# favicon: só a marca JM (o texto ficaria ilegível em 16/32 px)
c = int(W * 0.09); mk = src.crop((c, c, W - c, W - c))
for s in (16, 32): mk.resize((s, s), Image.LANCZOS).save(f'public/icons/favicon-{s}.png', optimize=True)
mk.resize((48, 48), Image.LANCZOS).save('public/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
print('ok')
