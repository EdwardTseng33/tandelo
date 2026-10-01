# 第一批：主視覺、三個痛、七步
from lib import *

def hero_tandem(P):
    b = '<ellipse class="l" cx="600" cy="410" rx="505" ry="300" stroke="%s" stroke-dasharray="2 12" transform="rotate(-10 600 410)"/>' % P.line
    b += duo(600, 410, 200, 120, P, 'duo')
    mates = [(150, 230, 46, 3), (345, 112, 26, 2), (118, 520, 30, 1), (300, 695, 40, 5), (1065, 560, 44, 4), (905, 708, 26, 0)]
    b += '<g id="mates">' + ''.join(c(x, y, r, P.a[i]) for x, y, r, i in mates) + '</g>'
    b += ring(150, 230, 60, P.line) + ring(1065, 560, 58, P.line)
    # 後面那張珊瑚卡（翻之前）
    b += '<g transform="rotate(-10 895 130)">' + rr(800, 70, 190, 120, 22, P.coralsoft) + rr(820, 90, 62, 20, 10, P.coral) + bar(820, 126, 110, P.coral, 9) + '</g>'
    # 翻成金色的卡點卡
    b += '<g id="gold-card" transform="rotate(8 985 170)">' + rr(875, 100, 220, 140, 24, P.honey) + rr(895, 120, 76, 22, 11, P.fix)
    b += c(1062, 131, 14, P.fix) + check(1060, 132, 5.5, P.honey) + math('x < -3', 897, 166, 46, P.fix) + '</g>'
    for x, y, r, col in [(1128, 96, 7, P.coral), (1150, 170, 5, P.pine), (1118, 300, 6, P.honey), (790, 52, 5, P.pine), (1010, 50, 4, P.honey),
                         (228, 372, 5, P.honey), (430, 730, 5, P.coral), (700, 745, 4, P.pine), (520, 78, 4, P.coral)]:
        b += c(x, y, r, col)
    return svg(1200, 800, '兩個大圓靠攏，周圍是六色隊友與一張翻成金色的卡點卡', b)

def pain_stuck(P):
    b = c(350, 215, 172, P.mint)
    b += rr(250, 60, 270, 320, 22, P.surface)
    b += ln('M290 126V164', P.pine) + ln('M290 186V214', P.pine) + ln('M290 268V294', P.line, 'stroke-dasharray="2 7"')
    b += c(290, 115, 10, P.pine) + check(289, 116, 4, P.surface) + math('-2x > 6', 322, 102, 26, P.ink)
    b += c(290, 175, 10, P.pine) + check(289, 176, 4, P.surface) + bar(322, 171, 130, P.line)
    b += rr(316, 219, 180, 44, 14, P.coralsoft)
    b += '<path d="M269 245C266 229 278 217 292 218C306 219 314 231 311 245C308 258 296 265 284 262C275 260 270 253 269 245Z" fill="%s"/>' % P.coral
    b += math('x > -3 ?', 330, 228, 26, P.ink)
    b += ring(290, 306, 9, P.line, 'stroke-dasharray="2 6"') + bar(322, 302, 96, P.line)
    b += ring(290, 344, 9, P.line, 'stroke-dasharray="2 6"') + bar(322, 340, 60, P.line)
    b += person(132, 218, 62, P.a[3])
    b += rr(40, 368, 520, 12, 6, P.line)
    b += rr(140, 142, 76, 36, 18, P.surface) + c(162, 160, 4, P.mute) + c(178, 160, 4, P.mute) + c(194, 160, 4, P.mute)
    b += c(150, 190, 5, P.surface)
    return svg(600, 450, '孩子坐在題目前，其中一步像石頭卡在路上', b)

def pain_alone(P):
    dim = '#2A8272'
    b = rr(40, 30, 520, 390, 44, P.night)
    b += rr(340, 70, 170, 150, 22, P.nightsoft)
    b += '<path d="M436 106A30 30 0 1 0 462 150A24 24 0 0 1 436 106Z" fill="%s"/>' % P.honey
    for x, y, r in [(372, 104, 3), (480, 188, 2.5), (392, 190, 2), (486, 100, 2)]:
        b += c(x, y, r, P.oat)
    b += c(122, 112, 26, P.coral) + ring(160, 112, 26, '#7ED3C0', 'stroke-dasharray="3 8"')
    b += '<path d="M352 268L262 196A38 38 0 0 0 208 236L330 318Z" fill="#DCEFE8" opacity=".14"/>'
    b += person(232, 172, 70, dim)
    b += '<g transform="rotate(-14 350 296)">' + rr(328, 262, 44, 68, 10, P.oat) + rr(333, 268, 34, 50, 6, '#BFE3D8') + '</g>'
    b += rr(90, 332, 420, 12, 6, dim)
    b += rr(400, 318, 84, 14, 5, dim) + rr(408, 304, 68, 14, 5, P.nightsoft) + rr(404, 290, 60, 14, 5, dim)
    return svg(600, 450, '夜裡一個人在書桌前，只有手機的光', b)

def pain_unseen(P):
    b = c(255, 232, 172, P.coralsoft)
    b += '<g transform="rotate(-6 250 220)">' + rr(140, 66, 220, 310, 20, P.surface)
    b += bar(166, 96, 96, P.ink, 10) + bar(166, 118, 60, P.line)
    b += math('72', 166, 146, 68, P.ink) + ln('M166 226C190 220 230 232 262 224', P.coral)
    b += bar(166, 250, 168, P.line) + bar(166, 270, 140, P.line) + bar(166, 290, 156, P.line)
    for i, h in enumerate([26, 44, 20, 36, 30]):
        b += rr(166 + i * 30, 356 - h, 20, h, 6, P.sand)
    b += '</g>'
    b += person(462, 196, 92, P.a[4])
    b += c(408, 104, 40, P.surface) + c(436, 152, 8, P.surface) + c(448, 172, 4.5, P.surface)
    b += math('?', 393, 80, 48, P.coral)
    return svg(600, 450, '家長看著一張看不懂的成績單，旁邊一個問號', b)

def step_diagnose(P):
    road = 'stroke="%s" stroke-width="36" stroke-linecap="round" fill="none"' % P.sand
    b = '<path d="M24 268C96 268 132 220 186 208" %s/><path d="M300 176C348 160 384 112 456 106" %s/>' % (road, road)
    b += ln('M24 268C96 268 132 220 186 208', P.line, 'stroke-dasharray="3 10"') + ln('M300 176C348 160 384 112 456 106', P.line, 'stroke-dasharray="3 10"')
    b += c(64, 264, 7, P.pine) + c(118, 244, 7, P.pine) + ring(372, 138, 7, P.mute) + ring(426, 112, 7, P.mute)
    b += '<clipPath id="lens"><circle cx="243" cy="186" r="76"/></clipPath>'
    b += c(243, 186, 76, P.surface)
    b += '<g clip-path="url(#lens)"><path d="M150 216L206 200" stroke="%s" stroke-width="52" fill="none"/><path d="M282 178L340 160" stroke="%s" stroke-width="52" fill="none"/>' % (P.sand, P.sand)
    b += ln('M150 216L206 200', P.line, 'stroke-dasharray="3 10"') + ln('M282 178L340 160', P.line, 'stroke-dasharray="3 10"') + '</g>'
    b += c(244, 189, 14, P.coral) + ring(244, 189, 27, P.coral, 'stroke-dasharray="3 7"')
    b += '<circle cx="243" cy="186" r="76" fill="none" stroke="%s" stroke-width="11"/>' % P.pine
    b += '<path d="M300 244L352 300" stroke="%s" stroke-width="18" stroke-linecap="round" fill="none"/>' % P.pine
    b += rr(312, 44, 112, 32, 16, P.coralsoft) + c(330, 60, 5, P.coral) + bar(344, 56, 62, P.coral)
    b += ln('M318 82C306 96 296 108 288 122', P.coral, 'stroke-dasharray="2 7"')
    return svg(480, 360, '放大鏡對準一條路上的缺口', b)

def step_team(P):
    b = duo(240, 184, 122, 74, P)
    pts = [(134, 166, 3), (176, 244, 1), (240, 140, 2), (240, 222, 0), (306, 244, 4), (346, 166, 5)]
    for x, y, i in pts:
        b += c(x, y, 25, P.a[i])
    b += ln('M40 84C54 92 66 104 74 120', P.line) + ln('M440 84C426 92 414 104 406 120', P.line)
    b += ln('M60 300C72 296 84 288 92 278', P.line) + ln('M420 300C408 296 396 288 388 278', P.line)
    b += c(30, 76, 5, P.coral) + c(450, 76, 5, P.pine) + c(48, 306, 4, P.honey) + c(432, 306, 4, P.honey)
    return svg(480, 360, '六色小圓被兩個大圓包起來', b)

def step_class(P):
    b = rr(28, 36, 424, 292, 28, P.line) + rr(38, 46, 404, 272, 20, P.surface)
    b += rr(50, 58, 272, 196, 14, P.surface2 if P.name == 'light' else P.board)
    b += math('-2x > 6', 70, 100, 28, P.fix)
    b += rr(64, 148, 122, 42, 12, P.boardsoft) + math('x < -3', 74, 156, 28, P.fix)
    b += ln('M70 214C100 208 130 220 160 212S210 208 232 214', '#D9D5CA')
    b += ring(280, 92, 27, P.boardpine) + c(280, 92, 20, P.boardpine)
    b += ln('M262 126C240 140 214 150 194 162', P.boardpine, 'stroke-dasharray="2 7"')
    for k, (x, y) in enumerate([(334, 58), (386, 58), (334, 110), (386, 110)]):
        b += rr(x, y, 46, 46, 13, P.a[k]) + '<g opacity=".5">' + person(x + 23, y + 9, 10.5, P.fix) + '</g>'
    b += rr(334, 164, 98, 90, 14, P.mint) + duo(352, 182, 7, 4.2, P) + bar(368, 178, 50, P.pine, 7) + bar(346, 204, 74, P.mute, 7) + bar(346, 220, 56, P.mute, 7)
    x = 50
    cols = [P.pine, P.pine, P.coral, P.coralsoft, P.coralsoft, P.coralsoft]
    for w, col in zip([5, 10, 10, 5, 15, 5], cols):
        ww = w * 7.24
        b += rr(x, 270, ww, 16, 8, col)
        x += ww + 4
    b += rr(50, 294, 382, 12, 6, P.surface2)
    b += c(60, 300, 3, P.pine) + bar(70, 297, 40, P.line, 6)
    return svg(480, 360, '平板上的白板、四位隊友小格與上方的老師圓', b)

def step_practice(P):
    b = rr(58, 26, 174, 308, 30, P.line) + rr(66, 34, 158, 292, 23, P.surface)
    b += rr(122, 58, 88, 34, 15, P.sand) + bar(136, 71, 60, P.mute)
    b += rr(78, 106, 132, 78, 16, P.mint) + duo(97, 124, 7, 4.2, P) + bar(114, 120, 80, P.pine, 7) + bar(90, 144, 108, P.mute, 7) + bar(90, 160, 74, P.mute, 7)
    b += rr(110, 198, 100, 36, 15, P.sand) + math('x < -3', 122, 206, 20, P.ink)
    b += rr(78, 272, 134, 38, 19, P.pine)
    b += rr(93, 281, 9, 14, 4.5, P.oat) + ln('M90 290a7.5 7.5 0 0 0 15 0M97.5 298v4', P.oat)
    for i, h in enumerate([8, 16, 10, 20, 12, 18, 8]):
        b += rr(120 + i * 8, 291 - h / 2, 3.5, h, 1.75, P.oat)
    b += bar(184, 288, 18, P.oat, 6)
    b += ring(354, 176, 106, P.line, 'stroke-dasharray="2 9"') + ring(354, 176, 124, P.line, 'stroke-dasharray="2 14"')
    b += duo(354, 176, 56, 34, P)
    b += c(246, 150, 4, P.pine) + c(258, 156, 3, P.pine) + c(242, 216, 3, P.coral)
    return svg(480, 360, '手機與兩個會呼吸的圓（小陪）對話', b)

def step_retest(P):
    b = rr(30, 62, 224, 244, 22, P.surface)
    b += ln('M88 50V74', P.ink) + ln('M196 50V74', P.ink) + bar(54, 90, 76, P.ink, 10) + bar(138, 91, 36, P.line)
    for d in range(21):
        x, y = 58 + (d % 7) * 28, 146 + (d // 7) * 48
        if d == 0:
            b += c(x, y, 10.5, P.pine) + check(x - 1, y + 1, 4, P.surface)
        elif d == 9:
            b += c(x, y, 17, P.honeysoft) + c(x, y, 11, P.honey)
        elif 7 <= d <= 12:
            b += c(x, y, 10.5, P.mint)
        else:
            b += c(x, y, 10.5, P.sand)
    b += ln('M58 164C60 190 84 204 100 196', P.pine, 'stroke-dasharray="2 7"')
    b += '<g transform="rotate(-10 322 150)">' + rr(268, 106, 112, 86, 16, P.coral) + rr(282, 120, 42, 14, 7, P.fix) + bar(282, 150, 70, P.fix, 7) + bar(282, 166, 48, P.fix, 7) + '</g>'
    b += '<g transform="rotate(8 388 244)">' + rr(326, 196, 126, 96, 18, P.honey) + rr(342, 212, 46, 15, 7.5, P.fix) + c(430, 219, 9, P.fix) + check(429, 220, 3.6, P.honey) + math('x < -3', 343, 242, 26, P.fix) + '</g>'
    b += ln('M398 118C432 128 446 152 436 180', P.ink) + ln('M446 166L436 181L422 173', P.ink)
    b += c(290, 300, 5, P.coral) + c(462, 120, 4, P.pine) + c(300, 232, 4, P.honey)
    return svg(480, 360, '日曆翻到第九天，一張卡片從珊瑚翻向金色', b)

def step_parent(P):
    b = c(40, 70, 19, P.surface) + duo(40, 70, 7.5, 4.5, P)
    b += rr(70, 44, 290, 236, 22, P.lg) + rr(70, 52, 290, 228, 20, P.surface)
    b += bar(94, 78, 84, P.mute, 7) + bar(94, 96, 176, P.ink, 12)
    b += bar(94, 132, 52, P.mute, 6) + bar(94, 146, 226, P.line) + bar(94, 162, 164, P.line)
    b += rr(88, 188, 254, 76, 16, P.mint)
    b += ln('M104 204c-4 2 -6 5 -6 10M114 204c-4 2 -6 5 -6 10', P.pine) + bar(124, 203, 72, P.pine, 7)
    b += bar(104, 224, 212, P.ink, 9) + bar(104, 242, 132, P.ink, 9)
    b += rr(300, 296, 144, 44, 20, P.lgsoft) + bar(322, 314, 100, P.fix)
    b += c(418, 84, 36, P.lg) + rr(397, 66, 42, 30, 13, '#FFFFFF') + '<path d="M408 92l-5 13l15 -11z" fill="#FFFFFF"/>'
    b += c(408, 81, 3, P.lg) + c(418, 81, 3, P.lg) + c(428, 81, 3, P.lg)
    return svg(480, 360, 'LINE 對話框裡一張「今晚可以問他」的卡片', b)

def step_exam(P):
    b = '<g transform="rotate(-4 130 185)">' + rr(48, 56, 166, 256, 18, P.surface) + bar(68, 80, 70, P.ink, 10) + bar(68, 100, 44, P.line)
    for i in range(4):
        y = 128 + i * 42
        b += rr(68, y, 126, 28, 14, P.coralsoft) + c(83, y + 14, 5, P.coral) + bar(96, y + 10, [70, 54, 78, 60][i], P.coral)
    b += '</g>'
    b += ln('M224 186H258', P.ink) + ln('M248 176L259 186L248 196', P.ink)
    b += '<g transform="rotate(4 350 185)">' + rr(268, 56, 166, 256, 18, P.surface) + bar(288, 80, 70, P.ink, 10) + bar(288, 100, 44, P.line)
    b += rr(288, 128, 126, 28, 14, P.honeysoft) + c(303, 142, 5, P.honey) + bar(316, 138, 70, P.honey)
    b += rr(288, 170, 126, 28, 14, P.honeysoft) + c(303, 184, 5, P.honey) + bar(316, 180, 54, P.honey)
    b += rr(288, 212, 126, 28, 14, P.mint) + c(303, 226, 5, P.pine) + bar(316, 222, 78, P.pine)
    b += '<rect class="l" x="288" y="254" width="126" height="28" rx="14" stroke="%s" stroke-dasharray="3 7"/>' % P.line
    b += '</g>'
    b += c(446, 70, 5, P.honey) + c(456, 104, 4, P.pine) + c(440, 300, 4, P.coral)
    return svg(480, 360, '兩張考卷並排，前後對照，卡點一個一個翻過去', b)

ALL = {'hero-tandem': hero_tandem, 'pain-stuck': pain_stuck, 'pain-alone': pain_alone, 'pain-unseen': pain_unseen,
       'step-diagnose': step_diagnose, 'step-team': step_team, 'step-class': step_class, 'step-practice': step_practice,
       'step-retest': step_retest, 'step-parent': step_parent, 'step-exam': step_exam}
