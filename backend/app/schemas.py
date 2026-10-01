"""API 的輸入輸出結構（Pydantic 2）。程式碼相容 Python 3.9，所以用 Optional / List 而不是 |。"""

import datetime as _dt
import re
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

SLOT_RE = re.compile(r"^d[0-6]-(1400|1900|2000)$")
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
EXPERIENCE_CHOICES = ("none", "under1", "1to3", "over3", "school")
TIER_CHOICES = ("novice", "gold", "diamond")


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ——— 學生 ———
class StudentCreate(BaseModel):
    nickname: str = Field(min_length=1, max_length=40)
    grade: str = Field(default="國二", max_length=10)
    exam_date: Optional[_dt.date] = None
    goal: str = Field(default="段考數學進步", max_length=80)
    daily_cap: int = Field(default=3, ge=1, le=10)


class StudentOut(ORM):
    id: int
    nickname: str
    grade: str
    exam_date: Optional[_dt.date]
    goal: str
    daily_cap: int
    stuck: List[str] = []
    slots: List[str] = []


# ——— 診斷 ———
class DiagnosticIn(BaseModel):
    """answers：{題號: 選項索引}；-1 代表「不確定」。"""

    answers: Dict[str, int]


class DiagnosticOut(BaseModel):
    id: int
    stuck: List[str]
    stuck_titles: List[str]
    scores: Dict[str, int]
    correct: int
    total: int
    all_clear: bool
    status: Dict[str, str]


# ——— 時段 ———
class AvailabilityIn(BaseModel):
    slots: List[str]

    @field_validator("slots")
    @classmethod
    def check_slots(cls, v: List[str]) -> List[str]:
        bad = [s for s in v if not SLOT_RE.match(s)]
        if bad:
            raise ValueError(f"時段格式不對：{'、'.join(bad)}（例：d2-1900）")
        return sorted(set(v))


class AvailabilityOut(BaseModel):
    student_id: int
    slots: List[str]


# ——— 小隊 ———
class TeamMatchIn(BaseModel):
    student_id: int
    plan_id: str = Field(default="8", pattern=r"^(4|8|8\+1)$")


class TeamJoinIn(BaseModel):
    student_id: int
    plan_id: str = Field(default="8", pattern=r"^(4|8|8\+1)$")


class TeamAcceptIn(BaseModel):
    teacher_id: int


class MemberOut(BaseModel):
    student_id: int
    nickname: str
    plan_id: str
    stuck: List[str]


class TeamOut(BaseModel):
    id: int
    name: str = ""
    subject: str
    grade: str
    slot_id: str
    slot_label: str
    first_date: Optional[_dt.date]
    teacher_id: Optional[int]
    teacher_name: Optional[str]
    status: str
    mode: Optional[str]
    size: int
    min_size: int
    max_size: int
    rule: str
    focus: List[str]
    members: List[MemberOut]
    sessions: int = 0


# ——— 練習與再測 ———
class PracticeIn(BaseModel):
    skill_id: str
    kind: str = Field(default="ask", pattern=r"^(ask|explain|transfer|retest)$")
    date: Optional[_dt.date] = None
    hints: int = Field(default=0, ge=0, le=20)
    explain_passed: Optional[bool] = None
    ok: bool = True


class PracticeOut(ORM):
    id: int
    student_id: int
    skill_id: str
    kind: str
    date: _dt.date
    hints: int
    explain_passed: Optional[bool]
    ok: bool
    today_count: int = 0
    daily_cap: int = 3


class RetestIn(BaseModel):
    skill_id: str
    hints: int = Field(default=0, ge=0, le=20)
    from_date: Optional[_dt.date] = None


class RetestOut(ORM):
    id: int
    student_id: int
    skill_id: str
    from_date: _dt.date
    due_date: _dt.date
    hints_used: int
    status: str
    completed_on: Optional[_dt.date]


class RetestCompleteIn(BaseModel):
    passed: bool
    on: Optional[_dt.date] = None


# ——— 課堂紀錄 ———
class SessionNoteIn(BaseModel):
    teacher_id: Optional[int] = None
    text: str = Field(min_length=1, max_length=600)


class SessionNoteOut(ORM):
    id: int
    session_id: int
    teacher_id: Optional[int]
    text: str


class SessionOut(ORM):
    id: int
    team_id: int
    week: int
    date: _dt.date
    topic: str
    skill_id: Optional[str]
    status: str


# ——— 家長週報 ———
class ParentReportOut(BaseModel):
    student_id: int
    nickname: str
    week_start: _dt.date
    week_end: _dt.date
    learned: List[str]
    explained: List[Dict[str, str]]
    practice_days: int
    explain_passes: int
    hints: int
    next_session: Optional[Dict[str, str]]
    next_week: List[str]
    tonight: Optional[str]
    teacher_note: Optional[str]
    lines: List[str]


# ——— 招募表單 ———
class TeacherApplicationIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    contact: str = Field(min_length=3, max_length=120)
    subjects: List[str] = Field(min_length=1)
    slots: List[str] = Field(min_length=1)
    experience: str
    note: str = Field(default="", max_length=600)
    consent: bool

    @field_validator("name", "contact")
    @classmethod
    def strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("不能是空白")
        return v

    @field_validator("contact")
    @classmethod
    def contact_ok(cls, v: str) -> str:
        digits = re.sub(r"[\s\-()]", "", v)
        digits = re.sub(r"^\+886", "0", digits)
        if EMAIL_RE.match(v) or re.match(r"^09\d{8}$", digits) or re.match(r"^0\d{8,9}$", digits):
            return v
        raise ValueError("格式看起來不太對：請填 Email，或 09 開頭的手機號碼。")

    @field_validator("experience")
    @classmethod
    def experience_ok(cls, v: str) -> str:
        if v not in EXPERIENCE_CHOICES:
            raise ValueError(f"教學經驗要是 {'、'.join(EXPERIENCE_CHOICES)} 之一")
        return v

    @field_validator("consent")
    @classmethod
    def consent_ok(cls, v: bool) -> bool:
        if not v:
            raise ValueError("請勾選已閱讀個資用途說明，才能送出。")
        return v


class TeacherApplicationOut(BaseModel):
    id: int
    name: str
    contact: str
    subjects: List[str]
    slots: List[str]
    experience: str
    note: str
    status: str


class TeacherApplicationReceipt(BaseModel):
    id: int
    status: str
    message: str


# ——— 老師 ———
class TeacherOut(ORM):
    id: int
    nickname: str
    tier: str
    intro: str


class EarningsOut(BaseModel):
    teacher_id: int
    tier: str
    rate: float
    teams: int
    size: int
    per_student_tuition: float
    tuition: int
    share: int
    per_session: int
    floored: bool
    floor: int
    weekly_hours: float
    monthly: int


# ——— 小陪 ———
class CoachReplyIn(BaseModel):
    skill_id: str
    message: str = Field(default="", max_length=400)
    action: str = Field(default="start", pattern=r"^(start|answer|hint)$")
    step: int = Field(default=0, ge=0)
    hint_level: int = Field(default=0, ge=0)
    start_tier: int = Field(default=1, ge=0, le=2)
    time: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$", description="示範用：覆蓋現在時間（HH:MM）")


class CoachReplyOut(BaseModel):
    provider: str
    lights_out: bool
    messages: List[Dict[str, str]]
    step: int
    hint_level: int
    done: bool
    ok: Optional[bool] = None


# ——— 冒險世界（0.2）———
class MonsterCard(BaseModel):
    """怪的傳說卡：五個欄位每一個都是教學（出身＝成因、騙術＝誤解、口頭禪＝錯的推理、弱點＝正確概念、被識破時＝回饋）。"""

    id: str
    name: str
    skill_id: Optional[str]
    region: str
    continent: str
    shape: str
    status: str
    title: str
    origin: str
    trick: str
    taunt: str
    weakness: str
    caught_line: str


class WorldMapOut(BaseModel):
    continents: List[Dict[str, Any]]
    regions: List[Dict[str, Any]]
    lighthouses: List[Dict[str, Any]]
    monsters: List[MonsterCard]
    shadow_states: List[Dict[str, Any]]
    routes: List[Dict[str, Any]]
    leagues: List[Dict[str, Any]]


class ShadowOut(BaseModel):
    student_id: int
    monster_id: str
    name: str
    region: str
    state: str
    captured_at: Optional[_dt.datetime] = None
    woke_at: Optional[_dt.datetime] = None


class ShadowEventIn(BaseModel):
    event: str = Field(pattern=r"^(diagnosed_stuck|explained_ok|retest_passed|wrong_again|woken)$")


class ShadowEventOut(ShadowOut):
    previous_state: str
    record_kind: Optional[str]
    points: int
    today_count: int
    daily_cap: int


class RecordEventOut(ORM):
    id: int
    student_id: Optional[int]
    team_id: Optional[int]
    kind: str
    points: int
    region_id: Optional[str]
    created_at: _dt.datetime


class StudentRecordOut(BaseModel):
    student_id: int
    nickname: str
    total: int
    events: List[RecordEventOut]


class TeamRecordOut(BaseModel):
    team_id: int
    name: str
    size: int
    total: int
    per_capita: float
    guild_per_capita: float
    route: str
    unlocks: Dict[str, Any]


class DungeonOpenIn(BaseModel):
    week: int = Field(ge=1, le=8)
    subject: Optional[str] = Field(default=None, max_length=20)
    region_id: Optional[str] = Field(default=None, max_length=24)
    time: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$", description="示範用：覆蓋現在時間（HH:MM），關燈時段不開門")


class DungeonOut(BaseModel):
    id: int
    team_id: int
    week: int
    route: str
    subject: str
    region_id: Optional[str]
    status: str
    rate: Optional[float]
    stars: int
    opened_at: _dt.datetime
    settled_at: Optional[_dt.datetime]
    answers: int
    absences: List[int]


class DungeonAnswerIn(BaseModel):
    student_id: int
    layer: str = Field(default="patrol", pattern=r"^(patrol|relay|ambush)$")
    correct: bool
    helped: bool = False  # 問過小陪或求援；照樣算分，只有嚮導看得到


class DungeonAbsenceIn(BaseModel):
    student_id: int


class DungeonSettleIn(BaseModel):
    skipped_relays: int = Field(default=0, ge=0, le=6, description="24 小時沒接被跳過的棒數，移出分母")


class DungeonSettleOut(DungeonOut):
    result: Dict[str, Any]
    next_route: str


class MirrorMatchIn(BaseModel):
    team_a_id: int
    team_b_id: Optional[int] = None  # 空＝幽靈隊
    week: int = Field(ge=1, le=8)
    rate_a: Optional[float] = Field(default=None, ge=0, le=1, description="不給就用該週已結算副本的解題率")
    rate_b: Optional[float] = Field(default=None, ge=0, le=1, description="幽靈隊＝同路線隊伍的歷史平均，由呼叫端給")
    votes_a: Optional[List[bool]] = None  # 匿名投票；有一票不同意就打幽靈隊
    votes_b: Optional[List[bool]] = None


class DuelMatchIn(BaseModel):
    team_a_id: int
    team_b_id: Optional[int] = None
    week: int = Field(ge=1, le=8)
    answers_a_correct: List[bool] = Field(min_length=3, max_length=3)
    answers_b_correct: List[bool] = Field(min_length=3, max_length=3)
    setting_valid_a: List[bool] = Field(min_length=3, max_length=3)
    setting_valid_b: List[bool] = Field(min_length=3, max_length=3)
    forfeit_a: bool = False
    forfeit_b: bool = False
    votes_a: Optional[List[bool]] = None
    votes_b: Optional[List[bool]] = None


class MatchOut(BaseModel):
    id: int
    kind: str
    week: int
    team_a_id: int
    team_b_id: Optional[int]
    ghost: bool
    result: Dict[str, Any]


class TowerOut(BaseModel):
    league: str
    region_id: str
    region_name: str
    lighthouse: Dict[str, Any]
    month: Optional[str]
    keepers: Dict[str, List[Dict[str, Any]]]
    hall_of_fame: List[Dict[str, Any]]


class TowerSettleIn(BaseModel):
    month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$", description="結算哪一個月（YYYY-MM）")


class TowerSettleOut(BaseModel):
    month: str
    settled: List[Dict[str, Any]]


class BoardOut(BaseModel):
    league: str
    subject: str
    route: str
    entries: List[Dict[str, Any]]
