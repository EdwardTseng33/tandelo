"""小陪：規則引擎或接模型（啟動時決定，見 main.create_app），關燈時段回「關燈中」、不呼叫模型。"""

from fastapi import APIRouter, Depends, HTTPException, Request

from .. import schemas
from ..core.config import Settings
from ..services import coach as coach_svc
from ..services import rules
from ..services import variants as V
from .deps import get_settings_dep

router = APIRouter(tags=["小陪"])


def get_provider_dep(request: Request) -> coach_svc.CoachProvider:
    return request.app.state.coach_provider


def get_metrics_dep(request: Request) -> coach_svc.CoachMetrics:
    return request.app.state.coach_metrics


@router.post("/coach/reply", response_model=schemas.CoachReplyOut)
def reply(
    body: schemas.CoachReplyIn,
    settings: Settings = Depends(get_settings_dep),
    provider: coach_svc.CoachProvider = Depends(get_provider_dep),
    metrics: coach_svc.CoachMetrics = Depends(get_metrics_dep),
):
    now = rules.parse_hhmm(body.time) if body.time else rules.local_now(settings.timezone).time()
    if rules.is_lights_out(now, settings.lights_out_start, settings.lights_out_end):
        return schemas.CoachReplyOut(
            provider=provider.name,
            lights_out=True,
            messages=[{"who": "coach", "kind": "quiet", "text": coach_svc.LIGHTS_OUT_MESSAGE}],
            step=body.step,
            hint_level=body.hint_level,
            done=False,
            level=body.level,
        )
    turn = coach_svc.CoachTurn(
        skill_id=body.skill_id,
        action=body.action,
        message=body.message,
        step=body.step,
        hint_level=body.hint_level,
        start_tier=body.start_tier,
        monster_id=body.monster_id,
        step_text=body.step_text,
        level=body.level,
        answer_forms=body.answer_forms,
    )
    if body.variant is not None:
        try:
            v = V.generate(body.variant.monster_id, body.variant.seed, body.variant.route)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e)) from None
        turn.variant = coach_svc.variant_context(v, body.variant.picked)
        if not turn.monster_id:
            turn.monster_id = body.variant.monster_id
    try:
        r = provider.reply(turn)
    except KeyError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None
    metrics.count_reply()
    return schemas.CoachReplyOut(provider=provider.name, lights_out=False, **r)


@router.get("/coach/metrics")
def coach_metrics(provider: coach_svc.CoachProvider = Depends(get_provider_dep), metrics: coach_svc.CoachMetrics = Depends(get_metrics_dep)):
    """洩漏率＝leak／總回覆（記憶體計數，重啟歸零）。"""
    return {"provider": provider.name, **metrics.snapshot()}


@router.post("/coach/explain")
def explain(body: dict):
    """說給我聽：{skill_id, text} → 規則比對關鍵概念。"""
    try:
        return coach_svc.evaluate_explanation(str(body.get("skill_id", "")), str(body.get("text", "")))
    except KeyError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None
