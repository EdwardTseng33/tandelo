"""資料模型（SQLAlchemy 2）。所有示範資料都是虛構的；欄位只放 POC 需要的最小集合。

JSON 欄位一律用 Text 存 JSON 字串（SQLite 與 Postgres 都能用），存取透過 json_get / json_set。
"""

import datetime as _dt
import json
from typing import Any, List, Optional

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> _dt.datetime:
    return _dt.datetime.now(_dt.timezone.utc).replace(tzinfo=None)


def json_get(raw: Optional[str], default: Any = None) -> Any:
    if not raw:
        return default if default is not None else []
    try:
        return json.loads(raw)
    except ValueError:
        return default if default is not None else []


def json_set(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


class Student(Base):
    """學生：只存暱稱，不存真名與聯絡方式。"""

    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nickname: Mapped[str] = mapped_column(String(40))
    grade: Mapped[str] = mapped_column(String(10), default="國二")
    exam_date: Mapped[Optional[_dt.date]] = mapped_column(Date, nullable=True)
    goal: Mapped[str] = mapped_column(String(80), default="段考數學進步")
    daily_cap: Mapped[int] = mapped_column(Integer, default=3)
    is_seed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[_dt.datetime] = mapped_column(DateTime, default=utcnow)

    diagnostics: Mapped[List["Diagnostic"]] = relationship(back_populates="student", order_by="Diagnostic.id")
    availability: Mapped[List["Availability"]] = relationship(back_populates="student", cascade="all, delete-orphan")
    memberships: Mapped[List["TeamMember"]] = relationship(back_populates="student")
    practices: Mapped[List["Practice"]] = relationship(back_populates="student", order_by="Practice.id")
    retests: Mapped[List["Retest"]] = relationship(back_populates="student", order_by="Retest.id")

    @property
    def stuck(self) -> List[str]:
        """最新一次診斷判出的卡點清單。"""
        if not self.diagnostics:
            return []
        return json_get(self.diagnostics[-1].stuck_json)


class Diagnostic(Base):
    """初步診斷：送進來的答題與判出的卡點。"""

    __tablename__ = "diagnostics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    answers_json: Mapped[str] = mapped_column(Text, default="{}")
    stuck_json: Mapped[str] = mapped_column(Text, default="[]")
    scores_json: Mapped[str] = mapped_column(Text, default="{}")
    correct: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)
    all_clear: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[_dt.datetime] = mapped_column(DateTime, default=utcnow)

    student: Mapped[Student] = relationship(back_populates="diagnostics")


class Availability(Base):
    """時段格：slot_id 如 d2-1900（週三 19:00）。"""

    __tablename__ = "availability"
    __table_args__ = (UniqueConstraint("student_id", "slot_id", name="uq_availability"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    slot_id: Mapped[str] = mapped_column(String(12))

    student: Mapped[Student] = relationship(back_populates="availability")


class Teacher(Base):
    __tablename__ = "teachers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nickname: Mapped[str] = mapped_column(String(40))
    tier: Mapped[str] = mapped_column(String(10), default="gold")  # novice / gold / diamond
    intro: Mapped[str] = mapped_column(Text, default="")
    is_seed: Mapped[bool] = mapped_column(Boolean, default=False)

    teams: Mapped[List["Team"]] = relationship(back_populates="teacher")


class Team(Base):
    """小隊：同科目、同時段、同一位老師；成班下限 4、上限 6。"""

    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(40), default="")  # 隊名（冒險世界的榜、守塔名冊用）；空字串＝尚未取名
    subject: Mapped[str] = mapped_column(String(20), default="數學")
    grade: Mapped[str] = mapped_column(String(10), default="國二")
    slot_id: Mapped[str] = mapped_column(String(12))
    first_date: Mapped[Optional[_dt.date]] = mapped_column(Date, nullable=True)
    teacher_id: Mapped[Optional[int]] = mapped_column(ForeignKey("teachers.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(12), default="forming")  # forming / confirmed / cancelled
    mode: Mapped[Optional[str]] = mapped_column(String(12), nullable=True)  # squad / one_to_three
    min_size: Mapped[int] = mapped_column(Integer, default=4)
    max_size: Mapped[int] = mapped_column(Integer, default=6)
    focus_json: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[_dt.datetime] = mapped_column(DateTime, default=utcnow)

    teacher: Mapped[Optional[Teacher]] = relationship(back_populates="teams")
    members: Mapped[List["TeamMember"]] = relationship(back_populates="team", cascade="all, delete-orphan", order_by="TeamMember.id")
    sessions: Mapped[List["Session"]] = relationship(back_populates="team", cascade="all, delete-orphan", order_by="Session.week")

    @property
    def size(self) -> int:
        return len(self.members)


class TeamMember(Base):
    __tablename__ = "team_members"
    __table_args__ = (UniqueConstraint("team_id", "student_id", name="uq_team_member"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    plan_id: Mapped[str] = mapped_column(String(6), default="8")
    joined_at: Mapped[_dt.datetime] = mapped_column(DateTime, default=utcnow)

    team: Mapped[Team] = relationship(back_populates="members")
    student: Mapped[Student] = relationship(back_populates="memberships")


class TeacherApplication(Base):
    """老師招募表單。contact 只在後端保存，不進日誌、不對外列出（除管理端點）。"""

    __tablename__ = "teacher_applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(60))
    contact: Mapped[str] = mapped_column(String(120))
    subjects_json: Mapped[str] = mapped_column(Text, default="[]")
    slots_json: Mapped[str] = mapped_column(Text, default="[]")
    experience: Mapped[str] = mapped_column(String(40))
    note: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(12), default="received")  # received / reviewing / accepted / declined
    created_at: Mapped[_dt.datetime] = mapped_column(DateTime, default=utcnow)


class Session(Base):
    """小隊課：每週一堂、六段 50 分鐘。"""

    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), index=True)
    week: Mapped[int] = mapped_column(Integer)
    date: Mapped[_dt.date] = mapped_column(Date)
    topic: Mapped[str] = mapped_column(String(80), default="")
    skill_id: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    segments_json: Mapped[str] = mapped_column(Text, default="[]")
    status: Mapped[str] = mapped_column(String(12), default="scheduled")  # scheduled / done / cancelled

    team: Mapped[Team] = relationship(back_populates="sessions")
    notes: Mapped[List["SessionNote"]] = relationship(back_populates="session", cascade="all, delete-orphan")


class SessionNote(Base):
    """老師課後 30 秒紀錄。"""

    __tablename__ = "session_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"), index=True)
    teacher_id: Mapped[Optional[int]] = mapped_column(ForeignKey("teachers.id"), nullable=True)
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[_dt.datetime] = mapped_column(DateTime, default=utcnow)

    session: Mapped[Session] = relationship(back_populates="notes")


class Practice(Base):
    """練習紀錄：哪一題、幫忙幾次、說給我聽有沒有過。"""

    __tablename__ = "practices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    skill_id: Mapped[str] = mapped_column(String(20))
    kind: Mapped[str] = mapped_column(String(12), default="ask")  # ask / explain / transfer / retest
    date: Mapped[_dt.date] = mapped_column(Date)
    hints: Mapped[int] = mapped_column(Integer, default=0)
    explain_passed: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    ok: Mapped[bool] = mapped_column(Boolean, default=True)

    student: Mapped[Student] = relationship(back_populates="practices")


class Retest(Base):
    """再測：排在 7–12 天後、不給提示；通過→已掌握。"""

    __tablename__ = "retests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    skill_id: Mapped[str] = mapped_column(String(20))
    from_date: Mapped[_dt.date] = mapped_column(Date)
    due_date: Mapped[_dt.date] = mapped_column(Date)
    hints_used: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(12), default="scheduled")  # scheduled / mastered / failed
    completed_on: Mapped[Optional[_dt.date]] = mapped_column(Date, nullable=True)

    student: Mapped[Student] = relationship(back_populates="retests")


class ParentReport(Base):
    """家長週報：由狀態生成後存一份，方便重看。"""

    __tablename__ = "parent_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    week_start: Mapped[_dt.date] = mapped_column(Date)
    week_end: Mapped[_dt.date] = mapped_column(Date)
    body_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[_dt.datetime] = mapped_column(DateTime, default=utcnow)


# ——— 冒險世界（0.2）：影子、戰績、副本、對戰、公會、守塔 ———
class Shadow(Base):
    """影子：一位學生對一隻怪的狀態（fog／near／hit／captured／asleep）。規則在 services/world.py。"""

    __tablename__ = "shadows"
    __table_args__ = (UniqueConstraint("student_id", "monster_id", name="uq_shadow"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    monster_id: Mapped[str] = mapped_column(String(24))
    state: Mapped[str] = mapped_column(String(12), default="fog")
    captured_at: Mapped[Optional[_dt.datetime]] = mapped_column(DateTime, nullable=True)
    woke_at: Mapped[Optional[_dt.datetime]] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[_dt.datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class RecordEvent(Base):
    """戰績事件：只從驗證過的學會來（收服 10、叫醒 5、講解 3、副本 5／8／12）。
    個人事件有 student_id；副本過關是全隊一份，只有 team_id。region_id 用來點燈與守塔。"""

    __tablename__ = "record_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[Optional[int]] = mapped_column(ForeignKey("students.id"), nullable=True, index=True)
    team_id: Mapped[Optional[int]] = mapped_column(ForeignKey("teams.id"), nullable=True, index=True)
    kind: Mapped[str] = mapped_column(String(16))
    points: Mapped[int] = mapped_column(Integer, default=0)
    region_id: Mapped[Optional[str]] = mapped_column(String(24), nullable=True)
    created_at: Mapped[_dt.datetime] = mapped_column(DateTime, default=utcnow)


class Dungeon(Base):
    """副本：一隊一週一個；巡邏 3 題＋接力 1 棒＋伏擊層（不計分）。status：open／settled／retreat。"""

    __tablename__ = "dungeons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), index=True)
    week: Mapped[int] = mapped_column(Integer)
    route: Mapped[str] = mapped_column(String(12), default="plain")
    subject: Mapped[str] = mapped_column(String(20), default="數學")
    region_id: Mapped[Optional[str]] = mapped_column(String(24), nullable=True)
    status: Mapped[str] = mapped_column(String(12), default="open")
    rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    stars: Mapped[int] = mapped_column(Integer, default=0)
    opened_at: Mapped[_dt.datetime] = mapped_column(DateTime, default=utcnow)
    settled_at: Mapped[Optional[_dt.datetime]] = mapped_column(DateTime, nullable=True)
    answers_json: Mapped[str] = mapped_column(Text, default="[]")
    absences_json: Mapped[str] = mapped_column(Text, default="[]")


class Match(Base):
    """小隊對戰：mirror（鏡像賽）或 duel（出題戰）。team_b_id 空＝幽靈隊。結果只有兩隊和兩位嚮導看得到。"""

    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_a_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), index=True)
    team_b_id: Mapped[Optional[int]] = mapped_column(ForeignKey("teams.id"), nullable=True, index=True)
    kind: Mapped[str] = mapped_column(String(8))
    week: Mapped[int] = mapped_column(Integer)
    result_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[_dt.datetime] = mapped_column(DateTime, default=utcnow)


class Guild(Base):
    """公會：一位嚮導名下所有小隊；league 是聯賽區（north／central／south／east），只到這四個字。"""

    __tablename__ = "guilds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id"), index=True)
    name: Mapped[str] = mapped_column(String(40))
    league: Mapped[str] = mapped_column(String(10), default="north")

    teacher: Mapped[Teacher] = relationship()


class TowerKeeper(Base):
    """守塔名冊：某聯賽區某區域的燈塔，某一層（路線）在某月由哪一隊守。並列各一列；永久留著、不衰減。"""

    __tablename__ = "tower_keepers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    league: Mapped[str] = mapped_column(String(10), index=True)
    region_id: Mapped[str] = mapped_column(String(24), index=True)
    route: Mapped[str] = mapped_column(String(12))
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"))
    month: Mapped[str] = mapped_column(String(7))  # YYYY-MM
    records: Mapped[int] = mapped_column(Integer, default=0)
