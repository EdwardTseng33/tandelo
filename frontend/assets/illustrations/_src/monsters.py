"""八隻怪 v2：角色化向量，64×64 viewBox，顏色全走 CSS 變數（--m-body、--m-eye、--m-pupil、--m-feat、--m-zz、--m-q），
所以同一個 symbol 在「還在附近／打中／收服／睡著／迷霧」五種狀態下只要換變數。
沒有 <text> 以外的字、沒有漸層、沒有濾鏡；線條 2.6–3 圓頭。用法：python3 monsters.py > ../../monsters-defs.svg
"""

Z = '<text fill="var(--m-zz)" font-family="Outfit,sans-serif" font-weight="700" font-size="14" x="{x}" y="{y}">z</text>'
Q = '<text fill="var(--m-q)" font-family="Outfit,sans-serif" font-weight="700" font-size="26" text-anchor="middle" x="{x}" y="{y}">?</text>'
S = 'fill="none" stroke="var(--m-feat)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"'


def eyes(lx, ly, rx, ry, r=5.6, pr=2.5, dx=0.8, dy=0.9):
    return (f'<circle fill="var(--m-eye)" cx="{lx}" cy="{ly}" r="{r}"/><circle fill="var(--m-eye)" cx="{rx}" cy="{ry}" r="{r}"/>'
            f'<circle fill="var(--m-pupil)" cx="{lx + dx}" cy="{ly + dy}" r="{pr}"/><circle fill="var(--m-pupil)" cx="{rx + dx}" cy="{ry + dy}" r="{pr}"/>')


MONS = {
    # 漏項獸：圓滾滾的賊，背後藏了兩塊偷來的長方形，嘴角得意
    'm-round': (
        '<rect fill="var(--m-feat)" x="8" y="22" width="11" height="8" rx="2" transform="rotate(-18 13 26)"/>'
        '<rect fill="var(--m-feat)" x="45" y="22" width="11" height="8" rx="2" transform="rotate(18 51 26)"/>'
        '<circle fill="var(--m-body)" cx="32" cy="35" r="23"/>'
        '<path fill="var(--m-body)" d="M14 22l4-10 7 8zM50 22l-4-10-7 8z"/>'
        + eyes(24, 32, 40, 32) +
        f'<path {S} d="M23 44q9 7 18 0"/><path {S} d="M18 26l6-3M46 26l-6-3"/>'
        + Z.format(x=46, y=14) + Q.format(x=32, y=46)
    ),
    # 負號幽靈：床單幽靈，底邊波浪，手上拿著一根「−」，一邊眉毛挑高
    'm-cloud': (
        '<path fill="var(--m-body)" d="M14 56V30a18 18 0 0 1 36 0v26l-6-5-6 5-6-5-6 5-6-5z"/>'
        + eyes(25, 31, 39, 31, r=5.2, pr=2.3) +
        f'<path {S} d="M20 23l8-2M36 21l8 2"/><path {S} d="M27 42h10"/>'
        '<rect fill="var(--m-feat)" x="42" y="40" width="16" height="4" rx="2" transform="rotate(-20 50 42)"/>'
        + Z.format(x=48, y=14) + Q.format(x=32, y=44)
    ),
    # 拆根蟲：甲蟲，一對大鉗子像 √ 的勾，六隻腳，背上一道裂縫
    'm-bug': (
        f'<path {S} d="M12 30l-7-6M12 38l-8 1M14 46l-6 6M52 30l7-6M52 38l8 1M50 46l6 6"/>'
        f'<path {S} stroke-width="3.2" d="M22 20l-6-10 4 12M42 20l6-10-4 12"/>'
        '<ellipse fill="var(--m-body)" cx="32" cy="38" rx="21" ry="17"/>'
        f'<path {S} d="M32 22v8"/>'
        + eyes(24, 36, 40, 36, r=5.2, pr=2.3) +
        f'<path {S} d="M26 47l3 2 3-2 3 2 3-2"/>'
        + Z.format(x=46, y=16) + Q.format(x=32, y=46)
    ),
    # 雙面根：兩張臉背靠背，一張正、一張倒，中間一道縫
    'm-twin': (
        '<circle fill="var(--m-body)" cx="22" cy="36" r="17"/><circle fill="var(--m-body)" cx="42" cy="36" r="17"/>'
        f'<path {S} d="M32 22v28"/>'
        '<circle fill="var(--m-eye)" cx="17" cy="33" r="5"/><circle fill="var(--m-pupil)" cx="18" cy="34" r="2.2"/>'
        '<circle fill="var(--m-eye)" cx="47" cy="40" r="5"/><circle fill="var(--m-pupil)" cx="48" cy="39" r="2.2"/>'
        f'<path {S} d="M13 44q5 4 10 0"/><path {S} d="M39 30q5-4 10 0"/>'
        f'<path {S} d="M22 15v-4M20 13h4M44 60v-4M42 58h4"/>'
        + Z.format(x=50, y=14) + Q.format(x=32, y=46)
    ),
    # 斜邊迷霧：三角形的山怪，頭頂罩著霧，眼睛在底邊，身上一條畫歪的虛線「以為是斜邊」
    'm-tri': (
        '<path fill="var(--m-body)" d="M32 9l25 46H7z"/>'
        '<path fill="var(--m-feat)" opacity=".55" d="M18 20a7 7 0 0 1 12-4 8 8 0 0 1 14 2 6 6 0 0 1 4 10H16a6 6 0 0 1 2-8z"/>'
        f'<path {S} stroke-dasharray="3 3" d="M14 50L44 20"/>'
        + eyes(25, 44, 39, 44, r=5, pr=2.2) +
        f'<path {S} d="M28 52h8"/>'
        + Z.format(x=48, y=18) + Q.format(x=32, y=50)
    ),
    # 平方差雙子：兩滴水頭碰頭，一個肚子上「+」、一個「−」，表情一模一樣
    'm-drop': (
        '<path fill="var(--m-body)" d="M20 10c8 10 16 16 16 26a16 16 0 0 1-32 0c0-10 8-16 16-26z"/>'
        '<path fill="var(--m-body)" d="M44 10c8 10 16 16 16 26a16 16 0 0 1-32 0c0-10 8-16 16-26z"/>'
        '<circle fill="var(--m-eye)" cx="16" cy="36" r="4.2"/><circle fill="var(--m-pupil)" cx="17" cy="37" r="1.9"/>'
        '<circle fill="var(--m-eye)" cx="40" cy="36" r="4.2"/><circle fill="var(--m-pupil)" cx="41" cy="37" r="1.9"/>'
        f'<path {S} d="M16 46h8M44 46h8M48 42v8"/>'
        + Z.format(x=50, y=14) + Q.format(x=32, y=46)
    ),
    # 十字符號怪：十字形，一眼大一眼瞇，四個端點各有一個小「×」
    'm-cross': (
        '<path fill="var(--m-body)" d="M23 8h18v15h15v18H41v15H23V41H8V23h15z"/>'
        '<circle fill="var(--m-eye)" cx="26" cy="31" r="5.5"/><circle fill="var(--m-pupil)" cx="27" cy="32" r="2.5"/>'
        f'<path {S} d="M36 31h8"/>'
        f'<path {S} d="M27 41q5 4 10 0"/>'
        f'<path {S} stroke-width="2.2" d="M30 13l4 4M34 13l-4 4M12 29l4 4M16 29l-4 4M48 29l4 4M52 29l-4 4M30 48l4 4M34 48l-4 4"/>'
        + Z.format(x=46, y=14) + Q.format(x=32, y=42)
    ),
    # 零的隱者：戴兜帽的環，眼睛從洞裡看出來，腳邊藏著一個小 0
    'm-ring': (
        '<path fill="var(--m-body)" fill-rule="evenodd" d="M32 6a25 25 0 1 0 0 50 25 25 0 0 0 0-50zm0 15a10 10 0 1 1 0 20 10 10 0 0 1 0-20z"/>'
        '<path fill="var(--m-feat)" opacity=".6" d="M12 24a22 22 0 0 1 40 0q-10-7-20-7t-20 7z"/>'
        '<circle fill="var(--m-eye)" cx="26" cy="31" r="3.6"/><circle fill="var(--m-pupil)" cx="27" cy="32" r="1.7"/>'
        '<circle fill="var(--m-eye)" cx="38" cy="31" r="3.6"/><circle fill="var(--m-pupil)" cx="39" cy="32" r="1.7"/>'
        f'<ellipse {S} stroke-width="2.4" cx="46" cy="57" rx="4" ry="5"/>'
        + Z.format(x=50, y=12) + Q.format(x=32, y=40)
    ),
}

if __name__ == '__main__':
    out = ['<!-- 八隻怪 v2，由 _src/monsters.py 產生；顏色走 CSS 變數，五種狀態只換變數 -->']
    for k, v in MONS.items():
        out.append(f'<symbol id="{k}" viewBox="0 0 64 64">{v}</symbol>')
    print('\n'.join(out))
