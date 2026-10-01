"""人工介入紀錄（0.3）：記一次介入、小隊週摘要、分層摘要；小隊的人力介入分層。

路由只做「取資料、呼叫 services/interventions.py、轉成回應」。note 不放個資，回應也不帶學生暱稱。
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as DBSession

from .. import models, schemas
from ..services import interventions as I
from ..services import teams as T
from .deps import get_db

router = APIRouter(tags=["人工介入"])
WEEK_RE = r"^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$"


def _team(db: DBSession, team_id: int) -> models.Team:
    t = db.get(models.Team, team_id)
    if not t:
        raise HTTPException(status_code=404, detail="找不到這一隊。")
    return t


def _rows_for_teams(db: DBSession, teams: List[models.Team]) -> List[models.Intervention]:
    """這些小隊的介入：掛在小隊上的，加上掛在隊員身上的。"""
    team_ids = [t.id for t in teams]
    student_ids = [m.student_id for t in teams for m in t.members]
    if not team_ids:
        return []
    cond = models.Intervention.team_id.in_(team_ids)
    if student_ids:
        cond = cond | models.Intervention.student_id.in_(student_ids)
    return db.query(models.Intervention).filter(cond).order_by(models.Intervention.id).all()


def _out(row: models.Intervention, next_level: str) -> schemas.InterventionOut:
    return schemas.InterventionOut(
        id=row.id,
        student_id=row.student_id,
        team_id=row.team_id,
        by=row.by,
        kind=row.kind,
        trigger=row.trigger,
        minutes=row.minutes,
        note=row.note,
        created_at=row.created_at,
        week=I.week_key(row.created_at),
        next_level=next_level,
    )


def _history(db: DBSession, row: models.Intervention) -> List[models.Intervention]:
    """同一回合：同一位學生（沒有學生就同一隊）、同一週的紀錄。"""
    q = db.query(models.Intervention).filter_by(trigger=row.trigger)
    q = q.filter_by(student_id=row.student_id) if row.student_id is not None else q.filter_by(team_id=row.team_id, student_id=None)
    return [x for x in q.all() if I.week_key(x.created_at) == I.week_key(row.created_at)]


@router.post("/interventions", response_model=schemas.InterventionOut, status_code=201)
def create_intervention(body: schemas.InterventionIn, db: DBSession = Depends(get_db)):
    if body.student_id is not None and not db.get(models.Student, body.student_id):
        raise HTTPException(status_code=404, detail="找不到這位學生。")
    if body.team_id is not None:
        _team(db, body.team_id)
    row = models.Intervention(
        student_id=body.student_id,
        team_id=body.team_id,
        by=body.by,
        kind=body.kind,
        trigger=body.trigger,
        minutes=body.minutes,
        note=body.note.strip(),
    )
    if body.at is not None:
        row.created_at = body.at.replace(tzinfo=None)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _out(row, I.escalate(row.trigger, _history(db, row)))


@router.get("/teams/{team_id}/interventions/summary", response_model=schemas.InterventionSummaryOut)
def team_summary(
    team_id: int,
    week: Optional[str] = Query(default=None, pattern=WEEK_RE, description="ISO 週，如 2026-W40；不給就全部"),
    db: DBSession = Depends(get_db),
):
    team = _team(db, team_id)
    s = I.summary(_rows_for_teams(db, [team]), week)
    return schemas.InterventionSummaryOut(scope="team", team_id=team.id, layer=team.layer, teams=[team.id], **s)


@router.get("/interventions/summary", response_model=schemas.InterventionSummaryOut)
def layer_summary(
    layer: str = Query(..., pattern=r"^L[0-3]$", description="小隊的人力介入分層 L0／L1／L2／L3"),
    week: Optional[str] = Query(default=None, pattern=WEEK_RE),
    db: DBSession = Depends(get_db),
):
    teams = db.query(models.Team).filter_by(layer=layer).order_by(models.Team.id).all()
    s = I.summary(_rows_for_teams(db, teams), week)
    return schemas.InterventionSummaryOut(scope="layer", layer=layer, teams=[t.id for t in teams], **s)


@router.put("/teams/{team_id}/layer", response_model=schemas.TeamOut)
def set_layer(team_id: int, body: schemas.TeamLayerIn, db: DBSession = Depends(get_db)):
    team = _team(db, team_id)
    team.layer = body.layer
    db.commit()
    db.refresh(team)
    return T.team_out(team)
