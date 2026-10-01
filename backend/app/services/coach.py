"""小陪（示範模式）：純規則引擎。原則：說話用「我」、句子短、先觀察再建議、永遠不直接給答案、關燈時不出聲。

COACH_PROVIDER 目前只有 rules。要接 LLM 時實作 CoachProvider 介面並在 get_provider() 註冊；這裡不放任何金鑰。
"""

import re
from typing import Any, Dict, List, Optional, Protocol

from . import content as C

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


class CoachProvider(Protocol):
    name: str

    def reply(self, skill_id: str, action: str, message: str, step: int, hint_level: int, start_tier: int) -> Dict[str, Any]: ...


def tier_for_step(start_tier: int, step: int) -> int:
    return min(2, start_tier + step)


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

    def reply(self, skill_id: str, action: str, message: str, step: int, hint_level: int, start_tier: int) -> Dict[str, Any]:
        sk = C.skill(skill_id)
        steps = sk["coach"]["steps"]
        if action == "start":
            msgs = [{"who": "coach", "kind": "text", "text": f"我看到這一題了：{sk['coach']['prompt']}。我不會直接給答案，我們一步一步來。"}]
            msgs += self._intro(sk, 0, tier_for_step(start_tier, 0))
            return {"messages": msgs, "step": 0, "hint_level": 0, "done": False, "ok": None}
        if step >= len(steps):
            return {
                "messages": [{"who": "coach", "kind": "done", "text": "這題已經解完了。"}],
                "step": step,
                "hint_level": hint_level,
                "done": True,
                "ok": None,
            }
        st = steps[step]
        if action == "hint":
            if hint_level < len(st["hints"]):
                text = st["hints"][hint_level]
            else:
                text = f"我用別的題目示範這一步：{st['demo']}。換你做原本那題。"
            return {
                "messages": [{"who": "coach", "kind": "hint", "text": text}],
                "step": step,
                "hint_level": min(hint_level + 1, len(st["hints"])),
                "done": False,
                "ok": None,
            }
        # answer
        n = normalize(message)
        if not n:
            return {
                "messages": [{"who": "coach", "kind": "text", "text": "我還沒看到你的想法。寫一點就好。"}],
                "step": step,
                "hint_level": hint_level,
                "done": False,
                "ok": False,
            }
        if any(normalize(a) == n for a in st["accept"]):
            nxt = step + 1
            if nxt >= len(steps):
                return {
                    "messages": [{"who": "coach", "kind": "done", "text": f"你自己解完了：{sk['coach']['final']}。我沒有給你答案，只問了你問題。"}],
                    "step": nxt,
                    "hint_level": 0,
                    "done": True,
                    "ok": True,
                }
            msgs = [{"who": "coach", "kind": "text", "text": ["對。", "嗯，這步對了。", "沒錯。"][nxt % 3]}]
            msgs += self._intro(sk, nxt, tier_for_step(start_tier, nxt))
            return {"messages": msgs, "step": nxt, "hint_level": 0, "done": False, "ok": True}
        wrong = next((w for w in st.get("wrong", []) if normalize(w["match"]) == n), None)
        say = wrong["say"] if wrong else "我先不說對錯。你是怎麼想的？再看一次題目這一步在問什麼。"
        return {"messages": [{"who": "coach", "kind": "text", "text": say}], "step": step, "hint_level": hint_level, "done": False, "ok": False}


LIGHTS_OUT_MESSAGE = "關燈中。22:30 到早上 6 點我不出聲，明天再一起看這一題。"


def get_provider(name: str) -> CoachProvider:
    if name == "rules":
        return RulesCoach()
    # 預留：name == "llm" 時在這裡回傳接 LLM 的實作（讀環境變數的金鑰，不寫進程式）。
    raise ValueError(f"不支援的 COACH_PROVIDER：{name}（目前只有 rules）")


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
