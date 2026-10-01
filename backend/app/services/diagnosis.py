"""判卡點：從前端 content.js 的 diagnose() 移植。答錯選到帶標籤的選項算 2 分、沒標籤算 1 分、「不確定」算 1 分；
2 分以上取前兩個，沒有就取 1 分以上的第一個；全對就從學校正在教的十字交乘開始。"""

from typing import Any, Dict

from .content import diag_questions, skill_order

UNSURE = -1
ALL_CLEAR_START = "factor-cross"


def diagnose(answers: Dict[str, int]) -> Dict[str, Any]:
    scores: Dict[str, int] = {}
    status: Dict[str, str] = {}
    correct = 0
    questions = diag_questions()
    for q in questions:
        if q["id"] not in answers:
            continue
        a = answers[q["id"]]
        if a == UNSURE:
            scores[q["skill"]] = scores.get(q["skill"], 0) + 1
            continue
        if a < 0 or a >= len(q["opts"]):
            continue
        opt = q["opts"][a]
        if opt.get("ok"):
            correct += 1
            status.setdefault(q["skill"], "ok")
            continue
        target = opt.get("tag") or q["skill"]
        scores[target] = scores.get(target, 0) + (2 if opt.get("tag") else 1)

    order = skill_order()

    def rank(k: str):
        return (-scores[k], order.index(k) if k in order else 99)

    stuck = sorted([k for k, v in scores.items() if v >= 2], key=rank)[:2]
    if not stuck:
        stuck = sorted([k for k, v in scores.items() if v >= 1], key=rank)[:1]
    all_clear = not stuck
    if all_clear:
        stuck = [ALL_CLEAR_START]
    for s in stuck:
        status[s] = "stuck"
    for k in scores:
        status.setdefault(k, "unknown")
    return {"stuck": stuck, "scores": scores, "correct": correct, "total": len(questions), "all_clear": all_clear, "status": status}
