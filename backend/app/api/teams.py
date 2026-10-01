"""小隊：湊隊、加入、老師接班；課堂紀錄。"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from .. import models, schemas
from ..services import teams as T
from .deps import get_db

router = APIRouter(tags=["小隊"])


def _team(db: DBSession, team_id: int) -> models.Team:
    t = db.get(models.Team, team_id)
    if not t:
        raise HTTPException(status_code=404, detail="找不到這一隊。")
    return t


def _student(db: DBSession, student_id: int) -> models.Student:
    s = db.get(models.Student, student_id)
    if not s:
        raise HTTPException(status_code=404, detail="找不到這位學生。")
    return s


def _run(fn, *args):
    try:
        return fn(*args)
    except T.TeamError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from None


@router.post("/teams/match", response_model=schemas.TeamOut, status_code=201)
def match(body: schemas.TeamMatchIn, db: DBSession = Depends(get_db)):
    s = _student(db, body.student_id)
    team = _run(T.match, db, s, body.plan_id)
    return T.team_out(team)


@router.get("/teams", response_model=List[schemas.TeamOut])
def list_teams(status: str = None, db: DBSession = Depends(get_db)):  # type: ignore[assignment]
    q = db.query(models.Team)
    if status:
        q = q.filter_by(status=status)
    return [T.team_out(t) for t in q.order_by(models.Team.id).all()]


@router.get("/teams/{team_id}", response_model=schemas.TeamOut)
def get_team(team_id: int, db: DBSession = Depends(get_db)):
    return T.team_out(_team(db, team_id))


@router.post("/teams/{team_id}/join", response_model=schemas.TeamOut)
def join(team_id: int, body: schemas.TeamJoinIn, db: DBSession = Depends(get_db)):
    team = _team(db, team_id)
    s = _student(db, body.student_id)
    return T.team_out(_run(T.join, db, team, s, body.plan_id))


@router.post("/teams/{team_id}/accept", response_model=schemas.TeamOut)
def accept(team_id: int, body: schemas.TeamAcceptIn, db: DBSession = Depends(get_db)):
    team = _team(db, team_id)
    teacher = db.get(models.Teacher, body.teacher_id)
    if not teacher:
        raise HTTPException(status_code=404, detail="找不到這位老師。")
    return T.team_out(_run(T.accept, db, team, teacher))


@router.get("/teams/{team_id}/sessions", response_model=List[schemas.SessionOut])
def sessions(team_id: int, db: DBSession = Depends(get_db)):
    return _team(db, team_id).sessions


@router.post("/sessions/{session_id}/notes", response_model=schemas.SessionNoteOut, status_code=201)
def add_note(session_id: int, body: schemas.SessionNoteIn, db: DBSession = Depends(get_db)):
    sess = db.get(models.Session, session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="找不到這一堂課。")
    note = models.SessionNote(session_id=sess.id, teacher_id=body.teacher_id, text=body.text.strip())
    sess.status = "done"
    db.add(note)
    db.commit()
    db.refresh(note)
    return note
