"""數理大陸地形（viewBox 0 0 440 420）：海、海岸、六區地形符號、航線。顏色走 CSS 變數：
--sea、--sea-line、--land、--land-edge、--land-2（深一點的陸地）、--pine、--fog、--fog-text、--text。
用法：python3 worldmap.py > ../../worldmap-terrain.svg（只輸出 <g> 內容，由頁面包進 <svg>）
"""
TREE = '<path class="tree" d="M{x} {y}l-6 10h4v4h4v-4h4z"/>'
PEAK = '<path class="peak" d="M{x} {y}l-14 22h28z"/><path class="snow" d="M{x} {y}l-5 8h10z"/>'


def trees(pts):
    return ''.join(TREE.format(x=x, y=y) for x, y in pts)


def peaks(pts):
    return ''.join(PEAK.format(x=x, y=y) for x, y in pts)


G = (
    # 海的波紋
    '<path class="wave" d="M26 40q10-6 20 0t20 0M372 70q10-6 20 0t20 0M46 392q10-6 20 0t20 0M352 372q10-6 20 0t20 0M400 330q10-6 20 0t20 0"/>'
    # 大陸：海岸線有海灣
    '<path class="land" d="M76 128c14-44 60-74 118-82 46-6 96 4 134 34 36 28 60 70 52 118-6 36-32 62-60 86-30 26-66 44-108 44-44 0-84-20-110-50-26-32-40-80-26-150z"/>'
    '<path class="shore" d="M94 150c10-30 44-56 90-64" /><path class="shore" d="M330 100c22 20 38 48 38 80"/>'
    # 乘法平原：田畦線
    '<path class="field" d="M112 182h66M106 196h74M112 210h66M118 224h56"/>'
    # 多項式林：樹
    + trees([(236, 122), (256, 116), (276, 126), (246, 142), (268, 146), (290, 140), (228, 150), (302, 158)]) +
    # 根號谷：V 形谷與小河
    '<path class="valley" d="M318 206l20 36 22-40"/><path class="river" d="M338 242q6 18-4 34t2 34"/>'
    # 畢氏山：三座山
    + peaks([(126, 284), (154, 270), (176, 296)]) +
    # 分解洞窟：洞口
    '<path class="cave" d="M232 356a22 18 0 0 1 44 0z"/><path class="cave-in" d="M242 356a12 10 0 0 1 24 0z"/>'
    # 二次高原：台地（在迷霧裡）
    '<path class="mesa" d="M296 318l14-14h40l14 14z"/><path class="mesa-top" d="M310 304h40"/>'
    # 航線
    '<path class="route" d="M60 60q60-30 120-10M400 390q-40 20-90 6"/>'
)
CSS = (
    '.land{fill:var(--land);stroke:var(--land-edge);stroke-width:2}.shore{fill:none;stroke:var(--land-edge);stroke-width:1.5;opacity:.6}'
    '.wave,.route{fill:none;stroke:var(--sea-line);stroke-width:2;stroke-linecap:round}.route{stroke-dasharray:4 6}'
    '.field{fill:none;stroke:var(--land-edge);stroke-width:1.6;stroke-linecap:round;opacity:.9}'
    '.tree{fill:var(--land-2)}.peak{fill:var(--land-2)}.snow{fill:var(--surface)}'
    '.valley{fill:none;stroke:var(--land-edge);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}.river{fill:none;stroke:var(--sea-line);stroke-width:2.2;stroke-linecap:round}'
    '.cave{fill:var(--land-2)}.cave-in{fill:var(--shadow-ink,#1B2B27)}'
    '.mesa{fill:var(--land-2);opacity:.7}.mesa-top{fill:none;stroke:var(--land-edge);stroke-width:1.5}'
)
if __name__ == '__main__':
    import sys
    print(CSS if (len(sys.argv) > 1 and sys.argv[1] == 'css') else G)
