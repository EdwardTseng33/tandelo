"""小陪的守門：純函式，不碰模型、不碰資料庫。

三道門，任何一道沒過就不把模型的話送給孩子（退回規則引擎同層級的句子）：
- leaks_answer：回覆裡出現最終答案的任何寫法（數值、化簡式去空白、分數／小數），或「答案是／等於／=」接著答案（項的順序不同也算）。
- too_long：每句超過 40 字，或句子太多。
- has_unsafe：兒少不宜或貶低語氣的簡單黑名單。

normalize 與前端 coach.normalize 一致（全形轉半形、統一負號與乘號、去空白、小寫）。
"""

import re
from fractions import Fraction
from typing import Iterable, List, Optional, Set, Tuple

FULLWIDTH = re.compile(r"[！-～]")


def normalize(s: str) -> str:
    """去空白、統一負號與括號、全形轉半形（與前端 coach.normalize 一致）。"""
    s = FULLWIDTH.sub(lambda m: chr(ord(m.group(0)) - 0xFEE0), str(s or ""))
    s = re.sub(r"[−–—﹣]", "-", s)
    s = re.sub(r"[×＊*]", "·", s)
    s = s.replace("^2", "²")
    s = re.sub(r"[，,、]", "和", s)
    s = re.sub(r"\s+", "", s)
    return s.lower()


# ——— 答案洩漏 ———
MAX_SENTENCE_CHARS = 40
MAX_SENTENCES = 5
ANSWER_PHRASE = "答案是"
# 「答案是／就是／等於／=」後面接的那一段，拿來和答案比對（項的順序可以不同）
ANSWER_TRIGGER = re.compile(r"(?:答案是|答案就是|結果是|就是|等於|=)\s*([^。！？!?，,；;\n]+)")
# 前後接到這些字元才算同一個數字或式子的一部分：6 不等於 6x、13 不等於 130；中文字算邊界
TOKEN_CHARS = r"0-9a-z²√/."
_SENTENCE_SPLIT = re.compile(r"[。！？!?；;\n]+")
_NUMBER = re.compile(r"^-?\d+(?:\.\d+)?$")
_FRACTION = re.compile(r"^(-?\d+)/(\d+)$")


def _number_forms(n: str) -> Set[str]:
    """同一個數的幾種寫法：整數、小數、分數（0.5 ↔ 1/2 ↔ 2/4 不展開，只收最簡分數）。"""
    out: Set[str] = {n}
    try:
        if _NUMBER.match(n):
            f = Fraction(n)
        else:
            m = _FRACTION.match(n)
            if not m:
                return out
            f = Fraction(int(m.group(1)), int(m.group(2)))
    except (ValueError, ZeroDivisionError):
        return out
    if f.denominator == 1:
        out.add(str(f.numerator))
        out.add(f"{f.numerator}.0")
    else:
        out.add(f"{f.numerator}/{f.denominator}")
        dec = float(f)
        if abs(dec * 1000 - round(dec * 1000)) < 1e-9:  # 有限小數才加
            out.add(repr(dec).rstrip("0").rstrip("."))
    return out


def answer_variants(answer_forms: Iterable[str]) -> Set[str]:
    """把呼叫端給的答案寫法展開成所有要擋的正規化字串。"""
    out: Set[str] = set()
    for a in answer_forms or ():
        n = normalize(a)
        if not n:
            continue
        out.add(n)
        out |= _number_forms(n)
        # x = 4 這種：也擋「=4」右邊的值本身
        if "=" in n and "或" not in n:
            rhs = n.split("=")[-1]
            if rhs:
                out.add(rhs)
    return {v for v in out if v}


def _terms(expr: str) -> Tuple[str, ...]:
    """把 2x+7 拆成帶號的項並排序，讓 7+2x 與 2x+7 相等。"""
    e = normalize(expr)
    if not e:
        return ()
    parts = re.findall(r"[+-]?[^+-]+", e)
    terms = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        terms.append(p if p[0] in "+-" else "+" + p)
    return tuple(sorted(terms))


def _contains_token(text_n: str, needle: str) -> bool:
    """needle 出現在 text_n 裡，而且前後不是數字／字母／中文（避免 6 命中 6x、13 命中 130）。"""
    pat = r"(?<![" + TOKEN_CHARS + r"])" + re.escape(needle) + r"(?![" + TOKEN_CHARS + r"])"
    return re.search(pat, text_n) is not None


def leaks_answer(text: str, answer_forms: List[str]) -> bool:
    """回覆裡有沒有把最終答案說出來。"""
    variants = answer_variants(answer_forms)
    if not variants or not text:
        return False
    text_n = normalize(text)
    # 一、答案本身（任何寫法）直接出現
    for v in variants:
        if _contains_token(text_n, v):
            return True
    # 二、「答案是／等於／=」後面接的那一段，項的順序不同也算
    answer_terms = {_terms(v) for v in variants}
    answer_terms.discard(())
    for m in ANSWER_TRIGGER.finditer(text_n):
        tail = m.group(1)
        if _terms(tail) in answer_terms:
            return True
    return False


def says_answer_phrase(text: str) -> bool:
    """提示詞規定不出現「答案是」；這一條不看答案內容。"""
    return ANSWER_PHRASE in normalize(text)


# ——— 太長 ———
def sentences(text: str) -> List[str]:
    return [s.strip() for s in _SENTENCE_SPLIT.split(text or "") if s.strip()]


def too_long(text: str, max_chars: int = MAX_SENTENCE_CHARS, max_sentences: int = MAX_SENTENCES) -> bool:
    """每句 ≤ 40 字（不算空白），句數 ≤ 5。"""
    ss = sentences(text)
    if len(ss) > max_sentences:
        return True
    return any(len(re.sub(r"\s+", "", s)) > max_chars for s in ss)


# ——— 兒少不宜／貶低 ———
UNSAFE_WORDS = (
    "笨",
    "白痴",
    "白癡",
    "智障",
    "廢物",
    "蠢",
    "豬腦",
    "沒救",
    "垃圾",
    "去死",
    "滾開",
    "幹你",
    "靠北",
    "他媽",
    "媽的",
    "自殺",
    "色情",
    "裸照",
    "做愛",
    "毒品",
    "賭博",
)


def has_unsafe(text: str) -> bool:
    t = str(text or "")
    return any(w in t for w in UNSAFE_WORDS)


# ——— 一次過三道門 ———
def check(text: str, answer_forms: List[str]) -> Optional[str]:
    """回傳沒過的原因（leak／answer_phrase／too_long／unsafe／empty），全過回 None。"""
    if not str(text or "").strip():
        return "empty"
    if leaks_answer(text, answer_forms):
        return "leak"
    if says_answer_phrase(text):
        return "answer_phrase"
    if too_long(text):
        return "too_long"
    if has_unsafe(text):
        return "unsafe"
    return None
