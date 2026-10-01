"""數學題目變體引擎（0.3）：對冒險世界八隻數學怪各寫一個參數化產生器，用種子（seed）決定性產出題目。

全部是純函式，不碰資料庫；數字由 tests/test_variants.py 鎖住。
- generate(monster_id, seed, difficulty)：回一題（題幹、四個選項、答案與 trap 的索引、為什麼、解題步驟、參數、variant_key）。
  trap 一定是「那隻怪的錯法」（漏項獸漏中間項、負號幽靈只變第一項、拆根蟲拆成兩個根號、雙面根 ±、斜邊迷霧認錯斜邊、
  平方差雙子兩個都減、十字符號怪符號錯、零的隱者丟掉 x = 0）；另外兩個干擾項是別的常見錯。
- check(variant)：規則版的「AI 三檢查」——答案唯一且在選項裡、trap 與答案不同且四個選項互不相同、答案可由參數重算（能算的就實際算）。
- bank(monster_id, n, route, seed)：n 題互不重複（variant_key 去重）；threshold(size) = size × 6 ＋ 4；ready() 回是否達標。
- 路線＝難度：plain → hills → ridge → cloud，係數範圍依 DIFFICULTY_FACTOR 放大，雲頂線混入跨章節元素。
- 題幹用純文字數學（²、√、−），不用 LaTeX。answer_token 用 HMAC 簽章，金鑰從設定來，程式碼裡不放金鑰。
"""

import base64
import hashlib
import hmac
import json
import math
import random
from fractions import Fraction
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple, Union

from .world import ROUTES

MINUS = "−"
SUPS = {0: "", 1: "", 2: "²", 3: "³"}
VARS = ("x", "a", "y")
MONSTERS = ("sq-cross", "sign-dist", "sqrt-split", "sqrt-abs", "pyth-hyp", "factor-diff", "factor-cross", "quad-zero")
# 每隻怪的錯法（trap 選項永遠對應這個）
TRAP_KINDS = {
    "sq-cross": "missing_middle",  # 漏中間項：(a+b)² 只剩 a² + b²
    "sign-dist": "first_term_only",  # 負號只給第一項
    "sqrt-split": "split_root",  # √(a+b) 拆成 √a + √b
    "sqrt-abs": "plus_minus",  # √(a²) 寫成 ±a
    "pyth-hyp": "wrong_hypotenuse",  # 認錯斜邊
    "factor-diff": "both_minus",  # 平方差兩個都減
    "factor-cross": "sign_swapped",  # 十字交乘符號錯
    "quad-zero": "dropped_zero",  # 兩邊除以 x，丟掉 x = 0
}
TRAP_LABELS = {
    "sq-cross": "漏掉中間項",
    "sign-dist": "負號只給第一項",
    "sqrt-split": "根號拆開各自開",
    "sqrt-abs": "√ 寫成 ±",
    "pyth-hyp": "認錯斜邊",
    "factor-diff": "平方差兩個都寫減",
    "factor-cross": "十字交乘符號換掉",
    "quad-zero": "弄丟 x = 0",
}
# 路線＝難度：係數範圍乘上這個係數；雲頂線加跨章節元素
DIFFICULTY_LEVEL = {"plain": 1, "hills": 2, "ridge": 3, "cloud": 4}
DIFFICULTY_FACTOR = {"plain": 1.0, "hills": 1.5, "ridge": 2.0, "cloud": 2.5}
CROSS_CHAPTER_ROUTE = "cloud"
OPTION_COUNT = 4
MAX_TRIES_PER_ITEM = 20  # bank 去重時每題最多試幾個種子
MAX_RETRY = 50  # 產生器遇到退化參數（例如 trap 剛好等於答案）重抽的次數
THRESHOLD_PER_MEMBER, THRESHOLD_BASE = 6, 4  # 門檻 = 隊伍人數 × 6 ＋ 4（六人隊 40 題）
TOKEN_MAX_INDEX = 200

# 畢氏三元數（股、股、斜邊），斜邊 ≤ 50；前 16 組斜邊 ≤ 40
TRIPLES: Sequence[Tuple[int, int, int]] = (
    (3, 4, 5),
    (6, 8, 10),
    (5, 12, 13),
    (9, 12, 15),
    (8, 15, 17),
    (12, 16, 20),
    (15, 20, 25),
    (7, 24, 25),
    (10, 24, 26),
    (20, 21, 29),
    (18, 24, 30),
    (16, 30, 34),
    (21, 28, 35),
    (12, 35, 37),
    (15, 36, 39),
    (24, 32, 40),
    (9, 40, 41),
    (27, 36, 45),
    (14, 48, 50),
    (30, 40, 50),
)

Poly = Dict[Tuple[int, ...], int]  # 指數元組 → 係數；單變數用 (次數,)，兩變數用 (x 次數, y 次數)


class _Retry(Exception):
    """產生器抽到退化參數，換一組重抽。"""


# ——— 純文字數學的格式化 ———
def _num(n: int) -> str:
    return f"{MINUS}{abs(n)}" if n < 0 else str(n)


def _norm(s: str) -> str:
    return str(s).replace(" ", "")


def _mono(exps: Tuple[int, ...], vars_: Sequence[str]) -> str:
    return "".join(f"{v}{SUPS[e]}" for v, e in zip(vars_, exps) if e > 0)


def _poly(p: Poly, vars_: Sequence[str] = ("x",)) -> str:
    """{(2,): 1, (1,): -6, (0,): 9} → 'x² − 6x + 9'；全零 → '0'。"""
    terms = [(k, c) for k, c in p.items() if c != 0]
    terms.sort(key=lambda kc: (-sum(kc[0]), tuple(-e for e in kc[0])))
    if not terms:
        return "0"
    out = ""
    for i, (k, c) in enumerate(terms):
        m = _mono(k, vars_)
        body = str(abs(c)) if not m else (m if abs(c) == 1 else f"{abs(c)}{m}")
        if i == 0:
            out = (MINUS if c < 0 else "") + body
        else:
            out += f" {MINUS if c < 0 else '+'} {body}"
    return out


def _cont(p: Poly, vars_: Sequence[str] = ("x",)) -> str:
    """接在別的式子後面的寫法：'− 2x + 4'。"""
    s = _poly(p, vars_)
    return f"{MINUS} {s[1:]}" if s.startswith(MINUS) else f"+ {s}"


def _u(*coefs: int) -> Poly:
    """由高次到低次的係數 → 單變數多項式。"""
    deg = len(coefs) - 1
    return {(deg - i,): c for i, c in enumerate(coefs) if c != 0}


def _coefs(p: Poly) -> List[int]:
    """單變數多項式 → 由高次到低次的係數清單。"""
    deg = max((k[0] for k in p), default=0)
    return [p.get((d,), 0) for d in range(deg, -1, -1)]


def _pmul(p: Poly, q: Poly) -> Poly:
    out: Poly = {}
    for k1, c1 in p.items():
        for k2, c2 in q.items():
            k = tuple(a + b for a, b in zip(k1, k2))
            out[k] = out.get(k, 0) + c1 * c2
    return {k: c for k, c in out.items() if c != 0}


def _padd(p: Poly, q: Poly, sign: int = 1) -> Poly:
    out = dict(p)
    for k, c in q.items():
        out[k] = out.get(k, 0) + sign * c
    return {k: c for k, c in out.items() if c != 0}


def _psub(p: Poly, q: Poly) -> Poly:
    return _padd(p, q, -1)


def _pscale(p: Poly, s: int) -> Poly:
    return {k: c * s for k, c in p.items() if c * s != 0}


def _bin(var: str, k: int, lead: int = 1) -> str:
    """(x + 3)、(x − 3)、(2x + 3)。"""
    return f"({_poly({(1,): lead, (0,): k}, (var,))})"


def _sqrt_str(n: int, simplify: bool = True) -> str:
    """√n 的純文字寫法：完全平方 → 整數；simplify → k√m；否則 √n。"""
    if n < 0:
        raise ValueError("根號裡不能是負數。")
    if n == 0:
        return "0"
    k = 1
    if simplify:
        for f in range(math.isqrt(n), 0, -1):
            if n % (f * f) == 0:
                k = f
                break
    else:
        r = math.isqrt(n)
        k = r if r * r == n else 1
    m = n // (k * k)
    if m == 1:
        return str(k)
    return f"√{m}" if k == 1 else f"{k}√{m}"


def _frac(num: int, den: int = 1) -> str:
    f = Fraction(num, den)
    if f.denominator == 1:
        return _num(f.numerator)
    return f"{MINUS if f < 0 else ''}{abs(f.numerator)}/{f.denominator}"


def _roots_str(roots: Sequence[Fraction]) -> str:
    return " 或 ".join(f"x = {_frac(r.numerator, r.denominator)}" for r in roots)


# ——— 抽數字的小工具 ———
def _top(base: int, difficulty: str) -> int:
    return int(round(base * DIFFICULTY_FACTOR[difficulty]))


def _nz(rng: random.Random, top: int, lo: Optional[int] = None) -> int:
    """[lo, top] 裡的非零整數；lo 不給就是 −top。"""
    lo = -top if lo is None else lo
    return rng.choice([v for v in range(lo, top + 1) if v != 0])


def _distractors(answer: str, trap: str, cands: Sequence[str]) -> List[str]:
    seen = {_norm(answer), _norm(trap)}
    out: List[str] = []
    for c in cands:
        if _norm(c) in seen:
            continue
        seen.add(_norm(c))
        out.append(c)
        if len(out) == OPTION_COUNT - 2:
            return out
    raise ValueError("干擾項不夠。")


# ——— 八隻怪的產生器：各回 {stem, answer, trap, cands, why, steps, params} ———
def _gen_sq_cross(rng: random.Random, d: str) -> Dict[str, Any]:
    """漏項獸：(ax + b)²。trap ＝ 只剩兩端平方 a²x² + b²。雲頂線換成兩個變數 (ax + by)²。"""
    var = rng.choice(VARS)
    b = rng.randint(1, _top(10, d)) * rng.choice((1, -1))
    lo, hi = {"plain": (1, 1), "hills": (1, 3), "ridge": (2, 5), "cloud": (2, 6)}[d]
    a = rng.randint(lo, hi)
    if d == CROSS_CHAPTER_ROUTE:
        vars_: Tuple[str, ...] = (var, "y" if var != "y" else "z")
        inner: Poly = {(1, 0): a, (0, 1): b}
        k_sq1, k_mid, k_sq2 = (2, 0), (1, 1), (0, 2)
    else:
        vars_ = (var,)
        inner = {(1,): a, (0,): b}
        k_sq1, k_mid, k_sq2 = (2,), (1,), (0,)
    full = _pmul(inner, inner)
    trap = {k_sq1: full[k_sq1], k_sq2: full[k_sq2]}
    half = {**full, k_mid: full[k_mid] // 2}
    neg_const = {**full, k_sq2: -full[k_sq2]}
    forgot_a = {**full, k_sq1: a}
    inner_s = _poly(inner, vars_)
    k_lin1, k_lin2 = ((1, 0), (0, 1)) if len(vars_) == 2 else ((1,), (0,))
    t1, t2 = _poly({k_lin1: a}, vars_), _poly({k_lin2: b}, vars_)
    t2p = f"({t2})" if b < 0 else t2
    mid = _poly({k_mid: full[k_mid]}, vars_)
    answer = _poly(full, vars_)
    return {
        "stem": f"({inner_s})² = ?",
        "answer": answer,
        "trap": _poly(trap, vars_),
        "cands": [_poly(half, vars_), _poly(forgot_a, vars_), _poly(neg_const, vars_)],
        "why": (
            f"平方是整個括號自己乘自己：({inner_s})({inner_s})。{t1} 和 {t2p} 會互相乘兩次，中間多出 {mid}；只剩 {_poly(trap, vars_)} 是把中間那兩塊弄丟了。"
        ),
        "steps": [
            f"({inner_s})² = ({inner_s})({inner_s})",
            f"{t1}·{t1} = {_poly({k_sq1: full[k_sq1]}, vars_)}；{t1}·{t2p} 和 {t2p}·{t1} 各一次，合起來 {mid}；"
            f"{t2p}·{t2p} = {_poly({k_sq2: full[k_sq2]}, vars_)}",
            f"= {answer}",
        ],
        "params": {"a": a, "b": b, "var": var, "var2": vars_[1] if len(vars_) == 2 else "", "magnitude": max(abs(a), abs(b))},
    }


def _solve_sq_cross(p: Dict[str, Any], d: str) -> str:
    if p["var2"]:
        inner: Poly = {(1, 0): p["a"], (0, 1): p["b"]}
        return _poly(_pmul(inner, inner), (p["var"], p["var2"]))
    inner = {(1,): p["a"], (0,): p["b"]}
    return _poly(_pmul(inner, inner), (p["var"],))


def _gen_sign_dist(rng: random.Random, d: str) -> Dict[str, Any]:
    """負號幽靈：A − (B)。trap ＝ 只有 B 的第一項變號。雲頂線前面換成 (x + b)²（跨乘法公式）。"""
    top = _top(6, d)
    head = ""
    magnitude = 0
    if d == "plain":
        p, r = rng.randint(1, top), rng.randint(1, top)
        while r == p:
            r = rng.randint(1, top)
        a_poly, b_poly = _u(p, _nz(rng, top)), _u(r, _nz(rng, top))
    elif d in ("hills", "ridge"):
        lo = -top if d == "ridge" else 1
        p2, r2 = _nz(rng, top, lo), _nz(rng, top, lo)
        while r2 == p2:
            r2 = _nz(rng, top, lo)
        a_poly = _u(p2, _nz(rng, top), _nz(rng, top))
        b_poly = _u(r2, _nz(rng, top), _nz(rng, top))
    else:
        b, c, e = _nz(rng, top), _nz(rng, top), _nz(rng, top)
        while c == 2 * b:
            c = _nz(rng, top)
        a_poly = _pmul(_u(1, b), _u(1, b))
        b_poly = _u(1, c, e)
        head = f"({_poly(_u(1, b))})²"
        magnitude = max(abs(b), abs(c), abs(e))
    head = head or f"({_poly(a_poly)})"
    answer = _psub(a_poly, b_poly)
    first = max(b_poly, key=lambda k: k[0])
    rest = {k: v for k, v in b_poly.items() if k != first}
    trap = _padd(_psub(a_poly, {first: b_poly[first]}), rest)
    neg_b = _pscale(b_poly, -1)
    answer_s = _poly(answer)
    return {
        "stem": f"{head} − ({_poly(b_poly)}) = ?",
        "answer": answer_s,
        "trap": _poly(trap),
        "cands": [_poly(_padd(a_poly, b_poly)), _poly(_psub(b_poly, a_poly)), _poly({**answer, (0,): -answer.get((0,), 0)})],
        "why": f"減號要分給括號裡的每一項：−({_poly(b_poly)}) = {_poly(neg_b)}，不是只有第一項變號；{_poly(trap)} 是後面的項忘了變號。",
        "steps": [
            f"先把減號發給括號裡每一項：−({_poly(b_poly)}) = {_poly(neg_b)}",
            f"去掉括號：{_poly(a_poly)} {_cont(neg_b)}",
            f"合併同類項：= {answer_s}",
        ],
        "params": {"a": _coefs(a_poly), "b": _coefs(b_poly), "magnitude": magnitude or max(abs(c) for c in _coefs(a_poly) + _coefs(b_poly))},
    }


def _solve_sign_dist(p: Dict[str, Any], d: str) -> str:
    return _poly(_psub(_u(*p["a"]), _u(*p["b"])))


def _gen_sqrt_split(rng: random.Random, d: str) -> Dict[str, Any]:
    """拆根蟲：√(a² ± b² …)。trap ＝ 拆開各自開根號 a ± b。雲頂線裡面寫成 (−a)²（跨雙面根）。"""
    neg: List[bool] = []
    if d == "plain":
        a, b, c = rng.choice(TRIPLES[:11])
        if rng.random() < 0.5:
            roots, signs = [a, b], [1, 1]
            if rng.random() < 0.5:
                roots.reverse()
        else:
            small = rng.choice((a, b))
            roots, signs = [c, small], [1, -1]
    elif d == "hills":
        a, b = rng.randint(1, 12), rng.randint(1, 12)
        if a != b and rng.random() < 0.5:
            roots, signs = [max(a, b), min(a, b)], [1, -1]
        else:
            roots, signs = [a, b], [1, 1]
    elif d == "ridge":
        a, b, c = rng.randint(1, 15), rng.randint(1, 15), rng.randint(1, 15)
        if rng.random() < 0.5 and a * a + b * b > c * c:
            roots, signs = [a, b, c], [1, 1, -1]
        else:
            roots, signs = [a, b, c], [1, 1, 1]
    else:
        a, b, c = rng.choice(TRIPLES)
        if rng.random() < 0.5:
            roots, signs = [a, b], [1, 1]
        else:
            roots, signs = [c, rng.choice((a, b))], [1, -1]
        neg = rng.choice(([True, False], [False, True], [True, True]))
    n = sum(s * r * r for s, r in zip(signs, roots))
    trap_v = sum(s * r for s, r in zip(signs, roots))
    answer = _sqrt_str(n)
    trap = _num(trap_v)
    if _norm(answer) == _norm(trap) or n <= 0:
        raise _Retry()
    if neg:
        sq = [f"({MINUS}{r})²" if ng else f"{r}²" for r, ng in zip(roots, neg)]
        inside = f"{sq[0]} {'+' if signs[1] > 0 else MINUS} {sq[1]}"
        split = f"√({sq[0]}) {'+' if signs[1] > 0 else MINUS} √({sq[1]})"
    else:
        inside = " ".join(f"{'+' if s > 0 else MINUS} {r * r}" if i else str(r * r) for i, (s, r) in enumerate(zip(signs, roots)))
        split = " ".join(f"{'+' if s > 0 else MINUS} √{r * r}" if i else f"√{r * r}" for i, (s, r) in enumerate(zip(signs, roots)))
    sq = math.isqrt(n)
    step2 = f"√{n} = {answer}" if sq * sq == n else f"{n} 不是完全平方：√{n} 化簡成 {answer}"
    return {
        "stem": f"√({inside}) = ?",
        "answer": answer,
        "trap": trap,
        "cands": [str(n), str(abs(roots[0] * roots[1])), _num(roots[0] - roots[1]), str(trap_v + 1), str(n + 1)],
        "why": f"根號是一個整體，裡面要先算完再開根號：√({inside}) = √{n} = {answer}。{split} = {trap} 是把根號拆開了，√(a ± b) ≠ √a ± √b。",
        "steps": [f"先算根號裡面：{inside} = {n}", step2, f"所以 √({inside}) = {answer}；拆開算 {split} = {trap} 不是 √ 的規則"],
        "params": {"roots": roots, "signs": signs, "neg": neg or [], "magnitude": max(roots)},
    }


def _solve_sqrt_split(p: Dict[str, Any], d: str) -> str:
    return _sqrt_str(sum(s * r * r for s, r in zip(p["signs"], p["roots"])))


def _gen_sqrt_abs(rng: random.Random, d: str) -> Dict[str, Any]:
    """雙面根：√((−k)²)。trap ＝ ±k。雲頂線 √((−a)² + (−b)²)（跨畢氏三元數）。"""
    top = _top(15, d)
    form = {"plain": rng.choice(("direct", "let")), "hills": rng.choice(("direct", "let", "neg")), "ridge": rng.choice(("diff", "sum")), "cloud": "cross"}[d]
    var = rng.choice(VARS)
    k = rng.randint(2, top)
    a = b = 0
    if form == "direct":
        stem, value, cands = f"√(({MINUS}{k})²) = ?", k, [_num(-k), str(k * k), str(2 * k)]
        steps = [f"先算根號裡面：({MINUS}{k})² = {k * k}", f"√{k * k} 只取不是負的那一個：{k}", f"所以 √(({MINUS}{k})²) = {k}"]
    elif form == "let":
        stem, value, cands = f"若 {var} = {MINUS}{k}，√({var}²) = ?", k, [_num(-k), str(k * k), str(2 * k)]
        steps = [f"先算根號裡面：{var}² = ({MINUS}{k})² = {k * k}", f"√{k * k} 只取不是負的那一個：{k}", f"所以 √({var}²) = {k}，也就是 |{var}|"]
    elif form == "neg":
        stem, value, cands = f"{MINUS}√(({MINUS}{k})²) = ?", -k, [str(k), str(k * k), _num(-k * k)]
        steps = [f"先算根號裡面：({MINUS}{k})² = {k * k}", f"√{k * k} = {k}（√ 本身不是負的）", f"前面還有一個負號：{MINUS}{k}"]
    elif form == "diff":
        a = rng.randint(1, top)
        b = rng.randint(a + 1, top + 1)
        stem, value, cands = f"√(({a} − {b})²) = ?", b - a, [_num(a - b), str((b - a) * (b - a)), str(a + b)]
        steps = [
            f"先算根號裡面：({a} − {b})² = ({MINUS}{b - a})² = {(b - a) ** 2}",
            f"√{(b - a) ** 2} 只取不是負的那一個：{b - a}",
            f"所以答案是 {b - a}，也就是 |{a} − {b}|",
        ]
    elif form == "sum":
        a, b = rng.randint(1, top), rng.randint(1, top)
        stem, value, cands = f"√(({MINUS}{a})²) + √(({MINUS}{b})²) = ?", a + b, [_num(-a - b), _num(b - a), str(a * a + b * b)]
        steps = [f"√(({MINUS}{a})²) = {a}，√(({MINUS}{b})²) = {b}（各自只取不是負的）", f"{a} + {b} = {a + b}", f"所以答案是 {a + b}"]
    else:
        a, b, value = rng.choice(TRIPLES)
        neg = rng.choice(((True, True), (True, False), (False, True)))  # 哪幾個股寫成負數的平方
        sq = [f"({MINUS}{v})²" if ng else f"{v}²" for v, ng in zip((a, b), neg)]
        stem, cands = f"√({sq[0]} + {sq[1]}) = ?", [_num(-value), str(a + b), str(value * value)]
        steps = [
            f"根號裡面先算完：{sq[0]} + {sq[1]} = {a * a} + {b * b} = {value * value}",
            f"√{value * value} 只取不是負的那一個：{value}",
            f"所以答案是 {value}",
        ]
        k = int(neg[0]) * 2 + int(neg[1])  # 借 k 記哪種寫法，進 variant_key
    return {
        "stem": stem,
        "answer": _num(value),
        "trap": f"±{abs(value)}",
        "cands": cands,
        "why": (
            f"√ 開出來一定不是負的：√(a²) = |a|。方程式 x² = {abs(value) ** 2} 才有 ±{abs(value)} 兩個解；√ 這個符號只指不是負的那一個，所以是 {_num(value)}。"
        ),
        "steps": steps,
        "params": {
            "form": form,
            "k": k if form in ("direct", "let", "neg", "cross") else 0,  # 沒用到的數字不進 variant_key，免得同一題算成兩題
            "a": a,
            "b": b,
            "var": var if form == "let" else "",
            "magnitude": max(k if form in ("direct", "let", "neg") else 0, a, b),
        },
    }


def _solve_sqrt_abs(p: Dict[str, Any], d: str) -> str:
    form, k, a, b = p["form"], p["k"], p["a"], p["b"]
    if form in ("direct", "let"):
        return _num(math.isqrt((-k) ** 2))
    if form == "neg":
        return _num(-math.isqrt((-k) ** 2))
    if form == "diff":
        return _num(math.isqrt((a - b) ** 2))
    if form == "sum":
        return _num(math.isqrt((-a) ** 2) + math.isqrt((-b) ** 2))
    return _sqrt_str((-a) ** 2 + (-b) ** 2)


def _gen_pyth(rng: random.Random, d: str) -> Dict[str, Any]:
    """斜邊迷霧：已知斜邊與一股求另一股（trap ＝ 把斜邊當股用加的），或已知兩股求斜邊（trap ＝ 把長的股當斜邊）。
    丘陵線起用頂點寫法（∠B = 90° 要自己找斜邊）；山徑線與雲頂線答案是化簡根式（跨平方根）。"""
    simplify = d in ("ridge", "cloud")
    style = "text" if d == "plain" else "vertex"
    if d in ("plain", "hills"):
        a, b, c = rng.choice(TRIPLES[:16] if d == "plain" else TRIPLES)
        form = rng.choice(("leg", "hyp"))
        if form == "leg" and rng.random() < 0.5:
            a, b = b, a
    elif d == "ridge":
        form = "leg"
        c = rng.randint(4, 20)
        a = rng.randint(1, c - 1)
        b = 0
    else:
        form = "hyp"
        a, b = rng.randint(1, 15), rng.randint(1, 15)
        while b == a:
            b = rng.randint(1, 15)
        c = 0
    if form == "leg":
        n, n_trap = c * c - a * a, c * c + a * a
        answer, trap = _sqrt_str(n, simplify), _sqrt_str(n_trap, simplify)
        cands = [str(c - a), str(n), str(c + a)]
    else:
        n, n_trap = a * a + b * b, abs(b * b - a * a)
        answer, trap = _sqrt_str(n, simplify), _sqrt_str(n_trap, simplify)
        cands = [str(a + b), str(n), str(abs(a - b))]
    if _norm(answer) == _norm(trap):
        raise _Retry()
    if style == "text":
        stem = f"直角三角形斜邊 {c}、一股 {a}，另一股 = ?" if form == "leg" else f"直角三角形兩股 {a} 和 {b}，斜邊 = ?"
        find = f"先找斜邊：對著直角、最長的那條是 {c}" if form == "leg" else f"兩股是 {a} 和 {b}；斜邊對著直角，是要求的那條"
    else:
        right = rng.choice("ABC")
        p_, q_ = [v for v in "ABC" if v != right]
        hyp_name = "".join(sorted(p_ + q_))
        leg1, leg2 = "".join(sorted(right + p_)), "".join(sorted(right + q_))
        if form == "leg":
            stem = f"△ABC 中，∠{right} = 90°，{hyp_name} = {c}、{leg1} = {a}，{leg2} = ?"
            find = f"先找斜邊：對著直角 ∠{right} 的是 {hyp_name} = {c}，不是看哪條寫在右上"
        else:
            stem = f"△ABC 中，∠{right} = 90°，{leg1} = {a}、{leg2} = {b}，{hyp_name} = ?"
            find = f"斜邊對著直角 ∠{right}，是 {hyp_name}；{leg1} 與 {leg2} 都是股"
    if form == "leg":
        steps = [find, f"另一股² = {c}² − {a}² = {c * c} − {a * a} = {n}", f"開根號：√{n} = {answer}"]
        why = f"斜邊永遠對著直角，是最長的那條。斜邊² ＝ 兩股² 的和，已知斜邊求股要用減的：√({c}² − {a}²) = {answer}；{trap} 是把斜邊當成股拿去加。"
    else:
        steps = [find, f"斜邊² = {a}² + {b}² = {a * a} + {b * b} = {n}", f"開根號：√{n} = {answer}"]
        why = f"斜邊永遠對著直角、不是看哪條比較長就當斜邊。兩股 {a}、{b} 平方相加再開根號：{answer}；{trap} 是把 {max(a, b)} 誤當成斜邊。"
    return {
        "stem": stem,
        "answer": answer,
        "trap": trap,
        "cands": cands,
        "why": why,
        "steps": steps,
        "params": {"form": form, "style": style, "hyp": c, "legs": [a, b], "magnitude": max(a, b, c)},
    }


def _solve_pyth(p: Dict[str, Any], d: str) -> str:
    simplify = d in ("ridge", "cloud")
    a, b = p["legs"]
    if p["form"] == "leg":
        return _sqrt_str(p["hyp"] ** 2 - a * a, simplify)
    return _sqrt_str(a * a + b * b, simplify)


def _gen_factor_diff(rng: random.Random, d: str) -> Dict[str, Any]:
    """平方差雙子：a²x² − b²。trap ＝ 兩個都寫減 (ax − b)²。山徑線兩個變數；雲頂線 (x + c)² − b²（跨完全平方）。"""
    var = rng.choice(VARS)
    top = _top(10, d)
    b = rng.randint(1, top)
    c = 0
    if d == "plain":
        a, form = 1, rng.choice(("x2-b2", "b2-x2"))
    elif d == "hills":
        a, form = rng.randint(2, 5), "x2-b2"
    elif d == "ridge":
        a, form = rng.randint(1, 6), "two-var"
    else:
        a, form = 1, "shift"
        c = _nz(rng, top)
        while abs(c) == b:
            c = _nz(rng, top)
    x = var
    ax = _poly({(1,): a}, (x,))
    if form == "x2-b2":
        stem = _poly({(2,): a * a, (0,): -b * b}, (x,))
        answer = f"{_bin(x, b, a)}{_bin(x, -b, a)}"
        trap = f"{_bin(x, -b, a)}²"
        cands = [f"{_bin(x, b, a)}²", f"{_bin(x, b, a * a)}{_bin(x, -b)}" if a > 1 else f"{_bin(x, 2 * b)}{_bin(x, -2 * b)}", f"{ax}{_bin(x, -b, a)}"]
        name = f"{_poly({(2,): a * a}, (x,))} = ({ax})²，{b * b} = {b}²"
    elif form == "b2-x2":
        stem = f"{b * b} − {x}²"
        answer = f"({b} + {x})({b} − {x})"
        trap = f"({b} − {x})²"
        cands = [f"({b} + {x})²", f"{_bin(x, b)}{_bin(x, -b)}", f"({2 * b} + {x})({2 * b} − {x})"]
        name = f"{b * b} = {b}²，所以是 {b}² − {x}²"
    elif form == "two-var":
        y = "y" if x != "y" else "z"
        stem = _poly({(2, 0): a * a, (0, 2): -b * b}, (x, y))
        f1 = _poly({(1, 0): a, (0, 1): b}, (x, y))
        f2 = _poly({(1, 0): a, (0, 1): -b}, (x, y))
        answer, trap = f"({f1})({f2})", f"({f2})²"
        cands = [f"({f1})²", f"({f1})({ax} − {b})", f"{ax}({f2})"]
        name = f"{_poly({(2, 0): a * a}, (x, y))} = ({ax})²，{_poly({(0, 2): b * b}, (x, y))} = ({_poly({(0, 1): b}, (x, y))})²"
    else:
        stem = f"{_bin(x, c)}² − {b * b}"
        answer = f"{_bin(x, c + b)}{_bin(x, c - b)}"
        trap = f"{_bin(x, c - b)}²"
        cands = [f"{_bin(x, c + b)}²", f"{_bin(x, c)}{_bin(x, -b)}", f"{_bin(x, c + b)}{_bin(x, b - c)}"]
        name = f"把 {_bin(x, c)} 整個看成一塊：{_bin(x, c)}² − {b}²"
    return {
        "stem": f"{stem} = ?",
        "answer": answer,
        "trap": trap,
        "cands": cands,
        "why": f"平方差是一個加、一個減：A² − B² = (A + B)(A − B)，乘開以後 +AB 與 −AB 才會抵消。{trap} 乘開會多出中間項，不是原式。",
        "steps": [name, "平方差是一個加、一個減：(A + B)(A − B)，乘回去中間兩塊才會相消", f"所以 {stem} = {answer}"],
        "params": {"form": form, "a": a, "b": b, "c": c, "var": var, "magnitude": max(a, b, abs(c))},
    }


def _solve_factor_diff(p: Dict[str, Any], d: str) -> str:
    """把答案的兩個因式乘回去，要等於題幹；不等就是產生器有錯。"""
    form, a, b, c, x = p["form"], p["a"], p["b"], p["c"], p["var"]
    if form == "x2-b2":
        f1, f2, stem = {(1,): a, (0,): b}, {(1,): a, (0,): -b}, {(2,): a * a, (0,): -b * b}
        answer = f"{_bin(x, b, a)}{_bin(x, -b, a)}"
    elif form == "b2-x2":
        f1, f2, stem = {(0,): b, (1,): 1}, {(0,): b, (1,): -1}, {(0,): b * b, (2,): -1}
        answer = f"({b} + {x})({b} − {x})"
    elif form == "two-var":
        y = "y" if x != "y" else "z"
        f1, f2, stem = {(1, 0): a, (0, 1): b}, {(1, 0): a, (0, 1): -b}, {(2, 0): a * a, (0, 2): -b * b}
        answer = f"({_poly(f1, (x, y))})({_poly(f2, (x, y))})"
    else:
        f1, f2 = {(1,): 1, (0,): c + b}, {(1,): 1, (0,): c - b}
        stem = _psub(_pmul(_u(1, c), _u(1, c)), {(0,): b * b})
        answer = f"{_bin(x, c + b)}{_bin(x, c - b)}"
    if _pmul(f1, f2) != stem:
        raise ValueError("因式乘回去不等於題幹。")
    return answer


def _other_pair(p: int, q: int) -> Optional[Tuple[int, int]]:
    """乘起來一樣、加起來不一樣的另一組整數（給十字交乘的干擾項）。"""
    n = p * q
    for u in range(abs(n), 0, -1):
        for uu in (u, -u):
            if n % uu:
                continue
            v = n // uu
            pair = tuple(sorted((uu, v), reverse=True))
            if set(pair) != {p, q} and uu + v != p + q:
                return pair  # type: ignore[return-value]
    return None


def _gen_factor_cross(rng: random.Random, d: str) -> Dict[str, Any]:
    """十字符號怪：x² + (p+q)x + pq。trap ＝ 數字對、符號全換 (x − p)(x − q)。山徑線首項係數 2～3；雲頂線先提公因式（跨提公因式）。"""
    top = _top(6, d)
    vals = [v for v in range(-top, top + 1) if v != 0]
    lead = rng.randint(2, 3) if d == "ridge" else 1
    k = rng.randint(2, 3) if d == CROSS_CHAPTER_ROUTE else 1
    p, q = rng.sample(vals, 2)
    if lead == 1:
        p, q = sorted((p, q), reverse=True)
    if p in (lead * q, -lead * q):
        raise _Retry()
    f1, f2 = _u(lead, p), _u(1, q)
    stem_poly = _pscale(_pmul(f1, f2), k)
    pre = str(k) if k > 1 else ""
    answer = f"{pre}({_poly(f1)})({_poly(f2)})"
    trap = f"{pre}({_poly(_u(lead, -p))})({_poly(_u(1, -q))})"
    cands = []
    other = _other_pair(p, q) if lead == 1 and k == 1 else None
    if other:
        cands.append(f"({_poly(_u(1, other[0]))})({_poly(_u(1, other[1]))})")
    cands += [f"{pre}({_poly(f1)})({_poly(_u(1, -q))})", f"{pre}({_poly(_u(lead, -p))})({_poly(f2)})", f"{pre}({_poly(_u(1, p + q))})({_poly(_u(1, 1))})"]
    mid = stem_poly.get((1,), 0)
    const = stem_poly.get((0,), 0)
    if lead == 1:
        find = f"找兩個數：乘起來是 {_num(const // k)}、加起來是 {_num(mid // k)} → {_num(p)} 和 {_num(q)}"
        verify = f"驗算中間項：{_num(p)}x + {_num(q)}x = {_poly({(1,): p + q})}（符號換掉會變成 {_poly({(1,): -(p + q)})}）"
    else:
        find = f"十字交乘：{lead}x 配 {_num(q)}、x 配 {_num(p)}，交叉相乘 {_num(lead * q)} 與 {_num(p)} 相加要是 {_num(mid)}"
        verify = f"驗算中間項：{_poly({(1,): lead * q})} {_cont({(1,): p})} = {_poly({(1,): mid})}"
    steps = ([f"先提公因式 {k}：{_poly(stem_poly)} = {k}({_poly(_pmul(f1, f2))})"] if k > 1 else []) + [find, verify, f"寫成 {answer}"]
    return {
        "stem": f"{_poly(stem_poly)} = ?",
        "answer": answer,
        "trap": trap,
        "cands": cands,
        "why": (
            f"十字交乘兩個數要同時滿足「乘起來是常數項、加起來是中間項」：{_num(p)} 和 {_num(q)}。"
            f"{trap} 數字對了但符號換掉，乘回去中間項變成 {_poly({(1,): -mid})}；把符號乘回去驗算一次就會露餡。"
        ),
        "steps": steps,
        "params": {"lead": lead, "k": k, "p": p, "q": q, "stem": _coefs(stem_poly), "magnitude": max(abs(p), abs(q), lead, k)},
    }


def _solve_factor_cross(p: Dict[str, Any], d: str) -> str:
    f1, f2 = _u(p["lead"], p["p"]), _u(1, p["q"])
    if _coefs(_pscale(_pmul(f1, f2), p["k"])) != p["stem"]:
        raise ValueError("因式乘回去不等於題幹。")
    pre = str(p["k"]) if p["k"] > 1 else ""
    return f"{pre}({_poly(f1)})({_poly(f2)})"


def _gen_quad_zero(rng: random.Random, d: str) -> Dict[str, Any]:
    """零的隱者：ax² = bx。trap ＝ 兩邊除以 x 只剩 x = b/a。山徑線 b/a 不是整數；雲頂線 (x + c)² = k(x + c)（跨配方）。"""
    top = _top(12, d)
    a, b, c, k = 1, 0, 0, 0
    mag = 0
    if d == "plain":
        b = _nz(rng, top)
        form = rng.choice(("eq", "prod"))
        stem = f"解 x² = {_poly({(1,): b})}" if form == "eq" else f"解 x({_poly(_u(1, -b))}) = 0"
    elif d == "hills":
        a, b = rng.randint(2, 4), 0
        form = rng.choice(("eq", "move"))
        if form == "eq":
            b = a * _nz(rng, top)
            mag = max(a, abs(b // a))
            stem = f"解 {_poly({(2,): a})} = {_poly({(1,): b})}"
        else:
            a, b = 1, _nz(rng, top)
            stem = f"解 {_poly(_u(1, -b, 0))} = 0"
    elif d == "ridge":
        form = "eq"
        a = rng.randint(2, 6)
        b = _nz(rng, top)
        while b % a == 0:
            b = _nz(rng, top)
        stem = f"解 {_poly({(2,): a})} = {_poly({(1,): b})}"
    else:
        form = "shift"
        c, k = _nz(rng, top), _nz(rng, top)
        stem = f"解 {_bin('x', c)}² = {_num(k) if k != 1 else ''}{_bin('x', c)}"
    if form == "shift":
        roots = [Fraction(-c), Fraction(k - c)]
        trap = f"x = {_num(k - c)}"
        cands = [f"x = {_num(c)} 或 x = {_num(k - c)}", f"x = {_num(-c)}", f"x = ±{abs(k - c)}"]
        steps = [
            f"先不要兩邊除以 {_bin('x', c)}，它可能是 0。移項：{_bin('x', c)}² − {_num(k) if k != 1 else ''}{_bin('x', c)} = 0",
            f"提出公因式 {_bin('x', c)}：{_bin('x', c)}({_poly(_u(1, c - k))}) = 0",
            f"兩個數相乘等於 0，至少一個是 0 → {_roots_str(roots)}",
        ]
        why = f"{_bin('x', c)} 可能等於 0，不能拿它當除數；提出公因式才會兩個解都留著。{trap} 是把 x = {_num(-c)} 弄丟了。"
    else:
        roots = [Fraction(0), Fraction(b, a)]
        trap = f"x = {_frac(b, a)}"
        cands = [f"x = 0 或 x = {_frac(-b, a)}", f"x = ±{_frac(abs(b), a)}", "x = 0"]
        moved = _poly(_u(a, -b, 0))
        steps = [
            f"先不要兩邊除以 x，x 可能是 0。移項：{moved} = 0",
            f"提出公因式 x：x({_poly(_u(a, -b))}) = 0",
            f"兩個數相乘等於 0，至少一個是 0 → {_roots_str(roots)}",
        ]
        why = f"x 可能是 0，不能拿它當除數；移項提出 x：x({_poly(_u(a, -b))}) = 0，兩個解都留著。{trap} 是兩邊除以 x 把 x = 0 弄丟了。"
    return {
        "stem": stem,
        "answer": _roots_str(roots),
        "trap": trap,
        "cands": cands,
        "why": why,
        "steps": steps,
        "params": {"form": form, "a": a, "b": b, "c": c, "k": k, "magnitude": mag or max(a, abs(b), abs(c), abs(k))},
    }


def _solve_quad_zero(p: Dict[str, Any], d: str) -> str:
    """算出兩個根，再代回原方程式驗算。"""
    a, b, c, k = p["a"], p["b"], p["c"], p["k"]
    if p["form"] == "shift":
        roots = [Fraction(-c), Fraction(k - c)]
        for r in roots:
            if (r + c) ** 2 != k * (r + c):
                raise ValueError("根代回去不成立。")
    else:
        roots = [Fraction(0), Fraction(b, a)]
        for r in roots:
            if a * r * r != b * r:
                raise ValueError("根代回去不成立。")
    return _roots_str(roots)


GENERATORS: Dict[str, Callable[[random.Random, str], Dict[str, Any]]] = {
    "sq-cross": _gen_sq_cross,
    "sign-dist": _gen_sign_dist,
    "sqrt-split": _gen_sqrt_split,
    "sqrt-abs": _gen_sqrt_abs,
    "pyth-hyp": _gen_pyth,
    "factor-diff": _gen_factor_diff,
    "factor-cross": _gen_factor_cross,
    "quad-zero": _gen_quad_zero,
}
SOLVERS: Dict[str, Callable[[Dict[str, Any], str], str]] = {
    "sq-cross": _solve_sq_cross,
    "sign-dist": _solve_sign_dist,
    "sqrt-split": _solve_sqrt_split,
    "sqrt-abs": _solve_sqrt_abs,
    "pyth-hyp": _solve_pyth,
    "factor-diff": _solve_factor_diff,
    "factor-cross": _solve_factor_cross,
    "quad-zero": _solve_quad_zero,
}


# ——— 產生、三檢查、題庫 ———
def variant_key(monster_id: str, difficulty: str, params: Dict[str, Any]) -> str:
    body = ",".join(f"{k}={v}" for k, v in sorted(params.items()) if k != "magnitude")
    return f"{monster_id}:{difficulty}:{body}"


def generate(monster_id: str, seed: Union[int, str], difficulty: str = "plain") -> Dict[str, Any]:
    """同一組 (monster_id, seed, difficulty) 永遠產出同一題。"""
    if monster_id not in GENERATORS:
        raise ValueError(f"沒有這隻怪的產生器：{monster_id}")
    if difficulty not in ROUTES:
        raise ValueError(f"沒有這條路線：{difficulty}")
    rng = random.Random(f"{monster_id}|{difficulty}|{seed}")
    for _ in range(MAX_RETRY):
        try:
            g = GENERATORS[monster_id](rng, difficulty)
            break
        except _Retry:
            continue
    else:
        raise ValueError(f"{monster_id} 在 {difficulty} 抽不到合適的參數。")
    d1, d2 = _distractors(g["answer"], g["trap"], g["cands"])
    order = list(range(OPTION_COUNT))
    rng.shuffle(order)
    pool = [g["answer"], g["trap"], d1, d2]
    return {
        "monster_id": monster_id,
        "difficulty": difficulty,
        "level": DIFFICULTY_LEVEL[difficulty],
        "cross_chapter": difficulty == CROSS_CHAPTER_ROUTE,
        "stem": g["stem"],
        "options": [pool[i] for i in order],
        "answer": order.index(0),
        "trap": order.index(1),
        "trap_kind": TRAP_KINDS[monster_id],
        "trap_label": TRAP_LABELS[monster_id],
        "why": g["why"],
        "steps": list(g["steps"]),
        "params": dict(g["params"]),
        "variant_key": variant_key(monster_id, difficulty, g["params"]),
    }


CHECKS = ("unique_answer", "distinct_options", "solvable")


def check(variant: Dict[str, Any]) -> Dict[str, Any]:
    """規則版「AI 三檢查」：不過就丟 ValueError。
    1. 答案唯一且在選項裡；2. trap 與答案不同、四個選項互不相同；3. 用參數重算答案要等於選項裡的答案，且最後一步要得出答案。"""
    for key in ("stem", "options", "answer", "trap", "why", "steps", "difficulty", "monster_id", "variant_key"):
        if key not in variant:
            raise ValueError(f"變體缺少欄位：{key}")
    m, d = variant["monster_id"], variant["difficulty"]
    if m not in SOLVERS:
        raise ValueError(f"沒有這隻怪：{m}")
    if d not in ROUTES:
        raise ValueError(f"沒有這條路線：{d}")
    opts = variant["options"]
    if not isinstance(opts, list) or len(opts) != OPTION_COUNT or not all(isinstance(o, str) and o.strip() for o in opts):
        raise ValueError(f"選項要剛好 {OPTION_COUNT} 個非空字串。")
    normed = [_norm(o) for o in opts]
    ans, trap = variant["answer"], variant["trap"]
    # 1. 答案唯一且在選項裡
    if not isinstance(ans, int) or not 0 <= ans < OPTION_COUNT:
        raise ValueError("答案索引不在選項裡。")
    if normed.count(normed[ans]) != 1:
        raise ValueError("答案在選項裡不唯一。")
    # 2. trap ≠ 答案、干擾項互不相同
    if not isinstance(trap, int) or not 0 <= trap < OPTION_COUNT:
        raise ValueError("trap 索引不在選項裡。")
    if trap == ans:
        raise ValueError("trap 不能和答案同一個。")
    if len(set(normed)) != OPTION_COUNT:
        raise ValueError("選項有重複。")
    # 3. 解答可驗證：用參數實際重算
    if not variant["steps"] or not variant["why"]:
        raise ValueError("要有解題步驟與為什麼。")
    params = variant.get("params")
    if not params:
        raise ValueError("沒有參數可以重算答案。")
    expected = SOLVERS[m](params, d)
    if _norm(expected) != normed[ans]:
        raise ValueError(f"重算的答案 {expected} 和選項裡的答案 {opts[ans]} 不一樣。")
    if _norm(expected) not in _norm(variant["steps"][-1]):
        raise ValueError("最後一步沒有得出答案。")
    return {"ok": True, "checks": list(CHECKS)}


def threshold(size: int) -> int:
    """隊伍人數 × 6 ＋ 4：四人隊 28、六人隊 40。"""
    return int(size) * THRESHOLD_PER_MEMBER + THRESHOLD_BASE


def bank(monster_id: str, n: int, route: str = "plain", seed: Union[int, str] = 0) -> List[Dict[str, Any]]:
    """n 題互不重複（variant_key 去重）且全部通過 check 的變體；湊不到就丟 ValueError。
    第 i 題只和 (monster_id, route, seed, i) 有關，和 n 無關，所以 answer_token 可以只記索引。"""
    if n < 1:
        raise ValueError("至少要一題。")
    out: List[Dict[str, Any]] = []
    seen = set()
    for k in range(n * MAX_TRIES_PER_ITEM):
        v = generate(monster_id, f"{seed}/{k}", route)
        if v["variant_key"] in seen:
            continue
        check(v)
        seen.add(v["variant_key"])
        out.append(v)
        if len(out) == n:
            return out
    raise ValueError(f"{monster_id} 在 {route} 只湊得出 {len(out)} 題不重複的變體，不到 {n} 題。")


def ready(monster_id: str, size: int, route: str = "plain", seed: Union[int, str] = 0) -> bool:
    try:
        bank(monster_id, threshold(size), route, seed)
        return True
    except ValueError:
        return False


def bank_status(monster_id: str, size: int, seed: Union[int, str] = 0) -> Dict[str, Any]:
    """每條路線湊得到幾題（最多數到門檻）、是否達標。"""
    need = threshold(size)
    routes: Dict[str, Any] = {}
    for r in ROUTES:
        try:
            count = len(bank(monster_id, need, r, seed))
        except ValueError as e:
            count = int(str(e).split("只湊得出 ")[1].split(" 題")[0]) if "只湊得出 " in str(e) else 0
        routes[r] = {"count": count, "threshold": need, "ready": count >= need}
    return {"monster_id": monster_id, "size": size, "threshold": need, "routes": routes, "ready": all(x["ready"] for x in routes.values())}


# ——— answer_token：簽章的 (怪, 路線, 種子, 索引)，不含答案；判題時重新產生那一題 ———
def sign_token(secret: str, monster_id: str, route: str, seed: Union[int, str], index: int) -> str:
    payload = json.dumps({"m": monster_id, "r": route, "s": str(seed), "i": int(index)}, separators=(",", ":"), ensure_ascii=False)
    body = base64.urlsafe_b64encode(payload.encode("utf-8")).decode("ascii").rstrip("=")
    sig = hmac.new(secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).hexdigest()[:32]
    return f"{body}.{sig}"


def parse_token(secret: str, token: str) -> Dict[str, Any]:
    """驗簽並回 {monster_id, route, seed, index}；壞掉或竄改就丟 ValueError。"""
    try:
        body, sig = token.split(".", 1)
    except ValueError:
        raise ValueError("answer_token 格式不對。") from None
    expect = hmac.new(secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).hexdigest()[:32]
    if not hmac.compare_digest(sig, expect):
        raise ValueError("answer_token 簽章不符。")
    try:
        data = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)).decode("utf-8"))
        monster_id, route, seed, index = data["m"], data["r"], data["s"], int(data["i"])
    except (ValueError, KeyError, TypeError):
        raise ValueError("answer_token 內容不對。") from None
    if monster_id not in GENERATORS or route not in ROUTES or not 0 <= index <= TOKEN_MAX_INDEX:
        raise ValueError("answer_token 內容不對。")
    return {"monster_id": monster_id, "route": route, "seed": seed, "index": index}


def judge(variant: Dict[str, Any], choice: int) -> Dict[str, Any]:
    """對錯、有沒有踩到 trap，附上為什麼與步驟（作答後才給）。"""
    if not 0 <= int(choice) < OPTION_COUNT:
        raise ValueError(f"選項只有 0–{OPTION_COUNT - 1}。")
    choice = int(choice)
    return {
        "correct": choice == variant["answer"],
        "hit_trap": choice == variant["trap"],
        "trap_kind": variant["trap_kind"],
        "trap_label": variant["trap_label"],
        "answer": variant["answer"],
        "why": variant["why"],
        "steps": variant["steps"],
    }
