"""小陪：規則引擎（COACH_PROVIDER=rules）與接大模型的 LLMProvider（COACH_PROVIDER=anthropic）。

原則：說話用「我」、句子短、先觀察再建議、永遠不直接給答案、關燈時不出聲（關燈在路由層擋，這裡不會被叫到）。
四層引導：0 問、1 指、2 借、3 示範一步；第四層之後只回固定句 HANDOFF_TEXT，不再呼叫模型。
模型的每一句都先過 services/guard.py 三道門，沒過就退回規則引擎同一層級的句子，並記一筆 leak。

金鑰只從環境變數讀（Settings.anthropic_api_key），程式與測試裡不放任何金鑰；SDK 是可選相依（pyproject 的 llm extra），用 try-import。
"""

import json
import logging
import re
import threading
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Protocol

from . import content as C
from . import guard
from .guard import normalize  # noqa: F401  — 舊程式碼從這裡 import normalize

log = logging.getLogger("tandelo.coach")

LEVEL_NAMES = ("問", "指", "借", "示範一步")
MAX_LEVEL = len(LEVEL_NAMES) - 1  # 3
HANDOFF_TEXT = "這一步交給你，寫到哪裡再叫我"
LIGHTS_OUT_MESSAGE = "關燈中。22:30 到早上 6 點我不出聲，明天再一起看這一題。"
DEFAULT_MODEL = "claude-sonnet-5-5"
MAX_OUTPUT_TOKENS = 300  # 回覆最多幾句短句，刻意小


@dataclass
class CoachTurn:
    """一次請求小陪要知道的事。answer_forms 空的話從題庫的最終答案補。"""

    skill_id: str
    action: str = "start"
    message: str = ""
    step: int = 0
    hint_level: int = 0
    start_tier: int = 1
    monster_id: str = ""
    step_text: str = ""
    level: Optional[int] = None
    answer_forms: List[str] = field(default_factory=list)

    def effective_level(self) -> int:
        """沒給 level 就用 hint_level 當層級（舊前端相容）。"""
        return int(self.level if self.level is not None else self.hint_level)


class CoachProvider(Protocol):
    name: str

    def reply(self, turn: CoachTurn) -> Dict[str, Any]: ...


def tier_for_step(start_tier: int, step: int) -> int:
    return min(2, start_tier + step)


def guard_forms(turn: CoachTurn) -> List[str]:
    """要擋的答案寫法：呼叫端給的，或題庫的最終答案；第三層以前連這一步的答案也不能說。"""
    forms = [a for a in (turn.answer_forms or []) if str(a).strip()]
    sk = C.skill(turn.skill_id)
    if not forms:
        forms.append(sk["coach"]["final"])
    steps = sk["coach"]["steps"]
    if turn.effective_level() < MAX_LEVEL and 0 <= turn.step < len(steps):
        forms += list(steps[turn.step].get("accept", []))
    return forms


class RulesCoach:
    """規則引擎：一步一步問；答對往下一步、答錯先不說對錯；提示是輕推→問一句→用別的題目示範。"""

    name = "rules"

    def _intro(self, sk: Dict[str, Any], step: int, tier: int) -> List[Dict[str, str]]:
        st = sk["coach"]["steps"][step]
        out: List[Dict[str, str]] = []
        if tier == 0:
            out.append({"who": "coach", "kind": "demo", "text": f"先看我用別的題目示範這一步：{st['demo']}"})
        out.append({"who": "coach", "kind": "ask", "text": st["ask"]})
        return out

    def line_for_level(self, skill_id: str, step: int, level: int) -> str:
        """四層各一句：0 問這一步、1／2 提示、3 用別的題目示範一步；之後固定句。"""
        if level > MAX_LEVEL:
            return HANDOFF_TEXT
        sk = C.skill(skill_id)
        steps = sk["coach"]["steps"]
        if step >= len(steps):
            return "這題已經解完了。"
        st = steps[step]
        if level == 0:
            return st["ask"]
        hints = st.get("hints", [])
        if level - 1 < len(hints) and level < MAX_LEVEL:
            return hints[level - 1]
        return f"我用別的題目示範這一步：{st['demo']}。換你做原本那題。"

    def reply(self, turn: CoachTurn) -> Dict[str, Any]:
        sk = C.skill(turn.skill_id)
        steps = sk["coach"]["steps"]
        step, hint_level, action = turn.step, turn.hint_level, turn.action
        if action == "start":
            msgs = [{"who": "coach", "kind": "text", "text": f"我看到這一題了：{sk['coach']['prompt']}。我不會直接給答案，我們一步一步來。"}]
            msgs += self._intro(sk, 0, tier_for_step(turn.start_tier, 0))
            return {"messages": msgs, "step": 0, "hint_level": 0, "done": False, "ok": None, "level": 0, "handoff": False}
        if step >= len(steps):
            return {
                "messages": [{"who": "coach", "kind": "done", "text": "這題已經解完了。"}],
                "step": step,
                "hint_level": hint_level,
                "done": True,
                "ok": None,
                "level": turn.effective_level(),
                "handoff": False,
            }
        st = steps[step]
        if action == "hint":
            level = turn.effective_level()
            if level > MAX_LEVEL:
                text, handoff = HANDOFF_TEXT, True
            elif hint_level < len(st["hints"]):
                text, handoff = st["hints"][hint_level], False
            else:
                text, handoff = f"我用別的題目示範這一步：{st['demo']}。換你做原本那題。", True
            return {
                "messages": [{"who": "coach", "kind": "hint", "text": text}],
                "step": step,
                "hint_level": min(hint_level + 1, len(st["hints"])),
                "done": False,
                "ok": None,
                "level": min(level, MAX_LEVEL + 1),
                "handoff": handoff,
            }
        # answer
        n = normalize(turn.message)
        base = {"step": step, "hint_level": hint_level, "done": False, "level": turn.effective_level(), "handoff": False}
        if not n:
            return {**base, "messages": [{"who": "coach", "kind": "text", "text": "我還沒看到你的想法。寫一點就好。"}], "ok": False}
        if any(normalize(a) == n for a in st["accept"]):
            nxt = step + 1
            if nxt >= len(steps):
                return {
                    "messages": [{"who": "coach", "kind": "done", "text": f"你自己解完了：{sk['coach']['final']}。我沒有給你答案，只問了你問題。"}],
                    "step": nxt,
                    "hint_level": 0,
                    "done": True,
                    "ok": True,
                    "level": 0,
                    "handoff": False,
                }
            msgs = [{"who": "coach", "kind": "text", "text": ["對。", "嗯，這步對了。", "沒錯。"][nxt % 3]}]
            msgs += self._intro(sk, nxt, tier_for_step(turn.start_tier, nxt))
            return {"messages": msgs, "step": nxt, "hint_level": 0, "done": False, "ok": True, "level": 0, "handoff": False}
        wrong = next((w for w in st.get("wrong", []) if normalize(w["match"]) == n), None)
        say = wrong["say"] if wrong else "我先不說對錯。你是怎麼想的？再看一次題目這一步在問什麼。"
        return {**base, "messages": [{"who": "coach", "kind": "text", "text": say}], "ok": False}


# ——— 計數：洩漏率＝leak／總回覆（記憶體，重啟歸零；多副本要換集中式計數）———
class CoachMetrics:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.total = 0  # 小陪實際回覆的次數（關燈不算）
        self.llm_calls = 0  # 真的呼叫模型的次數
        self.leak = 0  # 模型回覆沒過守門、退回規則引擎的次數
        self.by_reason: Dict[str, int] = {}

    def count_reply(self) -> None:
        with self._lock:
            self.total += 1

    def count_call(self) -> None:
        with self._lock:
            self.llm_calls += 1

    def count_leak(self, reason: str) -> None:
        with self._lock:
            self.leak += 1
            self.by_reason[reason] = self.by_reason.get(reason, 0) + 1
        log.warning("coach guard: 模型回覆沒過守門（%s），已退回規則引擎", reason)

    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            rate = (self.leak / self.total) if self.total else 0.0
            return {"total": self.total, "llm_calls": self.llm_calls, "leak": self.leak, "leak_rate": round(rate, 4), "by_reason": dict(self.by_reason)}


# ——— 接模型 ———
SYSTEM_RULES = """你是「小陪」，台灣國中生的解題陪跑。你只用繁體中文、台灣用語，說話用「我」。
你的工作是陪孩子自己把這一題寫完，不是替他寫。鐵則：
1. 絕對不給整題答案、不給最終數值或最終化簡式，也不寫出下一步的結果。
2. 不出現「答案是」這三個字。不說「等於多少」後面接數字或式子。
3. 每句不超過 40 字，最多三句。先看孩子寫到哪裡，只對他寫到的那一步說話。
4. 只能做目前這一層該做的事，不能跳到更高層：
   第 0 層「問」：只問一句，像「你寫到哪一步？」。
   第 1 層「指」：指出錯在哪一行、哪個符號，不說怎麼改。
   第 2 層「借」：換一題更簡單、同一隻怪的變體，讓他自己發現規則；不解那一題。
   第 3 層「示範一步」：只示範卡住的這一步的做法，下一步交給他，並把 handoff 設成 true。
5. 不評價孩子的人，不說笨、不嘲諷；不聊題目以外的事。
6. 算數交給孩子，你不替他心算結果。
只回傳 JSON：{"level": 目前層級的整數, "text": "你要說的話", "handoff": 布林}。"""

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "level": {"type": "integer"},
        "text": {"type": "string"},
        "handoff": {"type": "boolean"},
    },
    "required": ["level", "text", "handoff"],
    "additionalProperties": False,
}


def build_system_prompt(turn: CoachTurn) -> str:
    """規則在前（固定），怪與題目在後：怪的定義檔（world.json）、題目、孩子目前寫到的步驟、目前層級。"""
    sk = C.skill(turn.skill_id)
    monster = C.monsters().get(turn.monster_id or turn.skill_id)
    level = min(max(turn.effective_level(), 0), MAX_LEVEL)
    steps = sk["coach"]["steps"]
    step_ask = steps[turn.step]["ask"] if 0 <= turn.step < len(steps) else "（已經是最後一步）"
    parts = [SYSTEM_RULES, ""]
    if monster:
        parts += [
            f"這一題背後的怪：{monster['name']}（{monster.get('title', '')}）",
            f"- 騙術：{monster['trick']}",
            f"- 口頭禪：{monster['taunt']}",
            f"- 弱點：{monster['weakness']}",
            f"- 被識破時：{monster['caught_line']}",
            "",
        ]
    parts += [
        f"題目：{sk['coach']['prompt']}",
        f"現在在第 {turn.step + 1} 步，這一步在問：{step_ask}",
        f"孩子目前寫到：{turn.step_text.strip() or '（還沒寫）'}",
        f"目前引導層級：第 {level} 層「{LEVEL_NAMES[level]}」。只做這一層的事。",
    ]
    return "\n".join(parts)


def build_user_message(turn: CoachTurn) -> str:
    if turn.action == "hint":
        return "孩子按了「我卡住了」。請依目前層級給一句引導。"
    if turn.action == "start":
        return "孩子剛打開這一題。請用第 0 層問他寫到哪裡。"
    return f"孩子這一步寫的是：{turn.message.strip() or '（空白）'}。請依目前層級回應，不說對錯的結論。"


def _make_client(api_key: str) -> Any:
    """只在這裡碰 SDK；沒裝就丟 RuntimeError，由 get_provider 退回規則引擎。測試用 monkeypatch 換成假 client。"""
    try:
        import anthropic  # type: ignore[import-not-found]
    except ImportError as e:  # pragma: no cover - 看環境
        raise RuntimeError("沒有安裝 anthropic SDK（pip install 'tandelo-backend[llm]'）") from e
    return anthropic.Anthropic(api_key=api_key, timeout=20.0, max_retries=1)


def parse_model_reply(raw: str) -> Optional[Dict[str, Any]]:
    """模型回 JSON；保險起見也接受前後有雜訊的情況。"""
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        m = re.search(r"\{.*\}", str(raw or ""), re.S)
        if not m:
            return None
        try:
            data = json.loads(m.group(0))
        except ValueError:
            return None
    if not isinstance(data, dict) or not isinstance(data.get("text"), str):
        return None
    return data


class LLMProvider:
    """接 Anthropic 模型；每一句都過守門，沒過就退回規則引擎同層級的句子。"""

    name = "anthropic"

    def __init__(self, client: Any, model: str, metrics: CoachMetrics, rules: Optional[RulesCoach] = None) -> None:
        self.client = client
        self.model = model or DEFAULT_MODEL
        self.metrics = metrics
        self.rules = rules or RulesCoach()

    @staticmethod
    def _next_hint_level(turn: CoachTurn) -> int:
        return min(turn.hint_level + 1, MAX_LEVEL + 1) if turn.action == "hint" else turn.hint_level

    def _fallback(self, turn: CoachTurn, level: int, reason: str) -> Dict[str, Any]:
        self.metrics.count_leak(reason)
        text = self.rules.line_for_level(turn.skill_id, turn.step, level)
        return {
            "messages": [{"who": "coach", "kind": "hint", "text": text}],
            "step": turn.step,
            "hint_level": self._next_hint_level(turn),
            "done": False,
            "ok": None,
            "level": level,
            "handoff": level >= MAX_LEVEL,
            "guarded": reason,
        }

    def _call(self, turn: CoachTurn) -> str:
        self.metrics.count_call()
        resp = self.client.messages.create(
            model=self.model,
            max_tokens=MAX_OUTPUT_TOKENS,
            system=build_system_prompt(turn),
            messages=[{"role": "user", "content": build_user_message(turn)}],
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": OUTPUT_SCHEMA}},
        )
        if getattr(resp, "stop_reason", None) == "refusal":
            raise LookupError("refusal")
        return next(b.text for b in resp.content if getattr(b, "type", "") == "text")

    def reply(self, turn: CoachTurn) -> Dict[str, Any]:
        level = turn.effective_level()
        # 第四層之後：固定句，不呼叫模型
        if level > MAX_LEVEL:
            return {
                "messages": [{"who": "coach", "kind": "hint", "text": HANDOFF_TEXT}],
                "step": turn.step,
                "hint_level": self._next_hint_level(turn),
                "done": False,
                "ok": None,
                "level": level,
                "handoff": True,
            }
        # 對錯判斷、換步驟仍交給規則引擎（計算與答案比對不讓語言模型做）
        if turn.action == "answer":
            judged = self.rules.reply(turn)
            if judged.get("ok") is True or judged.get("done"):
                return judged
        try:
            raw = self._call(turn)
        except LookupError:
            return self._fallback(turn, level, "refusal")
        except Exception as e:  # SDK 的各種錯誤（逾時、限流、網路）一律退回規則引擎，不讓孩子等
            log.warning("coach llm: 呼叫模型失敗（%s），退回規則引擎", type(e).__name__)
            return self._fallback(turn, level, "error")
        data = parse_model_reply(raw)
        if data is None:
            return self._fallback(turn, level, "bad_json")
        text = data["text"].strip()
        reason = guard.check(text, guard_forms(turn))
        if reason:
            return self._fallback(turn, level, reason)
        handoff = bool(data.get("handoff")) or level >= MAX_LEVEL
        kind = "ask" if level == 0 else "hint"
        return {
            "messages": [{"who": "coach", "kind": kind, "text": text}],
            "step": turn.step,
            "hint_level": self._next_hint_level(turn),
            "done": False,
            "ok": None if turn.action != "answer" else False,
            "level": level,
            "handoff": handoff,
        }


def get_provider(
    name: str,
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    metrics: Optional[CoachMetrics] = None,
    make_client: Optional[Callable[[str], Any]] = None,
) -> CoachProvider:
    """依 COACH_PROVIDER 選提供者。anthropic 但沒有金鑰或沒裝 SDK → 記一行 log、退回規則引擎。"""
    if name == "rules":
        return RulesCoach()
    if name == "anthropic":
        if not api_key:
            log.warning("COACH_PROVIDER=anthropic 但沒有設定 ANTHROPIC_API_KEY，小陪改用規則引擎")
            return RulesCoach()
        try:
            client = (make_client or _make_client)(api_key)
        except RuntimeError as e:
            log.warning("COACH_PROVIDER=anthropic 但 %s，小陪改用規則引擎", e)
            return RulesCoach()
        log.info("小陪接上模型：%s", model or DEFAULT_MODEL)
        return LLMProvider(client, model or DEFAULT_MODEL, metrics or CoachMetrics())
    raise ValueError(f"不支援的 COACH_PROVIDER：{name}（可用：rules、anthropic）")


def evaluate_explanation(skill_id: str, text: str) -> Dict[str, Any]:
    """說給我聽：規則比對關鍵概念（與前端 evaluateExplanation 一致）。"""
    ex = C.skill(skill_id)["explain"]
    n = normalize(text)
    hits: List[str] = []
    missing: List[str] = []
    for c in ex["concepts"]:
        (hits if re.search(c["pattern"], n) else missing).append(c["label"])
    too_short = len(n) < 12
    passed = (not too_short) and len(hits) >= ex["need"]
    feedback: Optional[str]
    if too_short:
        feedback = "我聽到的有點短。試著多講一句「為什麼」，30 秒內就好。"
    elif passed and not missing:
        feedback = f"我聽到了「{'」「'.join(hits)}」。講得很完整。"
    elif passed:
        feedback = f"我聽到了「{'」「'.join(hits)}」。夠清楚了。如果再補一句「{missing[0]}」會更完整。"
    elif hits:
        feedback = f"我聽到了「{hits[0]}」。還差一點：你能再說說「{missing[0]}」嗎？"
    else:
        feedback = f"我還沒聽到重點。提示你一個方向：想想「{ex['concepts'][0]['label']}」。"
    return {"pass": passed, "hits": hits, "missing": missing, "feedback": feedback, "score": len(hits), "need": ex["need"]}
