"""Demo 美術第一版產生器：場景背景、四張大陸地圖、人物，淺色與深色各一。
風格：幾何平面、留白多、品牌色、手繪感線條（頂點微抖、圓頭線）；沒有漸層、沒有濾鏡、沒有文字。
用法：python3 scenes.py  → 寫進 ../（frontend/world/art/）。codex 之後產的同名檔案直接蓋上去即可。
"""
import os
import random

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

# ---------- 色票：頁面層（淺／深）與夜景面板（兩個主題相同，深色略深） ----------
PAGE = {
    'light': dict(bg='#F6F4EE', bg2='#EFE9DA', sand='#E8DFC4', land='#E6EFD9', land2='#CFE2C6', land3='#B6D3AC',
                  edge='#9DBE97', sea='#DCEAF5', sea2='#CCE0F0', seal='#B7D0E3', ink='#0D2B26', pine='#0E5F52',
                  pine2='#2A8A79', mint='#DCEFE8', coral='#F26B54', honey='#F4C24D', sky='#3A6FD8', cloud='#FFFFFF',
                  trunk='#8C6A4A', rock='#CFC6AE', snow='#FFFFFF', fog='#E3DFD3', road='#D8C9A6'),
    'dark': dict(bg='#0C1412', bg2='#131D1A', sand='#2A3630', land='#1A2420', land2='#22312B', land3='#2B3F37',
                 edge='#3C524A', sea='#0F1E27', sea2='#132532', seal='#1E3340', ink='#EAF1EE', pine='#7ED3C0',
                 pine2='#3F8F7E', mint='#16302A', coral='#F26B54', honey='#F4C24D', sky='#6B98F0', cloud='#1E2C34',
                 trunk='#4E3F32', rock='#2C3A35', snow='#C9D6D1', fog='#1C2624', road='#3A4A42'),
}
NIGHT = {
    'light': dict(n0='#0F2A25', n1='#143731', n2='#1B4A41', n3='#236458', n4='#2E7A6B', on='#EAF1EE', mute='#A9BDB6',
                  honey='#F4C24D', coral='#F26B54', star='#FFFFFF', moon='#FFF3C4', water='#0C2F3C', water2='#0E3A48'),
    'dark': dict(n0='#0A1F1B', n1='#0F2A25', n2='#143731', n3='#1B4A41', n4='#236458', on='#EAF1EE', mute='#A9BDB6',
                 honey='#F4C24D', coral='#F26B54', star='#FFFFFF', moon='#FFF3C4', water='#081F2A', water2='#0B2A36'),
}


# ---------- 幾何工具 ----------
def R(seed):
    return random.Random(seed)


def fmt(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.')


def jitter(pts, amp, seed):
    r = R(seed)
    return [(x + r.uniform(-amp, amp), y + r.uniform(-amp, amp)) for x, y in pts]


def poly(pts, close=True):
    d = 'M' + ' L'.join(f'{fmt(x)} {fmt(y)}' for x, y in pts)
    return d + ('Z' if close else '')


def smooth(pts, close=True, t=0.5):
    """Catmull-Rom → 三次貝茲，畫起伏的山丘、海岸、雲。"""
    n = len(pts)
    if close:
        get = lambda i: pts[i % n]  # noqa: E731
        rng = range(n)
    else:
        get = lambda i: pts[max(0, min(n - 1, i))]  # noqa: E731
        rng = range(n - 1)
    d = f'M{fmt(pts[0][0])} {fmt(pts[0][1])}'
    for i in rng:
        p0, p1, p2, p3 = get(i - 1), get(i), get(i + 1), get(i + 2)
        c1 = (p1[0] + (p2[0] - p0[0]) * t / 3, p1[1] + (p2[1] - p0[1]) * t / 3)
        c2 = (p2[0] - (p3[0] - p1[0]) * t / 3, p2[1] - (p3[1] - p1[1]) * t / 3)
        d += f' C{fmt(c1[0])} {fmt(c1[1])} {fmt(c2[0])} {fmt(c2[1])} {fmt(p2[0])} {fmt(p2[1])}'
    return d + ('Z' if close else '')


def hills(x0, x1, base, top, n, seed, amp=1.0, bottom=None):
    """從 x0 到 x1 的起伏地平線，往下封到 bottom。"""
    r = R(seed)
    pts = []
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        y = top + (base - top) * (0.5 + 0.5 * r.uniform(-amp, amp))
        pts.append((x, y))
    bottom = base + 400 if bottom is None else bottom
    ring = [(x0 - 20, bottom), (x0 - 20, pts[0][1])] + pts + [(x1 + 20, pts[-1][1]), (x1 + 20, bottom)]
    return smooth(ring, close=True, t=0.9)


def path(d, fill='none', stroke=None, w=1.9, op=None, extra=''):
    s = f'<path d="{d}" fill="{fill}"'
    if stroke:
        s += f' stroke="{stroke}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"'
    if op is not None:
        s += f' opacity="{op}"'
    return s + f' {extra}/>'


def circle(cx, cy, r, fill, op=None, stroke=None, w=1.9):
    s = f'<circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="{fmt(r)}" fill="{fill}"'
    if stroke:
        s += f' stroke="{stroke}" stroke-width="{w}"'
    if op is not None:
        s += f' opacity="{op}"'
    return s + '/>'


def svg(w, h, body, bg=None):
    rect = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
            f'preserveAspectRatio="xMidYMax slice" aria-hidden="true">{rect}{body}</svg>\n')


# ---------- 元件 ----------
def stars(w, h, n, seed, color, ymax=None, op=0.9):
    r = R(seed)
    out = []
    ymax = ymax or h
    for i in range(n):
        x, y = r.uniform(6, w - 6), r.uniform(6, ymax)
        k = r.random()
        if k < 0.18:
            s = r.uniform(3, 5)
            out.append(path(f'M{fmt(x - s)} {fmt(y)}h{fmt(2 * s)}M{fmt(x)} {fmt(y - s)}v{fmt(2 * s)}', stroke=color, w=1.4, op=op))
        else:
            out.append(circle(x, y, r.uniform(0.8, 1.7), color, op=op * r.uniform(0.5, 1)))
    return ''.join(out)


def moon(cx, cy, r, color, bg, crescent=True):
    s = circle(cx, cy, r, color)
    if crescent:
        s += circle(cx + r * 0.42, cy - r * 0.18, r * 0.86, bg)
    return s


def pine_tree(x, base, h, w, fill, trunk, seed=0, layers=3):
    out = [f'<rect x="{fmt(x - w * 0.08)}" y="{fmt(base - h * 0.18)}" width="{fmt(w * 0.16)}" height="{fmt(h * 0.2)}" rx="1.5" fill="{trunk}"/>']
    for i in range(layers):
        top = base - h + i * h * 0.22
        ww = w * (0.55 + 0.25 * i)
        hh = h * 0.45
        pts = jitter([(x, top), (x + ww / 2, top + hh), (x - ww / 2, top + hh)], 0.8, seed + i)
        out.append(path(poly(pts), fill=fill))
    return ''.join(out)


def round_tree(x, base, h, w, fill, trunk, seed=0):
    r = R(seed)
    pts = [(x + w / 2 * (0.9 + 0.1 * r.random()) * __import__('math').cos(a), base - h * 0.55 + h * 0.42 * __import__('math').sin(a))
           for a in [i * 6.283 / 9 for i in range(9)]]
    return (f'<rect x="{fmt(x - w * 0.07)}" y="{fmt(base - h * 0.32)}" width="{fmt(w * 0.14)}" height="{fmt(h * 0.34)}" rx="1.5" fill="{trunk}"/>'
            + path(smooth(pts), fill=fill))


def tent(x, base, w, h, fill, door, line, seed=0):
    pts = jitter([(x - w / 2, base), (x, base - h), (x + w / 2, base)], 0.9, seed)
    s = path(poly(pts), fill=fill)
    s += path(poly([(x - w * 0.13, base), (x, base - h * 0.5), (x + w * 0.13, base)]), fill=door)
    s += path(f'M{fmt(x)} {fmt(base - h)}l{fmt(-w * 0.1)} {fmt(-h * 0.2)}M{fmt(x)} {fmt(base - h)}l{fmt(w * 0.1)} {fmt(-h * 0.2)}', stroke=line, w=1.6)
    return s


def flagpole(x, base, h, flag, pole):
    return (path(f'M{fmt(x)} {fmt(base)}V{fmt(base - h)}', stroke=pole, w=2) +
            path(poly([(x, base - h), (x + h * 0.42, base - h + h * 0.12), (x, base - h + h * 0.26)]), fill=flag))


def campfire(x, base, s, log, flame, flame2):
    return (path(f'M{fmt(x - s * 0.9)} {fmt(base - s * 0.1)}l{fmt(s * 1.8)} {fmt(s * 0.35)}M{fmt(x - s * 0.9)} {fmt(base + s * 0.25)}l{fmt(s * 1.8)} {fmt(-s * 0.35)}', stroke=log, w=3.2) +
            path(smooth([(x, base - s * 1.5), (x + s * 0.55, base - s * 0.7), (x + s * 0.35, base), (x - s * 0.35, base), (x - s * 0.55, base - s * 0.75)]), fill=flame) +
            path(smooth([(x + s * 0.05, base - s * 0.9), (x + s * 0.28, base - s * 0.45), (x + s * 0.18, base), (x - s * 0.18, base), (x - s * 0.25, base - s * 0.5)]), fill=flame2))


def lighthouse(x, base, h, body, stripe, lamp, line, glow=None):
    w = h * 0.28
    out = []
    if glow:
        out.append(circle(x, base - h * 0.93, h * 0.22, glow, op=0.35))
    out.append(path(poly([(x - w / 2, base), (x + w / 2, base), (x + w * 0.34, base - h * 0.82), (x - w * 0.34, base - h * 0.82)]), fill=body))
    for i in range(3):
        y0 = base - h * (0.2 + i * 0.22)
        out.append(path(poly([(x - w * (0.5 - (base - y0) / h * 0.16), y0), (x + w * (0.5 - (base - y0) / h * 0.16), y0),
                              (x + w * (0.5 - (base - y0 + h * 0.08) / h * 0.16), y0 - h * 0.08), (x - w * (0.5 - (base - y0 + h * 0.08) / h * 0.16), y0 - h * 0.08)]), fill=stripe))
    out.append(f'<rect x="{fmt(x - w * 0.45)}" y="{fmt(base - h * 0.86)}" width="{fmt(w * 0.9)}" height="{fmt(h * 0.05)}" rx="1" fill="{line}"/>')
    out.append(f'<rect x="{fmt(x - w * 0.3)}" y="{fmt(base - h * 0.98)}" width="{fmt(w * 0.6)}" height="{fmt(h * 0.12)}" rx="2" fill="{lamp}"/>')
    out.append(path(poly([(x - w * 0.4, base - h * 0.98), (x, base - h * 1.08), (x + w * 0.4, base - h * 0.98)]), fill=line))
    return ''.join(out)


def mountain(x, base, h, w, fill, snow, seed=0):
    pts = jitter([(x - w / 2, base), (x - w * 0.18, base - h * 0.7), (x, base - h), (x + w * 0.2, base - h * 0.62), (x + w / 2, base)], 1.2, seed)
    s = path(poly(pts), fill=fill)
    if snow:
        s += path(poly([(x - w * 0.09, base - h * 0.76), (x, base - h), (x + w * 0.11, base - h * 0.74), (x + w * 0.04, base - h * 0.7), (x - w * 0.03, base - h * 0.76)]), fill=snow)
    return s


def cloud(x, y, w, fill, op=1):
    pts = [(x - w / 2, y), (x - w * 0.3, y - w * 0.22), (x - w * 0.05, y - w * 0.3), (x + w * 0.22, y - w * 0.2), (x + w / 2, y)]
    return path(smooth(pts, close=True, t=1.1), fill=fill, op=op)


def boat(x, y, s, hull, sail):
    return (path(poly([(x - s, y), (x + s, y), (x + s * 0.7, y + s * 0.45), (x - s * 0.7, y + s * 0.45)]), fill=hull) +
            path(f'M{fmt(x)} {fmt(y)}V{fmt(y - s * 1.4)}', stroke=hull, w=1.6) +
            path(poly([(x + s * 0.08, y - s * 1.35), (x + s * 0.95, y - s * 0.1), (x + s * 0.08, y - s * 0.1)]), fill=sail))


def waves(x0, x1, y, n, color, seed=0, step=10, amp=3):
    r = R(seed)
    out = []
    for i in range(n):
        x = r.uniform(x0, x1)
        yy = y + r.uniform(-8, 8)
        out.append(path(f'M{fmt(x)} {fmt(yy)}q{step / 2} {-amp} {step} 0t{step} 0', stroke=color, w=1.8, op=0.9))
    return ''.join(out)


# ---------- 場景 ----------
def bg_home(theme):
    P = PAGE[theme]
    w, h = 390, 220
    b = []
    b.append(f'<rect width="{w}" height="{h}" fill="{P["bg2"]}"/>')
    # 天：淺一點的一片，左上留給文字
    b.append(path(smooth([(0, 0), (w, 0), (w, 150), (300, 142), (200, 154), (100, 144), (0, 156)], close=True, t=0.8), fill=P['bg']))
    b.append(cloud(300, 84, 70, P['cloud'], op=0.9 if theme == 'light' else 0.8))
    b.append(cloud(352, 108, 44, P['cloud'], op=0.7))
    if theme == 'light':
        b.append(circle(336, 66, 14, P['honey']))
    else:
        b.append(moon(336, 66, 13, NIGHT['dark']['moon'], P['bg']))
    # 遠山、中丘、近地
    b.append(path(hills(0, w, 172, 150, 7, 11, bottom=h), fill=P['land3'], op=0.55))
    b.append(path(hills(0, w, 190, 172, 6, 12, bottom=h), fill=P['land2']))
    b.append(path(hills(0, w, 210, 196, 8, 13, bottom=h), fill=P['land']))
    # 遠處樹叢
    for i, x in enumerate([24, 46, 62, 330, 352, 372]):
        b.append(pine_tree(x, 182 + (i % 3) * 3, 26 + (i % 2) * 8, 16, P['pine2'], P['trunk'], seed=20 + i))
    b.append(round_tree(380, 196, 30, 26, P['pine'], P['trunk'], seed=31))
    # 營地：帳篷、旗、營火、兩頂小帳
    b.append(tent(236, 208, 60, 46, P['coral'], P['ink'] if theme == 'light' else '#07100D', P['bg'], seed=40))
    b.append(tent(176, 210, 40, 30, P['mint'] if theme == 'light' else P['land3'], P['pine'], P['bg'], seed=41))
    b.append(tent(306, 210, 44, 34, P['honey'], P['ink'] if theme == 'light' else '#07100D', P['bg'], seed=42))
    b.append(flagpole(272, 208, 56, P['pine'], P['trunk']))
    b.append(campfire(130, 210, 10, P['trunk'], P['honey'], P['coral']))
    # 小徑
    b.append(path(f'M{0} 218q90 -12 150 -6t120 -10 120 4', stroke=P['road'], w=4, op=0.9))
    return svg(w, h, ''.join(b))


def bg_guild(theme):
    P = PAGE[theme]
    w, h = 390, 180
    b = [f'<rect width="{w}" height="{h}" fill="{P["bg2"]}"/>']
    b.append(path(smooth([(0, 0), (w, 0), (w, 126), (260, 122), (130, 130), (0, 124)], close=True, t=0.8), fill=P['bg']))
    b.append(cloud(80, 70, 64, P['cloud'], op=0.85))
    b.append(cloud(318, 82, 54, P['cloud'], op=0.75))
    b.append(path(hills(0, w, 152, 130, 7, 51, bottom=h), fill=P['land2']))
    b.append(path(hills(0, w, 170, 158, 9, 52, bottom=h), fill=P['land']))
    for i, x in enumerate([18, 36, 356, 376]):
        b.append(pine_tree(x, 154 + (i % 2) * 4, 28, 18, P['pine2'], P['trunk'], seed=60 + i))
    # 一排帳篷與中央大旗
    cols = [P['coral'], P['honey'], P['mint'] if theme == 'light' else P['land3'], P['coral'], P['honey']]
    for i, x in enumerate([92, 150, 240, 298, 350]):
        b.append(tent(x, 172 - (i % 2) * 4, 34 + (i % 2) * 8, 26 + (i % 2) * 6, cols[i], P['ink'] if theme == 'light' else '#07100D', P['bg'], seed=70 + i))
    b.append(flagpole(196, 172, 56, P['pine'], P['trunk']))
    b.append(path('M150 138q46 12 92 0', stroke=P['pine'], w=1.6, op=0.8))
    for i in range(7):
        x = 156 + i * 13
        b.append(path(poly([(x, 138 + (3 if i % 2 else 1)), (x + 6, 138 + (3 if i % 2 else 1)), (x + 3, 146)]), fill=[P['coral'], P['honey'], P['pine']][i % 3]))
    b.append(campfire(196, 176, 8, P['trunk'], P['honey'], P['coral']))
    return svg(w, h, ''.join(b))


def bg_dungeon(theme):
    N = NIGHT[theme]
    w, h = 390, 200
    b = [f'<rect width="{w}" height="{h}" fill="{N["n1"]}"/>']
    b.append(stars(w, h, 26, 101, N['star'], ymax=90, op=0.5))
    # 三層林：遠（淡）、中、近（深），文字在左上，怪在右上，所以樹往下、往兩側
    far = ''.join(pine_tree(x, 156, 44 + (i % 3) * 8, 26, N['n2'], N['n2'], seed=110 + i) for i, x in enumerate(range(-10, 420, 30)))
    b.append(far)
    mid = ''.join(pine_tree(x, 184, 70 + (i % 2) * 12, 36, N['n3'], N['n2'], seed=130 + i) for i, x in enumerate([-6, 36, 80, 310, 352, 392]))
    b.append(mid)
    # 霧帶
    b.append(path(smooth([(0, 150), (60, 142), (140, 152), (230, 144), (320, 152), (390, 146), (390, 176), (0, 176)], close=True, t=0.9), fill=N['on'], op=0.07))
    # 燈籠光
    b.append(circle(330, 170, 34, N['honey'], op=0.14))
    b.append(path('M330 142v8', stroke=N['honey'], w=1.6))
    b.append(f'<rect x="322" y="150" width="16" height="20" rx="5" fill="{N["honey"]}"/>')
    b.append(f'<rect x="326" y="154" width="8" height="12" rx="3" fill="{N["coral"]}"/>')
    near = ''.join(pine_tree(x, 214, 96, 50, N['n0'], N['n0'], seed=150 + i) for i, x in enumerate([-14, 404]))
    b.append(near)
    # 地面與小徑
    b.append(path(hills(0, w, 200, 188, 8, 161, bottom=h), fill=N['n0']))
    b.append(path('M120 200q60-14 120-6t90-10', stroke=N['n3'], w=3, op=0.8))
    # 幾顆螢火
    for i, (x, y) in enumerate([(60, 130), (96, 112), (210, 124), (262, 108), (160, 96)]):
        b.append(circle(x, y, 1.8 + (i % 2), N['honey'], op=0.7))
    return svg(w, h, ''.join(b))


def bg_wall(theme):
    N = NIGHT[theme]
    w, h = 390, 220
    b = [f'<rect width="{w}" height="{h}" fill="{N["n1"]}"/>']
    b.append(stars(w, h, 46, 201, N['star'], ymax=150, op=0.6))
    b.append(moon(52, 44, 16, N['moon'], N['n1']))
    # 遠山剪影與山谷
    b.append(path(hills(0, w, 150, 100, 6, 211, bottom=h), fill=N['n2'], op=0.9))
    b.append(path(hills(0, w, 176, 140, 7, 212, bottom=h), fill=N['n0'], op=0.9))
    # 舞台：一塊圓弧草地，夥伴站在上面
    b.append(path(smooth([(40, 220), (90, 186), (195, 176), (300, 186), (350, 220)], close=True, t=0.9), fill=N['n3']))
    b.append(path(smooth([(80, 220), (120, 200), (195, 194), (270, 200), (310, 220)], close=True, t=0.9), fill=N['n4'], op=0.6))
    # 兩盞燈籠柱
    for x in [70, 320]:
        b.append(path(f'M{x} 212V170', stroke=N['n4'], w=2.2))
        b.append(circle(x, 166, 10, N['honey'], op=0.18))
        b.append(f'<rect x="{x - 5}" y="{160}" width="10" height="13" rx="3" fill="{N["honey"]}"/>')
    # 幾棵近樹
    b.append(pine_tree(18, 214, 70, 34, N['n0'], N['n0'], seed=221))
    b.append(pine_tree(378, 214, 62, 30, N['n0'], N['n0'], seed=222))
    return svg(w, h, ''.join(b))


def bg_tower(theme):
    N = NIGHT[theme]
    w, h = 390, 220
    b = [f'<rect width="{w}" height="{h}" fill="{N["n1"]}"/>']
    b.append(stars(w, h, 40, 301, N['star'], ymax=120, op=0.55))
    b.append(moon(338, 40, 13, N['moon'], N['n1']))
    # 海：水平線在 160，波
    b.append(f'<rect x="0" y="158" width="{w}" height="{h - 158}" fill="{N["water"]}"/>')
    b.append(waves(10, 380, 180, 12, N['water2'], seed=311, step=14, amp=3))
    b.append(waves(10, 380, 204, 9, N['water2'], seed=312, step=16, amp=3))
    # 左崖與燈塔，右小島；中央留白給文字
    b.append(path(smooth([(-10, 220), (-10, 150), (30, 138), (70, 142), (96, 152), (112, 170), (104, 220)], close=True, t=0.9), fill=N['n0']))
    b.append(lighthouse(46, 142, 66, N['coral'], N['on'], N['moon'], N['n0'], glow=N['honey']))
    b.append(path(smooth([(330, 220), (334, 170), (356, 160), (384, 164), (402, 180), (404, 220)], close=True, t=0.9), fill=N['n0']))
    b.append(pine_tree(360, 164, 26, 14, N['n2'], N['n0'], seed=321))
    b.append(boat(250, 192, 9, N['n0'], N['on']))
    # 月光在水面
    b.append(path('M326 168h24M322 176h30M330 184h18', stroke=N['moon'], w=1.6, op=0.35))
    return svg(w, h, ''.join(b))


def bg_capture(theme):
    N = NIGHT[theme]
    w, h = 390, 844
    b = [f'<rect width="{w}" height="{h}" fill="{N["n0"]}"/>']
    # 放射光（低透明）從舞台中心 (195, 360)
    cx, cy = 195, 360
    for i in range(12):
        a = i * 30
        b.append(f'<path d="M{cx} {cy}l{fmt(900 * __import__("math").cos(__import__("math").radians(a - 6)))} {fmt(900 * __import__("math").sin(__import__("math").radians(a - 6)))}'
                 f'L{fmt(cx + 900 * __import__("math").cos(__import__("math").radians(a + 6)))} {fmt(cy + 900 * __import__("math").sin(__import__("math").radians(a + 6)))}Z" fill="{N["honey"]}" opacity="0.045"/>')
    b.append(circle(cx, cy, 150, N['honey'], op=0.06))
    b.append(stars(w, h, 90, 401, N['star'], ymax=640, op=0.7))
    b.append(moon(330, 110, 18, N['moon'], N['n0']))
    # 漂浮島：舞台在中段，上面有草地與兩棵樹；底下更多遠島
    b.append(path(smooth([(60, 470), (110, 452), (195, 446), (280, 452), (330, 470), (300, 520), (240, 548), (195, 556), (150, 548), (90, 520)], close=True, t=0.9), fill=N['n2']))
    b.append(path(smooth([(70, 470), (120, 456), (195, 450), (270, 456), (320, 470), (280, 486), (195, 492), (110, 486)], close=True, t=0.9), fill=N['n4'], op=0.7))
    b.append(pine_tree(96, 466, 44, 22, N['n3'], N['n2'], seed=411))
    b.append(pine_tree(300, 464, 36, 18, N['n3'], N['n2'], seed=412))
    b.append(path(smooth([(-20, 700), (40, 672), (130, 664), (190, 676), (230, 700), (180, 740), (90, 752), (20, 740)], close=True, t=0.9), fill=N['n1']))
    b.append(path(smooth([(240, 760), (300, 730), (380, 724), (420, 750), (400, 800), (320, 812), (250, 796)], close=True, t=0.9), fill=N['n1']))
    b.append(pine_tree(120, 672, 36, 18, N['n2'], N['n1'], seed=421))
    b.append(pine_tree(340, 732, 30, 16, N['n2'], N['n1'], seed=422))
    # 近景黑丘
    b.append(path(hills(0, w, 844, 790, 8, 431, bottom=h), fill=N['n0']))
    return svg(w, h, ''.join(b))


# ---------- 大陸地圖（viewBox 440×420） ----------
COAST = [(90, 130), (128, 84), (190, 52), (258, 48), (318, 68), (360, 108), (378, 168), (368, 238), (334, 298),
         (302, 340), (252, 372), (190, 374), (140, 352), (100, 302), (80, 232), (76, 180)]


def continent(theme, feature):
    """feature(P, b) 加上各大陸自己的地貌；共用海、海岸、沙灘。"""
    P = PAGE[theme]
    w, h = 440, 420
    b = [f'<rect width="{w}" height="{h}" fill="{P["sea"]}"/>']
    # 淺水圈、沙灘、陸地
    b.append(path(smooth([(x + (x - 228) * 0.08, y + (y - 212) * 0.08) for x, y in COAST], close=True, t=0.9), fill=P['sea2']))
    b.append(path(smooth([(x + (x - 228) * 0.08, y + (y - 212) * 0.08) for x, y in COAST], close=True, t=0.9), fill='none', stroke=P['seal'], w=1.2, op=0.8))
    b.append(path(smooth(COAST, close=True, t=0.9), fill=P['sand']))
    b.append(path(smooth([(x - (x - 228) * 0.035, y - (y - 212) * 0.035) for x, y in COAST], close=True, t=0.9), fill=P['land'], stroke=P['edge'], w=1.4))
    # 海上：波、船、羅盤
    b.append(waves(8, 432, 36, 10, P['seal'], seed=511, step=12, amp=3))
    b.append(waves(8, 432, 396, 9, P['seal'], seed=512, step=12, amp=3))
    b.append(waves(380, 432, 300, 5, P['seal'], seed=513, step=12, amp=3))
    b.append(waves(8, 70, 280, 5, P['seal'], seed=514, step=12, amp=3))
    b.append(boat(46, 92, 9, P['ink'], P['coral']))
    b.append(boat(404, 356, 8, P['ink'], P['honey']))
    b.append(circle(400, 60, 20, P['bg'], op=0.9, stroke=P['seal'], w=1.4))
    b.append(path(poly([(400, 42), (405, 60), (400, 78), (395, 60)]), fill=P['coral']))
    b.append(path(poly([(382, 60), (400, 55), (418, 60), (400, 65)]), fill=P['ink'], op=0.7))
    b.append(circle(400, 60, 2.4, P['bg']))
    feature(P, b)
    return svg(w, h, ''.join(b))


def map_math_features(P, b):
    # 乘法平原 (161,190)：田畦與小屋；多項式林 (266,165)：樹叢；根號谷 (351,230)：V 谷與河
    for i, y in enumerate([150, 162, 174, 232, 244]):
        b.append(path(f'M{104 + i * 2} {y}h{60 - i * 3}', stroke=P['land3'], w=2.4, op=0.9))
    for i, y in enumerate([150, 162, 174]):
        b.append(path(f'M{190 - i * 3} {y}h{34 + i * 2}', stroke=P['land3'], w=2.4, op=0.9))
    b.append(path(poly([(112, 214), (112, 204), (120, 198), (128, 204), (128, 214)]), fill=P['coral']))
    b.append(path(poly([(108, 205), (120, 195), (132, 205)]), fill=P['ink'], op=0.75))
    for i, (x, y) in enumerate([(226, 120), (246, 110), (268, 116), (290, 112), (308, 126), (236, 140), (298, 146), (318, 150), (224, 196), (304, 198), (288, 206), (242, 206)]):
        b.append(pine_tree(x, y, 18 + (i % 3) * 4, 12, [P['pine2'], P['pine'], P['land3']][i % 3], P['trunk'], seed=600 + i, layers=2))
    b.append(path('M322 192l18 36 20-40', stroke=P['edge'], w=2.4))
    b.append(path('M340 232q6 20-4 36t2 30', stroke=P['sky'], w=2.6, op=0.8))
    b.append(path('M300 268q20-6 36 4', stroke=P['edge'], w=1.6, op=0.7))
    # 畢氏山 (141,315)：山脈；分解洞窟 (251,345)：洞口與石頭；二次高原 (330,350)：台地與霧
    b.append(mountain(104, 296, 44, 50, P['land3'], P['snow'], seed=611))
    b.append(mountain(132, 280, 58, 56, P['edge'], P['snow'], seed=612))
    b.append(mountain(176, 292, 40, 46, P['land3'], P['snow'], seed=613))
    b.append(mountain(108, 356, 30, 40, P['land3'], None, seed=614))
    b.append(mountain(176, 356, 26, 36, P['land3'], None, seed=615))
    b.append(path('M226 322a26 20 0 0 1 52 0z', fill=P['edge']))
    b.append(path('M236 322a16 12 0 0 1 32 0z', fill=P['ink'] if P['bg'] == '#F6F4EE' else '#07100D'))
    for i, (x, y) in enumerate([(214, 364), (292, 362), (268, 376)]):
        b.append(circle(x, y, 4 + (i % 2) * 2, P['rock']))
    b.append(path(poly([(296, 320), (312, 304), (352, 304), (368, 320)]), fill=P['land3'], op=0.85))
    b.append(path('M312 304h40', stroke=P['edge'], w=1.6))
    for i, (x, y, r) in enumerate([(306, 332, 28), (346, 326, 30), (334, 372, 26), (362, 356, 22)]):
        b.append(f'<ellipse cx="{x}" cy="{y}" rx="{r}" ry="{r * 0.5}" fill="{P["fog"]}" opacity="0.85"/>')
    # 村落、小湖、崖線
    for i, (x, y) in enumerate([(196, 236), (208, 230), (186, 246)]):
        b.append(path(poly([(x - 6, y + 8), (x - 6, y), (x, y - 6), (x + 6, y), (x + 6, y + 8)]), fill=[P['honey'], P['coral'], P['honey']][i]))
    b.append(f'<ellipse cx="232" cy="262" rx="20" ry="11" fill="{P["sea2"]}" stroke="{P["seal"]}" stroke-width="1.2"/>')
    b.append(path('M98 250q20-10 40 0M94 262q24-10 48 0', stroke=P['edge'], w=1.4, op=0.6))
    for i, (x, y) in enumerate([(120, 128), (146, 112), (168, 124), (330, 170), (350, 184), (366, 206)]):
        b.append(pine_tree(x, y, 14 + (i % 2) * 4, 10, [P['pine2'], P['land3']][i % 2], P['trunk'], seed=620 + i, layers=2))
    # 區域之間的路
    b.append(path('M161 212q30-20 70-30M266 190q40 10 70 30M161 212q-10 50-20 80M251 320q-40-30-60-100M330 326q-30-20-60-100', stroke=P['road'], w=2.4, op=0.9, extra='stroke-dasharray="5 6"'))


def map_en_features(P, b):
    # 西風港：港灣、碼頭、燈塔、風車、船
    b.append(path(smooth([(120, 150), (160, 140), (200, 150), (210, 190), (180, 212), (140, 204), (116, 180)], close=True, t=0.9), fill=P['sea2']))
    b.append(path('M150 198h60M164 180h40', stroke=P['trunk'], w=3))
    for x in [152, 164, 176, 188, 200]:
        b.append(path(f'M{x} 196v8', stroke=P['trunk'], w=2))
    b.append(boat(176, 166, 9, P['ink'], P['coral']))
    b.append(lighthouse(112, 160, 40, P['coral'], P['bg'], P['honey'], P['ink']))
    for i, x in enumerate([300, 330]):
        b.append(path(f'M{x} 150v-26', stroke=P['trunk'], w=2.4))
        b.append(path(f'M{x} 124l-10-10M{x} 124l10-10M{x} 124l-10 10M{x} 124l10 10', stroke=P['pine'], w=2.2))
    for i, (x, y) in enumerate([(250, 110), (270, 100), (292, 112), (230, 130), (320, 90)]):
        b.append(round_tree(x, y, 24, 22, [P['pine2'], P['pine'], P['land3']][i % 3], P['trunk'], seed=700 + i))
    for i, y in enumerate([290, 302, 314]):
        b.append(path(f'M{120 + i * 3} {y}h{70}', stroke=P['land3'], w=2.4))
    b.append(mountain(300, 330, 50, 56, P['edge'], P['snow'], seed=711))
    b.append(mountain(340, 338, 36, 44, P['land3'], P['snow'], seed=712))
    b.append(path('M200 200q40 40 60 100M200 200q50-40 110-40', stroke=P['road'], w=2.4, op=0.9, extra='stroke-dasharray="5 6"'))


def map_zh_features(P, b):
    # 字林：密林、竹、書院、小橋流水
    for i, (x, y) in enumerate([(120, 150), (140, 134), (166, 146), (190, 130), (214, 144), (244, 126), (270, 142), (296, 130), (322, 150), (150, 170), (200, 176), (260, 182), (300, 176), (340, 190)]):
        b.append(pine_tree(x, y, 22 + (i % 3) * 5, 14, [P['pine2'], P['pine'], P['land3']][i % 3], P['trunk'], seed=800 + i, layers=2))
    for i, x in enumerate([112, 122, 132]):
        b.append(path(f'M{x} 300v-44', stroke=P['pine2'], w=2.4))
        b.append(path(f'M{x - 6} {272 - i * 6}l6 2M{x + 6} {262 - i * 4}l-6 2', stroke=P['pine2'], w=1.8))
    b.append(path(poly([(226, 318), (226, 300), (258, 290), (290, 300), (290, 318)]), fill=P['coral']))
    b.append(path(poly([(218, 302), (258, 284), (298, 302), (290, 304), (258, 290), (226, 304)]), fill=P['ink'], op=0.75))
    b.append(path('M150 240q60 20 120 0t110 10', stroke=P['sky'], w=2.6, op=0.8))
    b.append(path('M210 234q10-10 20 0', stroke=P['trunk'], w=2.6))
    b.append(path('M330 300q20 20 10 50', stroke=P['road'], w=2.4, op=0.9, extra='stroke-dasharray="5 6"'))
    b.append(mountain(150, 356, 34, 44, P['land3'], None, seed=811))


def map_soc_features(P, b):
    # 時光古道：蜿蜒的道、石門、碑、年輪般的台地、經緯線
    for y in [120, 200, 280, 360]:
        b.append(path(f'M70 {y}H380', stroke=P['seal'], w=1.2, op=0.7, extra='stroke-dasharray="2 5"'))
    for x in [140, 230, 320]:
        b.append(path(f'M{x} 60V380', stroke=P['seal'], w=1.2, op=0.7, extra='stroke-dasharray="2 5"'))
    b.append(path('M110 150q60-30 110 0t90 60q30 50-10 90t-110 40', stroke=P['road'], w=4.2, op=0.95))
    for x, y in [(120, 146), (300, 212), (260, 330)]:
        b.append(path(poly([(x - 10, y + 10), (x - 10, y - 8), (x - 4, y - 12), (x + 4, y - 12), (x + 10, y - 8), (x + 10, y + 10)]), fill=P['rock']))
        b.append(path(poly([(x - 5, y + 10), (x - 5, y - 4), (x + 5, y - 4), (x + 5, y + 10)]), fill=P['bg']))
    for i, (x, y) in enumerate([(200, 120), (340, 150), (160, 230), (220, 270)]):
        b.append(path(f'M{x - 3} {y + 10}v-20h6v20z', fill=P['edge']))
        b.append(path(f'M{x - 6} {y + 10}h12', stroke=P['edge'], w=2))
    for i, r in enumerate([30, 22, 14]):
        b.append(f'<ellipse cx="150" cy="330" rx="{r}" ry="{r * 0.5}" fill="{[P["land3"], P["land2"], P["land"]][i]}" stroke="{P["edge"]}" stroke-width="1.2"/>')
    for i, (x, y) in enumerate([(300, 300), (330, 330), (360, 300)]):
        b.append(round_tree(x, y, 22, 20, [P['pine2'], P['pine']][i % 2], P['trunk'], seed=900 + i))


# ---------- 人物（64×64）：頭加圓肩、無五官；每位一個剪影特徵 ----------
def kid(color, variant, dark=False):
    ink = '#0D2B26' if not dark else '#EAF1EE'
    body = f'<path d="M8 62c2-16 12-24 24-24s22 8 24 24z" fill="{color}"/>'
    head = f'<circle cx="32" cy="25" r="14" fill="{color}"/>'
    deco = {
        1: f'<path d="M18 24q14-18 28 0" fill="none" stroke="{ink}" stroke-width="3" stroke-linecap="round" opacity=".25"/>',  # 短髮弧
        2: f'<path d="M20 20a12 12 0 0 1 24 0v8h-6v-6h-12v6h-6z" fill="{ink}" opacity=".22"/>',  # 中分
        3: f'<circle cx="32" cy="10" r="4.5" fill="{ink}" opacity=".25"/><path d="M19 22q13-8 26 0" fill="none" stroke="{ink}" stroke-width="3" stroke-linecap="round" opacity=".25"/>',  # 丸子頭
        4: f'<path d="M16 24q3-16 16-16t16 16" fill="none" stroke="{ink}" stroke-width="5" stroke-linecap="round" opacity=".2"/><path d="M44 22l6 14" stroke="{ink}" stroke-width="4" stroke-linecap="round" opacity=".2"/>',  # 馬尾
        5: f'<rect x="17" y="14" width="30" height="6" rx="3" fill="{ink}" opacity=".25"/><rect x="22" y="6" width="20" height="10" rx="4" fill="{ink}" opacity=".25"/>',  # 帽子
        6: f'<path d="M18 26q0-16 14-16t14 16q-4-6-14-6t-14 6z" fill="{ink}" opacity=".22"/>',  # 捲髮
    }[variant]
    return svg(64, 64, body + head + deco)


def guide(theme):
    P = PAGE[theme]
    body = f'<path d="M8 62c2-16 12-24 24-24s22 8 24 24z" fill="{P["pine"]}"/>'
    head = f'<circle cx="30" cy="23" r="13" fill="{P["mint"] if theme == "light" else "#DCEFE8"}"/>'
    scarf = f'<path d="M18 38q12 8 24 0l2 8q-14 6-28 0z" fill="{P["coral"]}"/>'
    lantern = (f'<path d="M52 30v6" stroke="{P["trunk"]}" stroke-width="2" stroke-linecap="round"/>'
               f'<rect x="46" y="36" width="12" height="16" rx="4" fill="{P["honey"]}"/><rect x="49" y="40" width="6" height="8" rx="2" fill="{P["coral"]}"/>')
    return svg(64, 64, body + head + scarf + lantern)


def patrol(theme):
    P = PAGE[theme]
    body = f'<path d="M8 62c2-16 12-24 24-24s22 8 24 24z" fill="{P["sky"]}"/>'
    head = f'<circle cx="32" cy="25" r="13" fill="{P["mint"] if theme == "light" else "#DCEFE8"}"/>'
    cap = f'<path d="M18 22a14 14 0 0 1 28 0z" fill="{P["ink"] if theme == "light" else "#0D2B26"}"/><rect x="16" y="20" width="32" height="5" rx="2.5" fill="{P["ink"] if theme == "light" else "#0D2B26"}"/>'
    badge = f'<path d="M32 44l4 3-1 5h-6l-1-5z" fill="{P["honey"]}"/>'
    return svg(64, 64, body + head + cap + badge)


# ---------- 其他大陸的九隻怪（symbol，同 v2 的 CSS 變數） ----------
S = 'fill="none" stroke="var(--m-feat)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"'


def eyes(lx, ly, rx, ry, r=5.6, pr=2.5):
    return (f'<circle fill="var(--m-eye)" cx="{lx}" cy="{ly}" r="{r}"/><circle fill="var(--m-eye)" cx="{rx}" cy="{ry}" r="{r}"/>'
            f'<circle fill="var(--m-pupil)" cx="{lx + .8}" cy="{ly + .9}" r="{pr}"/><circle fill="var(--m-pupil)" cx="{rx + .8}" cy="{ry + .9}" r="{pr}"/>')


MON2 = {
    # 英文：時光獸（時態）、失蹤的 s（第三人稱單數）、介係詞迷路怪
    'm2-clock': '<circle fill="var(--m-body)" cx="32" cy="34" r="22"/>' + f'<path {S} d="M32 34V20M32 34l9 6"/>' + eyes(24, 28, 40, 28, 4.6, 2) + f'<path {S} d="M26 44q6 4 12 0"/>',
    'm2-snake': '<path fill="var(--m-body)" d="M18 14c14 0 22 6 22 14s-10 8-16 14 4 14 16 14" stroke="var(--m-body)" stroke-width="12" stroke-linecap="round" fill-opacity="0"/>' + eyes(16, 14, 24, 14, 4.2, 1.9) + f'<path {S} d="M18 22q4 3 8 0"/>',
    'm2-arrow': '<path fill="var(--m-body)" d="M12 36l20-24 20 24h-12v16H24V36z"/>' + eyes(26, 34, 38, 34, 4.6, 2) + f'<path {S} d="M27 44l5-4 5 4"/>' + f'<path {S} d="M8 20l6-6M56 20l-6-6"/>',
    # 國文：音近字妖、之乎迷霧、修辭變臉怪
    'm2-twin': '<rect fill="var(--m-body)" x="8" y="18" width="22" height="30" rx="8"/><rect fill="var(--m-body)" x="34" y="18" width="22" height="30" rx="8"/>' + eyes(19, 30, 45, 30, 4.4, 2) + f'<path {S} d="M15 40h8M41 40h8"/>' + f'<path {S} d="M30 33h4"/>',
    'm2-mist': '<path fill="var(--m-body)" d="M10 44q0-18 14-18 4-12 16-10t12 12q10 2 8 14H10z"/>' + eyes(26, 36, 40, 36, 4.6, 2) + f'<path {S} d="M27 46q6 3 12 0"/>' + f'<path {S} d="M12 20q6-4 12 0M40 16q6-4 12 0"/>',
    'm2-mask': '<circle fill="var(--m-body)" cx="32" cy="34" r="22"/>' + '<path fill="var(--m-feat)" opacity=".35" d="M32 12a22 22 0 0 1 0 44z"/>' + eyes(23, 32, 41, 32, 5, 2.2) + f'<path {S} d="M22 44q5 5 10 0M34 44q5-5 10 0"/>',
    # 社會：年代錯置怪、因果顛倒獸、經緯迷航
    'm2-hourglass': '<path fill="var(--m-body)" d="M16 8h32l-12 24 12 24H16l12-24z"/>' + eyes(26, 20, 38, 20, 4.2, 1.9) + f'<path {S} d="M28 50h8"/>' + f'<path {S} d="M12 56h40M12 8h40"/>',
    'm2-flip': '<path fill="var(--m-body)" d="M10 34a22 22 0 0 1 44 0z"/><path fill="var(--m-body)" d="M14 36h36l-6 16H20z"/>' + eyes(24, 28, 40, 28, 4.6, 2) + f'<path {S} d="M26 44q6-4 12 0"/>' + f'<path {S} d="M6 36h8M50 36h8"/>',
    'm2-compass': '<circle fill="var(--m-body)" cx="32" cy="34" r="22"/>' + f'<path {S} d="M32 14l6 20-6 20-6-20z"/>' + '<circle fill="var(--m-feat)" cx="32" cy="34" r="3.5"/>' + eyes(20, 26, 44, 26, 4, 1.8),
}


Q2 = '<text fill="var(--m-q)" font-family="Outfit,sans-serif" font-weight="700" font-size="26" text-anchor="middle" x="32" y="46">?</text>'


def monsters_defs_2():
    out = ['<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display:none">',
           '<!-- 其他大陸九隻怪（第一版，由 _src/scenes.py 產生）：英文三、國文三、社會三；顏色走 CSS 變數 -->']
    for k, v in MON2.items():
        out.append(f'<symbol id="{k}" viewBox="0 0 64 64">{v}{Q2}</symbol>')
    out.append('</svg>\n')
    return '\n'.join(out)


ART_CSS = """/* 美術接線（第一版，由 _src/scenes.py 產生）：[data-art] 在 art/manifest.json 存在時由 app.js 開啟 */
[data-art] .home-top{min-height:176px;align-items:flex-start;padding:14px 14px 12px;border-radius:var(--r-lg);background-image:url(bg-home.svg);background-size:cover;background-position:center bottom;overflow:hidden}
[data-art] .guild-hero{min-height:150px;align-items:start;padding:12px 14px;border-radius:var(--r-lg);background-image:url(bg-guild.svg);background-size:cover;background-position:center bottom;overflow:hidden}
[data-art] .dg-hero{background-image:url(bg-dungeon.svg);background-size:cover;background-position:center bottom;min-height:150px}
[data-art] .dg-hero .fogbg{display:none}
[data-art] .wall{background-image:url(bg-wall.svg);background-size:cover;background-position:center bottom}
[data-art] .wall .stars{display:none}
[data-art] .tower-hero{background-image:url(bg-tower.svg);background-size:cover;background-position:center bottom;min-height:168px;padding-top:28px}
[data-art] .capture{background-image:url(bg-capture.svg);background-size:cover;background-position:center}
[data-art] .capture .sky,[data-art] .capture .stars{display:none}
[data-art] .map .terrain{display:none}
[data-art] .map .art-map.light{display:block}
[data-art] .map .beam{opacity:.12}
[data-art] .map .rl{stroke:none;paint-order:normal}
[data-art] .map .cn,[data-art] .map .cs{paint-order:stroke;stroke:var(--sea);stroke-width:4px;stroke-linejoin:round}
/* 人物：六色隊員、嚮導、巡查員 */
[data-art] .kid svg{display:none}
[data-art] .kid{background:url(kid-1.svg) center/contain no-repeat;display:inline-block}
[data-art] .kid.k2{background-image:url(kid-2.svg)} [data-art] .kid.k3{background-image:url(kid-3.svg)} [data-art] .kid.k4{background-image:url(kid-4.svg)} [data-art] .kid.k5{background-image:url(kid-5.svg)} [data-art] .kid.k6{background-image:url(kid-6.svg)}
[data-art] .kid.guide{background-image:url(guide.svg)} [data-art] .kid.patrol{background-image:url(patrol.svg)}
/* 深色 */
@media (prefers-color-scheme: dark){
  [data-art]:not([data-theme="light"]) .home-top{background-image:url(bg-home-dark.svg)}
  [data-art]:not([data-theme="light"]) .guild-hero{background-image:url(bg-guild-dark.svg)}
  [data-art]:not([data-theme="light"]) .dg-hero{background-image:url(bg-dungeon-dark.svg)}
  [data-art]:not([data-theme="light"]) .wall{background-image:url(bg-wall-dark.svg)}
  [data-art]:not([data-theme="light"]) .tower-hero{background-image:url(bg-tower-dark.svg)}
  [data-art]:not([data-theme="light"]) .capture{background-image:url(bg-capture-dark.svg)}
  [data-art]:not([data-theme="light"]) .map .art-map.light{display:none}
  [data-art]:not([data-theme="light"]) .map .art-map.dark{display:block}
  [data-art]:not([data-theme="light"]) .map .beam{opacity:.07}
  [data-art]:not([data-theme="light"]) .kid.guide{background-image:url(guide-dark.svg)} [data-art]:not([data-theme="light"]) .kid.patrol{background-image:url(patrol-dark.svg)}
}
[data-art][data-theme="dark"] .home-top{background-image:url(bg-home-dark.svg)}
[data-art][data-theme="dark"] .guild-hero{background-image:url(bg-guild-dark.svg)}
[data-art][data-theme="dark"] .dg-hero{background-image:url(bg-dungeon-dark.svg)}
[data-art][data-theme="dark"] .wall{background-image:url(bg-wall-dark.svg)}
[data-art][data-theme="dark"] .tower-hero{background-image:url(bg-tower-dark.svg)}
[data-art][data-theme="dark"] .capture{background-image:url(bg-capture-dark.svg)}
[data-art][data-theme="dark"] .map .art-map.light{display:none}
[data-art][data-theme="dark"] .map .art-map.dark{display:block}
[data-art][data-theme="dark"] .map .beam{opacity:.07}
[data-art][data-theme="dark"] .kid.guide{background-image:url(guide-dark.svg)} [data-art][data-theme="dark"] .kid.patrol{background-image:url(patrol-dark.svg)}
@media (prefers-reduced-transparency: reduce){[data-art] .home-top,[data-art] .guild-hero{background-image:none}}
"""


def write(name, content):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        f.write(content)


if __name__ == '__main__':
    for theme, suf in (('light', ''), ('dark', '-dark')):
        write(f'bg-home{suf}.svg', bg_home(theme))
        write(f'bg-guild{suf}.svg', bg_guild(theme))
        write(f'bg-dungeon{suf}.svg', bg_dungeon(theme))
        write(f'bg-wall{suf}.svg', bg_wall(theme))
        write(f'bg-tower{suf}.svg', bg_tower(theme))
        write(f'bg-capture{suf}.svg', bg_capture(theme))
        write(f'map-math{suf}.svg', continent(theme, map_math_features))
        write(f'map-en{suf}.svg', continent(theme, map_en_features))
        write(f'map-zh{suf}.svg', continent(theme, map_zh_features))
        write(f'map-soc{suf}.svg', continent(theme, map_soc_features))
        write(f'guide{suf}.svg', guide(theme))
        write(f'patrol{suf}.svg', patrol(theme))
    for i, c in enumerate(['#DCEFE8', '#F9D3C9', '#FBE7B2', '#C9DDF8', '#DDD2F6', '#CFEBDD'], start=1):
        write(f'kid-{i}.svg', kid(c, i))
    write('monsters-defs-2.svg', monsters_defs_2())
    write('art.css', ART_CSS)
    write('manifest.json', '{"version":"1","source":"first-pass by _src/scenes.py; replace with codex output using the same filenames"}\n')
    print('ok')
