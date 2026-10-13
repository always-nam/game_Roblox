# 앱 아이콘 생성: 호두나무 테두리 + 청록 펠트 + 빨간 구슬과 구멍
# 사용: python3 scripts/make-icons.py
from PIL import Image, ImageDraw, ImageFilter

def icon(size, maskable=False):
    S = size * 4  # 4배로 그린 뒤 축소(안티에일리어싱)
    im = Image.new('RGB', (S, S), (28, 21, 16))
    d = ImageDraw.Draw(im)
    pad = int(S * (0.16 if maskable else 0.06))  # maskable은 안전 영역(가운데 80%) 확보
    r = int(S * 0.12)
    d.rounded_rectangle([pad, pad, S - pad, S - pad], r, fill=(138, 95, 58))
    inner = pad + int(S * 0.07)
    d.rounded_rectangle([inner, inner, S - inner, S - inner], int(r * 0.6), fill=(32, 69, 63))
    span = S - 2 * inner
    # 나무 벽 블록
    b = int(span * 0.26)
    bx, by = inner + int(span * 0.08), inner + int(span * 0.08)
    d.rounded_rectangle([bx, by, bx + b, by + b], int(b * 0.15), fill=(176, 124, 77))
    # 구멍(빨간 테두리)
    hr = int(span * 0.16)
    hx, hy = S - inner - int(span * 0.25), S - inner - int(span * 0.25)
    d.ellipse([hx - hr - int(hr * .22), hy - hr - int(hr * .22), hx + hr + int(hr * .22), hy + hr + int(hr * .22)], fill=(226, 72, 63))
    d.ellipse([hx - hr, hy - hr, hx + hr, hy + hr], fill=(10, 7, 5))
    # 구슬 + 그림자 + 하이라이트
    mr = int(span * 0.17)
    mx, my = inner + int(span * 0.36), inner + int(span * 0.66)
    sh = Image.new('L', (S, S), 0)
    ImageDraw.Draw(sh).ellipse([mx - mr, my - mr + int(mr * .25), mx + mr, my + mr + int(mr * .25)], fill=140)
    sh = sh.filter(ImageFilter.GaussianBlur(S * 0.01))
    im.paste((0, 0, 0), (0, 0), sh)
    d = ImageDraw.Draw(im)
    for i in range(mr, 0, -1):
        t = i / mr
        col = (int(226 * (0.55 + 0.45 * (1 - t) ** 0.3)), int(72 * (0.5 + 0.5 * (1 - t))), int(63 * (0.5 + 0.5 * (1 - t))))
        ox, oy = int((1 - t) * mr * -0.18), int((1 - t) * mr * -0.22)
        d.ellipse([mx - i + ox, my - i + oy, mx + i + ox, my + i + oy], fill=col)
    hl = int(mr * 0.28)
    hx2, hy2 = mx - int(mr * 0.35), my - int(mr * 0.42)
    d.ellipse([hx2 - hl, hy2 - hl, hx2 + hl, hy2 + hl], fill=(255, 235, 228))
    return im.resize((size, size), Image.LANCZOS)

for name, size, mask in [('icon-192.png', 192, False), ('icon-512.png', 512, False),
                         ('icon-maskable-512.png', 512, True), ('apple-touch-icon.png', 180, True)]:
    icon(size, mask).save(f'icons/{name}', optimize=True)
    print('icons/' + name)
