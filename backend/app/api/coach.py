"""小陪：純規則回覆（示範模式），關燈時段回「關燈中」。"""

from fastapi import APIRouter, Depends, HTTPException

from .. import schemas
from ..core.config import Settings
from ..services import coach as coach_svc
from ..services import rules
from .deps import get_settings_dep

router = APIRouter(tags=["小陪"])


@router.post("/coach/reply", response_model=schemas.CoachReplyOut)
def reply(body: schemas.CoachReplyIn, settings: Settings = Depends(get_settings_dep)):
    now = rules.parse_hhmm(body.time) if body.time else rules.local_now(settings.timezone).time()
    if rules.is_lights_out(now, settings.lights_out_start, settings.lights_out_end):
        return schemas.CoachReplyOut(
            provider=settings.coach_provider,
            lights_out=True,
            messages=[{"who": "coach", "kind": "quiet", "text": coach_svc.LIGHTS_OUT_MESSAGE}],
            step=body.step,
            hint_level=body.hint_level,
            done=False,
        )
    try:
        provider = coach_svc.get_provider(settings.coach_provider)
        r = provider.reply(body.skill_id, body.action, body.message, body.step, body.hint_level, body.start_tier)
    except KeyError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e)) from None
    return schemas.CoachReplyOut(provider=provider.name, lights_out=False, **r)


@router.post("/coach/explain")
def explain(body: dict):
    """說給我聽：{skill_id, text} → 規則比對關鍵概念。"""
    try:
        return coach_svc.evaluate_explanation(str(body.get("skill_id", "")), str(body.get("text", "")))
    except KeyError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None
