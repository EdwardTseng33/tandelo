# Tandelo 插圖產生器：共用工具（色票、兩個圓、人物、手寫數學式）
from math import sqrt, cos, sin, pi, radians
from types import SimpleNamespace as NS

MATES = ['#DCEFE8', '#F9D3C9', '#FBE7B2', '#C9DDF8', '#DDD2F6', '#CFEBDD']
LIGHT = NS(name='light', surface='#FFFFFF', surface2='#FBFAF7', bg='#F6F4EE', sand='#ECE9E1',
           line='#D9D5CA', ink='#0D2B26', mute='#5E6B67', pine='#0E5F52', pinedeep='#0A463D',
           coral='#F26B54', coralsoft='#FDE7E1', honey='#F4C24D', honeysoft='#FBEBC0',
           mint='#DCEFE8', overlap='#0D281B', night='#0A463D', nightsoft='#0E5F52',
           fix='#0D2B26', oat='#F6F4EE', lg='#06C755', lgsoft='#C9F2D7', a=MATES,
           board='#FFFFFF', boardmute='#5E6B67', boardpine='#0E5F52', boardsoft='#FDE7E1', boardnote='#FBEBC0', boardmint='#DCEFE8')
DARK = NS(name='dark', surface='#131D1A', surface2='#1A2723', bg='#0F1917', sand='#22302C',
          line='#31443E', ink='#EAF1EE', mute='#9FB0AA', pine='#1F8C78', pinedeep='#16302A',
          coral='#F26B54', coralsoft='#3A1E18', honey='#F4C24D', honeysoft='#332A12',
          mint='#16302A', overlap='#1D3B28', night='#0F2A25', nightsoft='#16302A',
          fix='#0D2B26', oat='#F6F4EE', lg='#06C755', lgsoft='#C9F2D7', a=MATES,
          board='#F6F4EE', boardmute='#5E6B67', boardpine='#0E5F52', boardsoft='#FDE7E1', boardnote='#FBEBC0', boardmint='#DCEFE8')

STYLE = ('<style>.l{fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;'
         'vector-effect:non-scaling-stroke}</style>')

def n(v):
    s = ('%.1f' % v).rstrip('0').rstrip('.')
    return s if s != '-0' else '0'

def svg(w, h, title, body):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" role="img" aria-label="%s">'
            '<title>%s</title>%s%s</svg>\n') % (w, h, w, h, title, title, STYLE, body)

def c(cx, cy, r, fill, extra=''):
    return '<circle cx="%s" cy="%s" r="%s" fill="%s"%s/>' % (n(cx), n(cy), n(r), fill, (' ' + extra) if extra else '')

def ring(cx, cy, r, stroke, extra=''):
    return '<circle class="l" cx="%s" cy="%s" r="%s" stroke="%s"%s/>' % (n(cx), n(cy), n(r), stroke, (' ' + extra) if extra else '')

def rr(x, y, w, h, r, fill, extra=''):
    return '<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s"%s/>' % (n(x), n(y), n(w), n(h), n(r), fill, (' ' + extra) if extra else '')

def ln(d, stroke, extra=''):
    return '<path class="l" d="%s" stroke="%s"%s/>' % (d, stroke, (' ' + extra) if extra else '')

def bar(x, y, w, fill, h=8):
    """文字的替身：圓頭短橫條"""
    return rr(x, y, w, h, h / 2, fill)

def duo(cx, cy, r, d, P, gid=None, ca=None, cb=None):
    """兩個重疊的圓：珊瑚在左、松綠在右，重疊處用相乘色。d＝圓心到中線距離"""
    h = sqrt(max(r * r - d * d, 0))
    s = '<g%s>' % ((' id="%s"' % gid) if gid else '')
    s += c(cx - d, cy, r, ca or P.coral) + c(cx + d, cy, r, cb or P.pine)
    if d < r:
        s += '<path d="M%s %sA%s %s 0 0 1 %s %sA%s %s 0 0 1 %s %sZ" fill="%s"/>' % (
            n(cx), n(cy - h), n(r), n(r), n(cx), n(cy + h), n(r), n(r), n(cx), n(cy - h), P.overlap)
    return s + '</g>'

def person(cx, top, s, fill):
    """無五官的幾何人物：一顆頭＋圓肩身體"""
    yb = top + s * 1.12
    return (c(cx, top + s * .5, s * .5, fill) +
            '<path d="M%s %sv%sa%s %s 0 0 1 %s 0v%sz" fill="%s"/>' % (
                n(cx - s), n(yb + s * 1.3), n(-s * .3), n(s), n(s), n(2 * s), n(s * .3), fill))

GLYPH = {
    '-': 'M1.5 8H8.5', '+': 'M1.5 8H8.5M5 4.5V11.5', '=': 'M1.5 6H8.5M1.5 10H8.5',
    'x': 'M1.5 4.5C4 5 6 12 8.5 12.2M8.5 4.5C6.5 6.5 3.5 10 1.5 12.2',
    '>': 'M2 4L8.5 8L2 12', '<': 'M8.5 4L2 8L8.5 12',
    '0': 'M5 2C1.5 2 1.5 14 5 14C8.5 14 8.5 2 5 2',
    '1': 'M3 4.5L5.5 2V14',
    '2': 'M2 4.5C2.5 1 8 1.5 8 5C8 8 2.5 10.5 2 14H8.5',
    '3': 'M2 3C5 1 8.5 2.5 8 5C7.6 7 5.5 7.6 4.5 7.6C9.5 7.6 9.5 14.5 2 13.4',
    '4': 'M6.8 14V2L1.5 10H9',
    '5': 'M8 2H3L2.5 7.2C5 5.6 8.6 7 8.6 10.2C8.6 14.6 3 14.6 2 12.4',
    '6': 'M8 2C4 3 2 7 2 10.5C2 15 8.5 15 8.5 10.5C8.5 7 3 7 2 10.5',
    '7': 'M2 2.5H8.5L4.5 14',
    '8': 'M5 7.5C1.5 6.5 2 2 5 2C8 2 8.5 6.5 5 7.5C1 8.5 1 14 5 14C9 14 9 8.5 5 7.5',
    '9': 'M8 5.5C8 1 2 1 2 5.5C2 9.5 8 9.5 8 5.5C8.2 9.5 6.5 13 3 14',
    '?': 'M2.5 4.5C2.5 1 8 1 8 4.5C8 7 5 7.4 5 10.2M5 13.6V13.7',
    '/': 'M8 2L2 14', '(': 'M6.5 1.5C3 5 3 11 6.5 14.5', ')': 'M3.5 1.5C7 5 7 11 3.5 14.5',
}

def math(text, x, y, h, color):
    """手寫感數學式：每個字是一筆線條，高度 h"""
    k = h / 16.0
    out, ax = [], 0.0
    for ch in text:
        if ch == ' ':
            ax += 6
            continue
        out.append('<path class="l" transform="translate(%s 0)" d="%s"/>' % (n(ax), GLYPH[ch]))
        ax += 12
    return '<g transform="translate(%s %s) scale(%s)" stroke="%s">%s</g>' % (n(x), n(y), ('%.3f' % k).rstrip('0').rstrip('.'), color, ''.join(out))

def check(cx, cy, s, stroke):
    return ln('M%s %sl%s %sl%s %s' % (n(cx - s), n(cy), n(s * .7), n(s * .7), n(s * 1.3), n(-s * 1.4)), stroke)

def polar(cx, cy, r, deg):
    a = radians(deg)
    return cx + r * cos(a), cy + r * sin(a)
