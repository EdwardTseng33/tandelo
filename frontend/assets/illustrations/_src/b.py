# 第二批：三個裝置畫面、空畫面、慶祝圓點、小陪四態、商標
from lib import *

def mic(cx, cy, s, col):
    """麥克風線條圖示，s＝一半高度"""
    return (ln('M%s %sv%sa%s %s 0 0 0 %s 0v%sa%s %s 0 0 0 %s 0z' % (n(cx - s * .28), n(cy - s * .55), n(s * .5), n(s * .28), n(s * .28), n(s * .56), n(-s * .5), n(s * .28), n(s * .28), n(-s * .56)), col) +
            ln('M%s %sa%s %s 0 0 0 %s 0M%s %sv%s' % (n(cx - s * .6), n(cy + s * .05), n(s * .6), n(s * .6), n(s * 1.2), n(cx), n(cy + s * .65), n(s * .3)), col))

def classroom_wide(P):
    soft = '#B9D3CB'
    b = rr(20, 20, 1360, 860, 40, P.line) + rr(32, 32, 1336, 836, 30, P.bg)
    # 頂列：連線小點、只錄白板、計時
    b += c(70, 74, 7, P.pine) + bar(88, 68, 86, P.mute, 12)
    b += rr(196, 57, 156, 34, 17, P.coralsoft) + c(215, 74, 6, P.coral) + bar(230, 69, 104, P.coral, 10)
    b += bar(590, 66, 220, P.ink, 16)
    b += rr(1196, 55, 148, 38, 19, P.surface) + math('32/50', 1220, 63, 22, P.ink)
    # 白板
    b += rr(56, 112, 960, 560, 26, P.board)
    b += bar(100, 150, 170, P.boardmute, 11) + math('-2x + 4 > 10', 100, 190, 58, P.fix) + math('-2x > 6', 100, 286, 58, P.fix)
    b += rr(82, 378, 318, 86, 22, P.boardsoft) + math('x > -3 ?', 100, 392, 58, P.fix)
    b += '<ellipse class="l" cx="185" cy="421" rx="36" ry="38" stroke="%s" transform="rotate(-8 185 421)"/>' % P.coral
    b += ln('M228 398C290 352 372 344 452 372', P.boardpine) + ln('M436 358L453 373L432 380', P.boardpine)
    b += math('x < -3', 476, 352, 52, P.boardpine)
    b += ring(726, 398, 26, P.boardpine) + c(726, 398, 18, P.boardpine)
    b += ln('M110 574H660', P.fix) + ln('M646 564L660 574L646 584', P.fix)
    for i, x in enumerate([170, 270, 370, 470, 570]):
        b += ln('M%d 566V582' % x, P.fix)
    b += rr(118, 570, 150, 8, 4, P.coral) + c(270, 574, 10, P.board) + ring(270, 574, 10, P.coral)
    b += math('-3', 254, 596, 24, P.boardmute) + math('0', 565, 596, 24, P.boardmute)
    b += rr(760, 150, 216, 130, 20, P.boardnote) + bar(782, 174, 80, P.honey, 10) + bar(782, 200, 168, P.boardmute) + bar(782, 220, 132, P.boardmute) + bar(782, 240, 150, P.boardmute)
    b += rr(760, 520, 216, 116, 20, P.boardmint) + duo(790, 548, 11, 6.6, LIGHT) + bar(814, 543, 90, P.boardpine, 9) + bar(782, 576, 170, P.boardmute) + bar(782, 596, 120, P.boardmute)
    # 右欄：老師＋六位隊友
    b += rr(1040, 112, 304, 150, 24, P.night) + person(1118, 142, 40, soft) + bar(1190, 160, 110, P.oat, 12) + bar(1190, 184, 70, soft, 9)
    b += c(1304, 228, 14, P.coral) + mic(1304, 228, 9, P.fix)
    k = 0
    for row in range(3):
        for col in range(2):
            x, y = 1040 + col * 158, 276 + row * 132
            b += rr(x, y, 146, 120, 22, P.a[k]) + '<g opacity=".5">' + person(x + 73, y + 24, 29, P.fix) + '</g>'
            if k == 2:
                b += '<rect x="%d" y="%d" width="146" height="120" rx="22" fill="none" stroke="%s" stroke-width="5"/>' % (x, y, P.coral)
                for j, h in enumerate([10, 20, 14]):
                    b += rr(x + 108 + j * 8, y + 28 - h / 2, 4, h, 2, P.fix)
            if k == 4:
                b += c(x + 120, y + 26, 13, P.honey) + ln('M%d %dv-12M%d %dv-8M%d %dv-8' % (x + 120, y + 32, x + 115, y + 30, x + 125, y + 30), P.fix)
            k += 1
    b += rr(1040, 676, 304, 168, 24, P.surface) + bar(1064, 700, 80, P.mute, 9) + rr(1064, 724, 200, 40, 16, P.sand) + bar(1080, 740, 150, P.mute)
    b += rr(1120, 776, 200, 46, 16, P.mint) + duo(1142, 799, 8, 4.8, P) + bar(1162, 795, 130, P.pine)
    # 六段進度條
    x = 56
    cols = [P.pine, P.pine, P.coral, P.coralsoft, P.coralsoft, P.coralsoft]
    for i, (w, col) in enumerate(zip([5, 10, 10, 5, 15, 5], cols)):
        ww = w * 18.4
        b += rr(x, 692, ww, 24, 12, col) + bar(x + 4, 728, min(ww - 8, 64), P.line if i != 2 else P.coral, 8)
        if i < 2:
            b += check(x + ww / 2 - 1, 705, 4.5, P.oat)
        x += ww + 8
    b += c(330, 704, 6, P.fix)
    # 老師控制列
    b += rr(56, 760, 960, 84, 30, P.surface)
    for i, x in enumerate([112, 180, 248, 316]):
        b += c(x, 802, 25, P.sand)
    b += mic(112, 802, 12, P.ink)
    b += ln('M171 811l3 -10l14 -14l7 7l-14 14zM184 791l7 7', P.ink)
    b += ln('M240 808v-14a4 4 0 0 1 8 0v8M248 800v-10a4 4 0 0 1 8 0v14a10 10 0 0 1 -16 6', P.ink)
    b += rr(305, 791, 9, 9, 2.5, 'none', 'class="l" stroke="%s"' % P.ink) + rr(318, 791, 9, 9, 2.5, 'none', 'class="l" stroke="%s"' % P.ink) + rr(305, 804, 9, 9, 2.5, 'none', 'class="l" stroke="%s"' % P.ink) + rr(318, 804, 9, 9, 2.5, 'none', 'class="l" stroke="%s"' % P.ink)
    b += ring(520, 802, 24, P.line) + ln('M520 778a24 24 0 0 1 20.8 36', P.coral) + math('8', 514, 792, 20, P.ink)
    b += bar(560, 790, 90, P.ink, 11) + bar(560, 810, 60, P.mute, 8)
    b += rr(700, 777, 120, 50, 20, P.sand) + bar(728, 797, 64, P.mute, 10)
    b += rr(834, 777, 162, 50, 20, P.pine) + bar(860, 797, 76, P.oat, 10) + ln('M952 802h20M964 794l8 8l-8 8', P.oat)
    return svg(1400, 900, '教室寬版：白板、隊友列、六段進度條與老師控制列', b)

def phone_between(P):
    b = rr(40, 20, 520, 1160, 86, P.line) + rr(54, 34, 492, 1132, 73, P.bg) + rr(238, 54, 124, 28, 14, P.line)
    b += duo(108, 138, 21, 12.6, P) + bar(152, 120, 160, P.ink, 17) + bar(152, 148, 224, P.mute, 10)
    # 今天
    b += rr(84, 196, 432, 252, 34, P.surface) + bar(114, 226, 64, P.pine, 10)
    b += c(130, 288, 17, P.pine) + check(128, 289, 6, P.surface) + bar(164, 278, 216, P.ink, 14) + bar(164, 302, 128, P.mute, 9)
    b += ring(130, 358, 16, P.mute) + bar(164, 348, 190, P.ink, 14) + bar(164, 372, 150, P.mute, 9)
    b += rr(114, 400, 152, 30, 15, P.mint) + bar(130, 411, 120, P.pine, 8)
    # 卡點地圖
    b += rr(84, 472, 432, 330, 34, P.surface) + bar(114, 502, 92, P.pine, 10)
    xs, ys = [136, 218, 300, 382, 464], [574, 654, 734]
    b += ln('M136 574H464M464 574V654M464 654H136M136 654V734M136 734H464', P.line)
    order = [(x, ys[0]) for x in xs] + [(x, ys[1]) for x in reversed(xs)] + [(x, ys[2]) for x in xs]
    for i, (x, y) in enumerate(order):
        if i < 4:
            b += c(x, y, 27, P.honeysoft) + c(x, y, 20, P.honey)
        elif i < 8:
            b += c(x, y, 22, P.pine)
        elif i == 8:
            b += c(x, y, 31, P.coralsoft) + c(x, y, 22, P.coral)
        else:
            b += c(x, y, 22, P.surface) + ring(x, y, 21, P.line, 'stroke-dasharray="3 7"')
    # 說給我聽
    b += rr(84, 826, 432, 216, 34, P.mint) + duo(124, 866, 13, 7.8, P) + bar(152, 861, 110, P.pine, 10)
    b += ring(300, 950, 60, P.surface if P.name == 'light' else P.line) + ln('M300 890a60 60 0 1 1 -52 30', P.pine)
    b += c(300, 950, 46, P.pine) + mic(300, 948, 22, P.oat)
    for side in (-1, 1):
        for j, h in enumerate([18, 36, 24, 46, 28, 14]):
            b += rr(300 + side * (84 + j * 14) - 2.5, 950 - h / 2, 5, h, 2.5, P.pine)
    # 底部分頁＋中央相機鈕
    b += rr(84, 1066, 432, 76, 38, P.surface)
    b += c(140, 1104, 11, P.pine) + ring(216, 1104, 10, P.mute) + ring(384, 1104, 10, P.mute) + c(462, 1104, 13, P.a[3])
    b += c(300, 1094, 42, P.coral) + rr(280, 1081, 40, 28, 8, 'none', 'class="l" stroke="%s"' % P.fix) + ring(300, 1095, 8, P.fix) + ln('M291 1081l4 -6h10l4 6', P.fix)
    return svg(600, 1200, '手機直式：今天、卡點地圖、說給我聽', b)

def teacher_desk(P):
    soft = '#B9D3CB'
    b = rr(140, 56, 920, 566, 34, P.line) + rr(156, 72, 888, 534, 20, P.bg)
    b += rr(566, 618, 68, 64, 0, P.line) + rr(464, 674, 272, 20, 10, P.line) + rr(60, 694, 1080, 12, 6, P.line)
    # 接班卡
    b += rr(180, 98, 272, 484, 24, P.surface) + rr(202, 122, 100, 28, 14, P.mint) + bar(216, 132, 72, P.pine)
    b += bar(202, 170, 184, P.ink, 15) + bar(202, 196, 118, P.mute, 9)
    for i in range(5):
        b += '<circle cx="%d" cy="250" r="21" fill="%s" stroke="%s" stroke-width="4"/>' % (224 + i * 33, P.a[i], P.surface)
    b += rr(202, 292, 112, 28, 14, P.coralsoft) + c(217, 306, 5, P.coral) + bar(228, 302, 72, P.coral)
    b += rr(322, 292, 96, 28, 14, P.coralsoft) + c(337, 306, 5, P.coral) + bar(348, 302, 56, P.coral)
    b += rr(202, 340, 228, 108, 18, P.surface2) + rr(280, 350, 72, 88, 14, P.mint)
    for i in range(3):
        x = 214 + i * 74
        b += bar(x, 370, 36, P.mute, 7) + bar(x, 392, 52, P.pine if i == 1 else P.ink, 12)
    b += rr(202, 470, 228, 54, 18, P.pine) + bar(266, 491, 100, P.oat, 12) + bar(202, 544, 150, P.line)
    # 課前一頁
    b += rr(464, 98, 272, 484, 24, P.surface) + bar(486, 124, 76, P.pine, 10) + bar(486, 148, 170, P.ink, 15)
    for i, ex in enumerate(['-2x > 6', 'x/3 < 2', '4 - x > 7']):
        y = 186 + i * 106
        b += rr(486, y, 228, 94, 18, P.surface2) + c(506, y + 26, 7, P.coral) + math(ex, 524, y + 14, 24, P.ink) + bar(506, y + 56, 180, P.line) + bar(506, y + 72, 116, P.line)
    b += rr(486, 514, 150, 46, 16, P.mint) + check(508, 538, 6, P.pine) + bar(530, 533, 86, P.pine, 9)
    # 收入
    b += rr(748, 98, 272, 484, 24, P.night) + bar(770, 124, 70, soft, 10) + math('25080', 770, 150, 56, P.oat)
    b += bar(770, 222, 150, soft, 9)
    for i, y in enumerate([256, 284]):
        b += bar(770, y, 96 - i * 20, soft, 8) + bar(940, y, 58, P.oat, 8)
    for i, h in enumerate([96, 136, 176, 206]):
        x = 770 + i * 60
        b += rr(x, 536 - h, 46, h, 12, '#DCEFE8' if i == 2 else '#2E6E62') + bar(x + 6, 550, 34, soft, 7)
    # 桌上：小陪提醒、杯子、卡點卡
    b += rr(1000, 26, 168, 64, 24, P.mint) + duo(1034, 58, 12, 7.2, P) + bar(1062, 46, 84, P.pine, 9) + bar(1062, 64, 56, P.mute, 8)
    b += rr(1070, 630, 60, 64, 14, P.coral) + '<path d="M1130 648h8a14 14 0 0 1 0 28h-8" fill="none" stroke="%s" stroke-width="9" stroke-linecap="round"/>' % P.coral
    b += ln('M1088 612c-6 -8 6 -12 0 -20M1110 612c-6 -8 6 -12 0 -20', P.line)
    b += '<g transform="rotate(-7 170 660)">' + rr(84, 636, 170, 56, 14, P.coralsoft) + '</g>' + '<g transform="rotate(4 190 660)">' + rr(104, 636, 170, 58, 14, P.honey) + rr(120, 650, 52, 14, 7, P.fix) + bar(120, 672, 100, P.fix, 7) + '</g>'
    return svg(1200, 800, '老師桌機：接班卡、課前一頁、收入', b)

def empty_no_team(P):
    b = '<ellipse class="l" cx="300" cy="205" rx="262" ry="150" stroke="%s" stroke-dasharray="2 12"/>' % P.line
    b += c(194, 200, 86, P.coral) + ring(406, 200, 86, P.pine, 'stroke-dasharray="5 11"')
    b += c(286, 200, 4, P.mute) + c(300, 200, 4, P.mute) + c(314, 200, 4, P.mute)
    for i, x in enumerate([212, 256, 300, 344, 388]):
        if i < 2:
            b += c(x, 380, 15, P.a[[3, 1][i]])
        else:
            b += ring(x, 380, 14, P.line, 'stroke-dasharray="3 6"')
    b += c(64, 150, 5, P.honey) + c(540, 262, 5, P.coral) + c(486, 70, 4, P.pine)
    return svg(600, 450, '還沒湊到隊：兩個圓等待中', b)

def celebrate_dots(P):
    cols = [P.coral, P.pine, P.honey, P.mint, P.coralsoft]
    b = duo(400, 400, 52, 31, P, 'core')
    spec = [(150, 6, 15, 12), (250, 8, 10, -9), (336, 10, 7, 4)]
    k = 0
    b += '<g id="dots">'
    for ri, (rad, cnt, size, off) in enumerate(spec):
        for j in range(cnt):
            k += 1
            ang = off + j * 360.0 / cnt + ((k * 37) % 17 - 8)
            rr_ = rad + ((k * 53) % 41 - 20)
            x, y = polar(400, 400, rr_, ang)
            r = size + ((k * 29) % 7 - 3)
            b += c(x, y, r, cols[(k + ri) % 5], 'id="dot-%d"' % k)
    b += '</g>'
    return svg(800, 800, '品牌色小圓點向外散開的慶祝圖', b)

def coach_states(P):
    b = ''
    for cx in (150, 450, 750, 1050):
        b += bar(cx - 66, 250, 132, P.line, 4)
    b += '<g id="idle">' + ring(150, 160, 88, P.line, 'stroke-dasharray="2 9"') + duo(150, 160, 44, 27, P) + '</g>'
    b += '<g id="listening">' + duo(450, 142, 44, 27, P) + ln('M362 116c-12 16 -12 36 0 52', P.pine) + ln('M344 100c-20 26 -20 58 0 84', P.pine)
    b += ln('M438 224l12 -10l12 10', P.mute) + '</g>'
    b += '<g id="talking">' + ring(723, 160, 44, P.line, 'stroke-dasharray="2 8"') + ring(777, 160, 44, P.line, 'stroke-dasharray="2 8"') + duo(750, 160, 37, 23, P)
    b += bar(836, 140, 40, P.pine, 7) + bar(836, 157, 26, P.pine, 7) + bar(836, 174, 34, P.pine, 7) + '</g>'
    b += '<g id="celebrate"><g transform="rotate(-8 1050 118)">' + duo(1050, 118, 44, 27, P) + '</g>'
    b += ln('M1022 196v22M1050 204v22M1078 196v22', P.mute)
    for x, y, r, col in [(962, 84, 6, P.honey), (978, 34, 4, P.coral), (1050, 28, 5, P.pine), (1126, 40, 4, P.honey), (1142, 92, 6, P.coral), (1150, 150, 4, P.pine), (952, 146, 4, P.pine)]:
        b += c(x, y, r, col)
    b += '</g>'
    return svg(1200, 300, '小陪四態並排：待命、在聽、說話、學會', b)

def logo_mark(P):
    return svg(256, 256, 'Tandelo 商標：兩個重疊的圓', duo(128, 128, 70, 42, P, 'mark'))

def annulus(cx, cy, R, r):
    return 'M%s %sa%s %s 0 1 0 %s 0a%s %s 0 1 0 %s 0ZM%s %sa%s %s 0 1 1 %s 0a%s %s 0 1 1 %s 0Z' % (
        n(cx - R), n(cy), n(R), n(R), n(2 * R), n(R), n(R), n(-2 * R), n(cx - r), n(cy), n(r), n(r), n(2 * r), n(r), n(r), n(-2 * r))

def logo_wordmark(P):
    """字標輪廓：幾何構成的 Tandelo（粗體、無襯線），全部是路徑"""
    R, r, cy, base, asc, w = 41, 19, 124, 165, 50, 22
    d = []
    x = 292
    d.append('M%d 57H%dV%dH%sV%dH%sV%dH%dZ' % (x, x + 86, 57 + w, n(x + 43 + w / 2), base, n(x + 43 - w / 2), 57 + w, x))  # T
    x = 382; cx = x + R
    d.append(annulus(cx, cy, R, r))                                                                 # a 的碗
    d.append('M%s %sH%sV%sH%sZ' % (n(x + 2 * R - w), n(cy - R), n(x + 2 * R), n(base), n(x + 2 * R - w)))
    x = 478
    d.append('M%d %dH%dV%dH%dZ' % (x, 83, x + w, base, x))                                          # n 的豎
    d.append('M%d %dV122A39 39 0 0 1 %d 122V%dH%dV122A%d %d 0 0 0 %d 122V%dZ' % (x, base, x + 78, base, x + 78 - w, 39 - w, 39 - w, x + w, base))
    x = 568; cx = x + R
    d.append(annulus(cx, cy, R, r))                                                                 # d 的碗
    d.append('M%s %sH%sV%sH%sZ' % (n(x + 2 * R - w), asc, n(x + 2 * R), base, n(x + 2 * R - w)))
    x = 662; cx = x + R                                                                              # e
    ax, ay = polar(cx, cy, R, 50); ix, iy = polar(cx, cy, r, 50)
    d.append('M%s %sA%d %d 0 1 1 %s %sH%sA%d %d 0 1 0 %s %sZ' % (n(ax), n(ay), R, R, n(cx + R), n(cy), n(cx + r), r, r, n(ix), n(iy)))
    d.append('M%s %sH%sV%sH%sZ' % (n(cx - r - 4), n(cy - 5), n(cx + R), n(cy + 11), n(cx - r - 4)))
    x = 756
    d.append('M%d %dH%dV%dH%dZ' % (x, asc, x + w, base, x))                                          # l
    x = 790; cx = x + R
    d.append(annulus(cx, cy, R, r))                                                                 # o
    body = duo(132, 120, 70, 42, P, 'mark')
    body += '<g id="wordmark" fill="%s" fill-rule="evenodd">%s</g>' % (P.ink, ''.join('<path d="%s"/>' % p for p in d))
    return svg(900, 240, 'Tandelo 商標與字標', body)

ALL = {'classroom-wide': classroom_wide, 'phone-between': phone_between, 'teacher-desk': teacher_desk,
       'empty-no-team': empty_no_team, 'celebrate-dots': celebrate_dots, 'coach-states': coach_states,
       'logo-mark': logo_mark, 'logo-wordmark-outline': logo_wordmark}
