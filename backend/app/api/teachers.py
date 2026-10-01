"""老師：清單、收入試算、招募表單。"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as DBSession

from .. import models, schemas
from ..models import json_get, json_set
from ..services import rules
from .deps import get_db, require_admin

router = APIRouter(tags=["老師"])


@router.get("/teachers", response_model=List[schemas.TeacherOut])
def list_teachers(db: DBSession = Depends(get_db)):
    return db.query(models.Teacher).order_by(models.Teacher.id).all()


@router.get("/teachers/{teacher_id}/earnings", response_model=schemas.EarningsOut)
def earnings(
    teacher_id: int,
    tier: str = Query(default=None, description="novice / gold / diamond；不給就用老師自己的等級"),  # type: ignore[assignment]
    teams: int = Query(default=2, ge=1, le=20, description="每週幾團"),
    size: int = Query(default=4, ge=1, le=6, description="每團幾人"),
    db: DBSession = Depends(get_db),
):
    t = db.get(models.Teacher, teacher_id)
    if not t:
        raise HTTPException(status_code=404, detail="找不到這位老師。")
    return schemas.EarningsOut(teacher_id=t.id, **rules.earnings(tier or t.tier, teams, size))


@router.post("/teacher-applications", response_model=schemas.TeacherApplicationReceipt, status_code=201)
def create_application(body: schemas.TeacherApplicationIn, db: DBSession = Depends(get_db)):
    a = models.TeacherApplication(
        name=body.name,
        contact=body.contact,
        subjects_json=json_set(body.subjects),
        slots_json=json_set(body.slots),
        experience=body.experience,
        note=body.note.strip(),
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    # 不把姓名／聯絡方式寫進日誌
    return schemas.TeacherApplicationReceipt(id=a.id, status=a.status, message="已收到。正式招募開始時，會用你留的方式聯絡。")


@router.get("/teacher-applications", response_model=List[schemas.TeacherApplicationOut], dependencies=[Depends(require_admin)])
def list_applications(db: DBSession = Depends(get_db)):
    rows = db.query(models.TeacherApplication).order_by(models.TeacherApplication.id.desc()).all()
    return [
        schemas.TeacherApplicationOut(
            id=r.id,
            name=r.name,
            contact=r.contact,
            subjects=json_get(r.subjects_json),
            slots=json_get(r.slots_json),
            experience=r.experience,
            note=r.note,
            status=r.status,
        )
        for r in rows
    ]
