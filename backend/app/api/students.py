"""學生：建立、查詢、診斷、時段、練習、再測、家長週報。"""

from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from .. import models, schemas
from ..models import json_get, json_set
from ..services import content as C
from ..services import diagnosis, report, rules
from .deps import get_db

router = APIRouter(tags=["學生"])


def _student(db: DBSession, student_id: int) -> models.Student:
    s = db.get(models.Student, student_id)
    if not s:
        raise HTTPException(status_code=404, detail="找不到這位學生。")
    return s


def _out(s: models.Student) -> schemas.StudentOut:
    return schemas.StudentOut(
        id=s.id,
        nickname=s.nickname,
        grade=s.grade,
        exam_date=s.exam_date,
        goal=s.goal,
        daily_cap=s.daily_cap,
        stuck=s.stuck,
        slots=sorted(a.slot_id for a in s.availability),
    )


@router.post("/students", response_model=schemas.StudentOut, status_code=201)
def create_student(body: schemas.StudentCreate, db: DBSession = Depends(get_db)):
    s = models.Student(**body.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return _out(s)


@router.get("/students/{student_id}", response_model=schemas.StudentOut)
def get_student(student_id: int, db: DBSession = Depends(get_db)):
    return _out(_student(db, student_id))


@router.post("/students/{student_id}/diagnostics", response_model=schemas.DiagnosticOut, status_code=201)
def create_diagnostic(student_id: int, body: schemas.DiagnosticIn, db: DBSession = Depends(get_db)):
    s = _student(db, student_id)
    r = diagnosis.diagnose(body.answers)
    d = models.Diagnostic(
        student_id=s.id,
        answers_json=json_set(body.answers),
        stuck_json=json_set(r["stuck"]),
        scores_json=json_set(r["scores"]),
        correct=r["correct"],
        total=r["total"],
        all_clear=r["all_clear"],
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    skills = C.skills()
    return schemas.DiagnosticOut(id=d.id, stuck_titles=[skills[k]["title"] for k in r["stuck"]], **r)


@router.put("/students/{student_id}/availability", response_model=schemas.AvailabilityOut)
def put_availability(student_id: int, body: schemas.AvailabilityIn, db: DBSession = Depends(get_db)):
    s = _student(db, student_id)
    s.availability.clear()
    db.flush()
    for slot in body.slots:
        s.availability.append(models.Availability(slot_id=slot))
    db.commit()
    return schemas.AvailabilityOut(student_id=s.id, slots=body.slots)


@router.post("/students/{student_id}/practices", response_model=schemas.PracticeOut, status_code=201)
def create_practice(student_id: int, body: schemas.PracticeIn, db: DBSession = Depends(get_db)):
    s = _student(db, student_id)
    if body.skill_id not in C.skills():
        raise HTTPException(status_code=422, detail=f"沒有這個卡點：{body.skill_id}")
    today = body.date or rules.local_now().date()
    today_count = sum(1 for p in s.practices if p.date == today)
    if today_count >= s.daily_cap:
        raise HTTPException(status_code=409, detail=f"今天的練習到上限了（{s.daily_cap} 件）。明天再來。")
    p = models.Practice(student_id=s.id, skill_id=body.skill_id, kind=body.kind, date=today, hints=body.hints, explain_passed=body.explain_passed, ok=body.ok)
    db.add(p)
    db.commit()
    db.refresh(p)
    return schemas.PracticeOut(
        id=p.id,
        student_id=p.student_id,
        skill_id=p.skill_id,
        kind=p.kind,
        date=p.date,
        hints=p.hints,
        explain_passed=p.explain_passed,
        ok=p.ok,
        today_count=today_count + 1,
        daily_cap=s.daily_cap,
    )


@router.get("/students/{student_id}/practices", response_model=List[schemas.PracticeOut])
def list_practices(student_id: int, db: DBSession = Depends(get_db)):
    return _student(db, student_id).practices


@router.post("/students/{student_id}/retests", response_model=schemas.RetestOut, status_code=201)
def create_retest(student_id: int, body: schemas.RetestIn, db: DBSession = Depends(get_db)):
    s = _student(db, student_id)
    if body.skill_id not in C.skills():
        raise HTTPException(status_code=422, detail=f"沒有這個卡點：{body.skill_id}")
    start: date = body.from_date or rules.local_now().date()
    r = models.Retest(student_id=s.id, skill_id=body.skill_id, from_date=start, due_date=rules.retest_due(start, body.hints), hints_used=body.hints)
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.get("/students/{student_id}/retests", response_model=List[schemas.RetestOut])
def list_retests(student_id: int, db: DBSession = Depends(get_db)):
    return _student(db, student_id).retests


@router.post("/retests/{retest_id}/complete", response_model=schemas.RetestOut)
def complete_retest(retest_id: int, body: schemas.RetestCompleteIn, db: DBSession = Depends(get_db)):
    r = db.get(models.Retest, retest_id)
    if not r:
        raise HTTPException(status_code=404, detail="找不到這次再測。")
    if r.status != "scheduled":
        raise HTTPException(status_code=409, detail="這次再測已經完成了。")
    on = body.on or rules.local_now().date()
    if on < r.due_date:
        raise HTTPException(status_code=409, detail=f"還沒到再測日（{r.due_date.isoformat()}），先讓它沉澱幾天。")
    r.status = "mastered" if body.passed else "failed"
    r.completed_on = on
    db.commit()
    db.refresh(r)
    return r


@router.get("/students/{student_id}/parent-report", response_model=schemas.ParentReportOut)
def parent_report(student_id: int, today: date = None, db: DBSession = Depends(get_db)):  # type: ignore[assignment]
    s = _student(db, student_id)
    return report.build(db, s, today)


@router.get("/students/{student_id}/parent-reports")
def parent_reports(student_id: int, db: DBSession = Depends(get_db)):
    s = _student(db, student_id)
    rows = db.query(models.ParentReport).filter_by(student_id=s.id).order_by(models.ParentReport.id.desc()).limit(10).all()
    return [json_get(r.body_json, {}) for r in rows]
