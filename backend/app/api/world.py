"""冒險世界（0.2）：地圖、夥伴、戰績、副本、對戰、燈塔與守塔、鄰近榜。

路由只做「取資料、呼叫 services/world.py、轉成回應」；所有數字與判斷都在 service 裡。
隊友畫面不露名字：小隊戰績只回加總與人均，榜只回前後各三隊、不含名次與總數。
"""

from datetime import timedelta
from typing import Any, Dict, List, Optional, Set

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session as DBSession

from .. import models, schemas
from ..core.config import Settings
from ..models import json_get, json_set, utcnow
from ..services import camp, rules
from ..services import content as C
from ..services import variants as V
from ..services import world as W
from .deps import get_db, get_settings_dep, require_admin

router = APIRouter(tags=["世界"])


# ——— 取資料的小工具 ———
def _student(db: DBSession, student_id: int) -> models.Student:
    s = db.get(models.Student, student_id)
    if not s:
        raise HTTPException(status_code=404, detail="找不到這位學生。")
    return s


def _team(db: DBSession, team_id: int) -> models.Team:
    t = db.get(models.Team, team_id)
    if not t:
        raise HTTPException(status_code=404, detail="找不到這一隊。")
    return t


def _dungeon(db: DBSession, dungeon_id: int) -> models.Dungeon:
    d = db.get(models.Dungeon, dungeon_id)
    if not d:
        raise HTTPException(status_code=404, detail="找不到這個副本。")
    return d


def _monster(monster_id: str) -> Dict[str, Any]:
    m = C.monsters().get(monster_id)
    if not m:
        raise HTTPException(status_code=404, detail=f"沒有這隻怪：{monster_id}")
    return m


def _region(region_id: str) -> Dict[str, Any]:
    r = C.regions().get(region_id)
    if not r:
        raise HTTPException(status_code=404, detail=f"沒有這一區：{region_id}")
    return r


def _league(league: str) -> str:
    if league not in C.league_ids():
        raise HTTPException(status_code=404, detail="聯賽區只有 north／central／south／east。")
    return league


def _member_ids(team: models.Team) -> List[int]:
    return [m.student_id for m in team.members]


def _is_member(team: models.Team, student_id: int) -> bool:
    return student_id in _member_ids(team)


def _team_events(db: DBSession, team: models.Team) -> List[models.RecordEvent]:
    """小隊的戰績事件＝全隊一份的副本事件＋每位隊員的個人事件。"""
    ids = _member_ids(team)
    q = db.query(models.RecordEvent).filter((models.RecordEvent.team_id == team.id) | (models.RecordEvent.student_id.in_(ids) if ids else False))
    return q.all()


def _points(events: List[models.RecordEvent], region_id: Optional[str] = None, month: Optional[str] = None) -> int:
    total = 0
    for e in events:
        if region_id and e.region_id != region_id:
            continue
        if month and e.created_at.strftime("%Y-%m") != month:
            continue
        total += e.points
    return total


def _team_route(db: DBSession, team: models.Team) -> str:
    """這一季走到哪條路線：看最近一個副本；過關兩星以上就往上一條，撤退留在原路線。"""
    last = db.query(models.Dungeon).filter_by(team_id=team.id).order_by(models.Dungeon.week.desc(), models.Dungeon.id.desc()).first()
    if not last:
        return W.FIRST_ROUTE
    if last.status == "settled":
        return W.next_route(last.route, last.stars >= 2)
    return last.route


def _guild_of(db: DBSession, team: models.Team) -> Optional[models.Guild]:
    if not team.teacher_id:
        return None
    return db.query(models.Guild).filter_by(teacher_id=team.teacher_id).first()


def _league_teams(db: DBSession, league: str) -> List[models.Team]:
    teacher_ids = [g.teacher_id for g in db.query(models.Guild).filter_by(league=league).all()]
    if not teacher_ids:
        return []
    return db.query(models.Team).filter(models.Team.teacher_id.in_(teacher_ids), models.Team.status == "confirmed").order_by(models.Team.id).all()


def _played(db: DBSession, team_id: int) -> Set[int]:
    out: Set[int] = set()
    for m in db.query(models.Match).filter((models.Match.team_a_id == team_id) | (models.Match.team_b_id == team_id)).all():
        other = m.team_b_id if m.team_a_id == team_id else m.team_a_id
        if other is not None:
            out.add(other)
    return out


def _squad(db: DBSession, team: models.Team) -> Dict[str, Any]:
    guild = _guild_of(db, team)
    return {
        "id": team.id,
        "subject": team.subject,
        "route": _team_route(db, team),
        "grade": team.grade,
        "textbook": None,  # POC 還沒有教科書版本欄位，兩邊都是 None 視為同版本
        "guide_id": team.teacher_id,
        "league": guild.league if guild else None,
        "played": _played(db, team.id),
    }


def _history(db: DBSession, team: models.Team, week: int) -> List[str]:
    """這一隊遠征過的怪：到這週為止的課表卡點，加上隊員夥伴裡已經偵察到的怪。"""
    seen: List[str] = []
    for s in team.sessions:
        if s.week <= week and s.skill_id and s.skill_id not in seen:
            seen.append(s.skill_id)
    ids = _member_ids(team)
    if ids:
        for sh in db.query(models.Shadow).filter(models.Shadow.student_id.in_(ids), models.Shadow.state != "fog").all():
            if sh.monster_id not in seen:
                seen.append(sh.monster_id)
    return seen


def _ghost_by_votes(votes_a: Optional[List[bool]], votes_b: Optional[List[bool]]) -> bool:
    """任一隊有投票且沒有全員同意，就打幽靈隊；沒投票（None）視為尚未啟用真人對戰的流程，照呼叫端的 team_b 來。"""
    for v in (votes_a, votes_b):
        if v is not None and not W.pvp_enabled(v):
            return True
    return False


def _dungeon_out(d: models.Dungeon) -> Dict[str, Any]:
    return {
        "id": d.id,
        "team_id": d.team_id,
        "week": d.week,
        "route": d.route,
        "subject": d.subject,
        "region_id": d.region_id,
        "status": d.status,
        "rate": d.rate,
        "stars": d.stars,
        "opened_at": d.opened_at,
        "settled_at": d.settled_at,
        "answers": len(json_get(d.answers_json)),
        "absences": json_get(d.absences_json),
    }


# ——— 地圖 ———
@router.get("/world/map", response_model=schemas.WorldMapOut)
def world_map():
    w = C.world()
    return schemas.WorldMapOut(
        continents=w["continents"],
        regions=w["regions"],
        lighthouses=[{"region_id": r["id"], **r["lighthouse"]} for r in w["regions"]],
        monsters=w["monsters"],
        shadow_states=w["shadow_states"],
        routes=w["routes"],
        leagues=w["leagues"],
    )


# ——— 夥伴 ———
def _shadow_out(sh: models.Shadow) -> schemas.ShadowOut:
    m = C.monsters().get(sh.monster_id, {})
    return schemas.ShadowOut(
        student_id=sh.student_id,
        monster_id=sh.monster_id,
        name=m.get("name", sh.monster_id),
        region=m.get("region", ""),
        state=sh.state,
        captured_at=sh.captured_at,
        woke_at=sh.woke_at,
    )


@router.get("/students/{student_id}/shadows", response_model=List[schemas.ShadowOut])
def list_shadows(student_id: int, db: DBSession = Depends(get_db)):
    s = _student(db, student_id)
    have = {sh.monster_id: sh for sh in db.query(models.Shadow).filter_by(student_id=s.id).all()}
    out = []
    for m in C.world()["monsters"]:
        sh = have.get(m["id"]) or models.Shadow(student_id=s.id, monster_id=m["id"], state="fog")
        out.append(_shadow_out(sh))
    return out


@router.post("/students/{student_id}/shadows/{monster_id}/events", response_model=schemas.ShadowEventOut)
def shadow_event(
    student_id: int, monster_id: str, body: schemas.ShadowEventIn, db: DBSession = Depends(get_db), settings: Settings = Depends(get_settings_dep)
):
    s = _student(db, student_id)
    m = _monster(monster_id)
    sh = db.query(models.Shadow).filter_by(student_id=s.id, monster_id=m["id"]).first()
    if not sh:
        sh = models.Shadow(student_id=s.id, monster_id=m["id"], state="fog")
        db.add(sh)
    previous = sh.state
    try:
        new_state = W.transition(sh.state, body.event)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e)) from None

    kind = W.shadow_record_kind(body.event)
    today = utcnow().date()
    today_count = sum(1 for e in db.query(models.RecordEvent).filter_by(student_id=s.id).all() if e.created_at.date() == today)
    points = 0
    if kind:
        if not W.daily_cap_ok(today_count, s.daily_cap):
            raise HTTPException(status_code=409, detail=f"今天的任務卡用完了（{s.daily_cap} 張）。明天再來。")
        points = W.RECORD_POINTS[kind]
        db.add(models.RecordEvent(student_id=s.id, kind=kind, points=points, region_id=m["region"]))
        today_count += 1
    sh.state = new_state
    now = utcnow()
    if body.event == "retest_passed":
        sh.captured_at = now
    if body.event == "woken":
        sh.woke_at = now
    db.commit()
    db.refresh(sh)
    if body.event in camp.EVENT_KIND:  # 學會的事件才寄營地來信；卡住不寄
        camp.enqueue(db, s, camp.EVENT_KIND[body.event], m["id"], settings=settings)
    return schemas.ShadowEventOut(
        **_shadow_out(sh).model_dump(), previous_state=previous, record_kind=kind, points=points, today_count=today_count, daily_cap=s.daily_cap
    )


# ——— 戰績 ———
@router.get("/students/{student_id}/record", response_model=schemas.StudentRecordOut)
def student_record(student_id: int, db: DBSession = Depends(get_db)):
    s = _student(db, student_id)
    events = db.query(models.RecordEvent).filter_by(student_id=s.id).order_by(models.RecordEvent.id).all()
    return schemas.StudentRecordOut(student_id=s.id, nickname=s.nickname, total=_points(events), events=events)


@router.get("/teams/{team_id}/record", response_model=schemas.TeamRecordOut)
def team_record(team_id: int, db: DBSession = Depends(get_db)):
    team = _team(db, team_id)
    total = _points(_team_events(db, team))
    size = team.size
    guild_total, guild_size = 0, 0
    guild = _guild_of(db, team)
    if guild:
        for t in db.query(models.Team).filter_by(teacher_id=guild.teacher_id).all():
            guild_total += _points(_team_events(db, t))
            guild_size += t.size
    guild_pc = round(guild_total / guild_size, 1) if guild_size else 0.0
    return schemas.TeamRecordOut(
        team_id=team.id,
        name=team.name,
        size=size,
        total=total,
        per_capita=round(total / size, 1) if size else 0.0,
        guild_per_capita=guild_pc,
        route=_team_route(db, team),
        unlocks=W.guild_unlocks(total, guild_pc),
    )


# ——— 副本 ———
@router.post("/teams/{team_id}/dungeons", response_model=schemas.DungeonOut, status_code=201)
def open_dungeon(team_id: int, body: schemas.DungeonOpenIn, db: DBSession = Depends(get_db), settings: Settings = Depends(get_settings_dep)):
    team = _team(db, team_id)
    now_t = rules.parse_hhmm(body.time) if body.time else rules.local_now(settings.timezone).time()
    if W.lights_out_blocks(now_t, settings.lights_out_start, settings.lights_out_end):
        raise HTTPException(status_code=423, detail="關燈中（22:30–06:00）。副本不開門、不推播，明天再來。")
    if db.query(models.Dungeon).filter_by(team_id=team.id, status="open").count():
        raise HTTPException(status_code=409, detail="這一隊還有副本進行中。")
    same_week = db.query(models.Dungeon).filter_by(team_id=team.id, week=body.week).order_by(models.Dungeon.id.desc()).first()
    if same_week:
        if same_week.status != "retreat":
            raise HTTPException(status_code=409, detail="這週的副本已經打過了。")
        if same_week.settled_at and utcnow() < same_week.settled_at + timedelta(hours=W.RETREAT_RETRY_HOURS):
            raise HTTPException(status_code=409, detail=f"撤退後 {W.RETREAT_RETRY_HOURS} 小時才能換一套題重打。")
    region_id = body.region_id
    if region_id:
        _region(region_id)
    else:
        sess = next((x for x in team.sessions if x.week == body.week and x.skill_id), None)
        if sess and sess.skill_id in C.monsters():
            region_id = C.monsters()[sess.skill_id]["region"]
    d = models.Dungeon(team_id=team.id, week=body.week, route=_team_route(db, team), subject=body.subject or team.subject, region_id=region_id)
    db.add(d)
    db.commit()
    db.refresh(d)
    return _dungeon_out(d)


@router.post("/dungeons/{dungeon_id}/answers", response_model=schemas.DungeonOut)
def answer_dungeon(dungeon_id: int, body: schemas.DungeonAnswerIn, db: DBSession = Depends(get_db)):
    d = _dungeon(db, dungeon_id)
    team = _team(db, d.team_id)
    if d.status != "open":
        raise HTTPException(status_code=409, detail="這個副本已經結算了。")
    if not _is_member(team, body.student_id):
        raise HTTPException(status_code=404, detail="這位學生不在這一隊。")
    if body.student_id in json_get(d.absences_json):
        raise HTTPException(status_code=409, detail="已申報缺席，這週的題數已移出。")
    answers = json_get(d.answers_json)
    mine = [a for a in answers if a["member"] == body.student_id and a["layer"] == body.layer]
    quota = {"patrol": W.PATROL_QUOTA, "relay": W.RELAY_QUOTA}.get(body.layer)
    if quota is not None and len(mine) >= quota:
        raise HTTPException(status_code=409, detail=f"這一層的配額（{quota}）已用完。")
    answers.append({"member": body.student_id, "layer": body.layer, "correct": body.correct, "helped": body.helped})
    d.answers_json = json_set(answers)
    db.commit()
    db.refresh(d)
    return _dungeon_out(d)


@router.post("/dungeons/{dungeon_id}/absences", response_model=schemas.DungeonOut)
def declare_absence(dungeon_id: int, body: schemas.DungeonAbsenceIn, db: DBSession = Depends(get_db)):
    d = _dungeon(db, dungeon_id)
    team = _team(db, d.team_id)
    if d.status != "open":
        raise HTTPException(status_code=409, detail="這個副本已經結算了。")
    if not _is_member(team, body.student_id):
        raise HTTPException(status_code=404, detail="這位學生不在這一隊。")
    absences = json_get(d.absences_json)
    if body.student_id in absences:
        raise HTTPException(status_code=409, detail="已經申報過了。")
    season_count = sum(1 for x in db.query(models.Dungeon).filter_by(team_id=team.id).all() if body.student_id in json_get(x.absences_json))
    hours = (utcnow() - d.opened_at).total_seconds() / 3600
    verdict = W.declare_absence(season_count, hours)
    if not verdict["ok"]:
        raise HTTPException(status_code=409, detail=verdict["reason"])
    absences.append(body.student_id)
    d.absences_json = json_set(absences)
    db.commit()
    db.refresh(d)
    return _dungeon_out(d)


@router.post("/dungeons/{dungeon_id}/settle", response_model=schemas.DungeonSettleOut)
def settle_dungeon(dungeon_id: int, body: schemas.DungeonSettleIn, db: DBSession = Depends(get_db)):
    d = _dungeon(db, dungeon_id)
    team = _team(db, d.team_id)
    if d.status != "open":
        raise HTTPException(status_code=409, detail="這個副本已經結算了。")
    r = W.dungeon_result(_member_ids(team), json_get(d.answers_json), json_get(d.absences_json), body.skipped_relays)
    d.rate = r["rate"]
    d.stars = r["stars"]
    d.status = "settled" if r["outcome"] == "clear" else "retreat"
    d.settled_at = utcnow()
    if r["record_kind"]:
        db.add(models.RecordEvent(team_id=team.id, kind=r["record_kind"], points=r["points"], region_id=d.region_id))
    db.commit()
    db.refresh(d)
    return schemas.DungeonSettleOut(**_dungeon_out(d), result=r, next_route=W.next_route(d.route, r["promote"]))


# ——— 對戰 ———
def _pair(db: DBSession, team_a_id: int, team_b_id: Optional[int], votes_a, votes_b):
    a = _team(db, team_a_id)
    b = _team(db, team_b_id) if team_b_id is not None else None
    if b is not None and _ghost_by_votes(votes_a, votes_b):
        b = None  # 有一票不同意：本季打幽靈隊，不說是誰投的
    if b is not None:
        verdict = W.can_match(_squad(db, a), _squad(db, b))
        if not verdict["ok"]:
            raise HTTPException(status_code=409, detail=f"這兩隊不能配對：{verdict['reason']}")
    return a, b


def _week_rate(db: DBSession, team: models.Team, week: int) -> Optional[float]:
    d = (
        db.query(models.Dungeon)
        .filter(models.Dungeon.team_id == team.id, models.Dungeon.week == week, models.Dungeon.status != "open")
        .order_by(models.Dungeon.id.desc())
        .first()
    )
    return d.rate if d else None


@router.post("/matches/mirror", response_model=schemas.MatchOut, status_code=201)
def mirror(body: schemas.MirrorMatchIn, db: DBSession = Depends(get_db)):
    a, b = _pair(db, body.team_a_id, body.team_b_id, body.votes_a, body.votes_b)
    rate_a = body.rate_a if body.rate_a is not None else _week_rate(db, a, body.week)
    rate_b = body.rate_b if body.rate_b is not None else (_week_rate(db, b, body.week) if b else None)
    if rate_a is None:
        raise HTTPException(status_code=409, detail="這一隊這週還沒有結算的副本，也沒有給解題率。")
    if rate_b is None:
        raise HTTPException(status_code=409, detail="對手（或幽靈隊的歷史平均）這週還沒有解題率。")
    result = {**W.mirror_match(rate_a, rate_b), "ghost": b is None}
    m = models.Match(team_a_id=a.id, team_b_id=b.id if b else None, kind="mirror", week=body.week, result_json=json_set(result))
    db.add(m)
    db.commit()
    db.refresh(m)
    return schemas.MatchOut(id=m.id, kind=m.kind, week=m.week, team_a_id=m.team_a_id, team_b_id=m.team_b_id, ghost=b is None, result=result)


@router.post("/matches/duel", response_model=schemas.MatchOut, status_code=201)
def duel(body: schemas.DuelMatchIn, db: DBSession = Depends(get_db)):
    a, b = _pair(db, body.team_a_id, body.team_b_id, body.votes_a, body.votes_b)
    picked = W.pick_duel_monsters(_history(db, a, body.week), _history(db, b, body.week)) if b else {"ghost": True, "monsters": [], "common": []}
    if picked["ghost"]:
        b = None  # 交集不足三隻：改打幽靈隊，由題庫的經典陷阱題代打
    try:
        score = W.duel_score(body.answers_a_correct, body.answers_b_correct, body.setting_valid_a, body.setting_valid_b, body.forfeit_a, body.forfeit_b)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None
    result = {**score, "ghost": b is None, "monsters": picked["monsters"]}
    m = models.Match(team_a_id=a.id, team_b_id=b.id if b else None, kind="duel", week=body.week, result_json=json_set(result))
    db.add(m)
    db.commit()
    db.refresh(m)
    return schemas.MatchOut(id=m.id, kind=m.kind, week=m.week, team_a_id=m.team_a_id, team_b_id=m.team_b_id, ghost=b is None, result=result)


# ——— 燈塔與守塔 ———
@router.get("/leagues/{league}/regions/{region_id}/tower", response_model=schemas.TowerOut)
def tower(league: str, region_id: str, db: DBSession = Depends(get_db)):
    _league(league)
    region = _region(region_id)
    teams = _league_teams(db, league)
    progress = sum(_points(_team_events(db, t), region_id=region_id) for t in teams)
    rows = (
        db.query(models.TowerKeeper)
        .filter_by(league=league, region_id=region_id)
        .order_by(models.TowerKeeper.month.desc(), models.TowerKeeper.route, models.TowerKeeper.id)
        .all()
    )
    names = {t.id: t.name for t in db.query(models.Team).all()}
    month = rows[0].month if rows else None
    keepers: Dict[str, List[Dict[str, Any]]] = {r: [] for r in W.ROUTES}
    for k in rows:
        if k.month == month:
            keepers[k.route].append({"team_id": k.team_id, "name": names.get(k.team_id, ""), "records": k.records})
    hall = [{"month": k.month, "route": k.route, "team_id": k.team_id, "name": names.get(k.team_id, ""), "records": k.records} for k in rows]
    return schemas.TowerOut(
        league=league,
        region_id=region_id,
        region_name=region["name"],
        lighthouse={"region_id": region_id, **region["lighthouse"], **W.lighthouse(progress, region["lighthouse"]["threshold"])},
        month=month,
        keepers=keepers,
        hall_of_fame=hall,
    )


@router.post("/towers/settle", response_model=schemas.TowerSettleOut, dependencies=[Depends(require_admin)])
def settle_towers(body: schemas.TowerSettleIn, db: DBSession = Depends(get_db)):
    """月結算：每個聯賽區、每一區、四層各取當月戰績最高的小隊（並列共同守塔）。同月重跑會覆蓋，名冊不衰減。"""
    settled: List[Dict[str, Any]] = []
    for league in C.league_ids():
        teams = _league_teams(db, league)
        if not teams:
            continue
        events = {t.id: _team_events(db, t) for t in teams}
        routes = {t.id: _team_route(db, t) for t in teams}
        for region_id in C.regions():
            by_route: Dict[str, Dict[int, int]] = {}
            for t in teams:
                pts = _points(events[t.id], region_id=region_id, month=body.month)
                if pts > 0:
                    by_route.setdefault(routes[t.id], {})[t.id] = pts
            if not by_route:
                continue
            r = W.tower_settle(by_route)
            db.query(models.TowerKeeper).filter_by(league=league, region_id=region_id, month=body.month).delete()
            for row in r["hall_of_fame"]:
                db.add(
                    models.TowerKeeper(league=league, region_id=region_id, route=row["route"], team_id=row["team_id"], month=body.month, records=row["records"])
                )
                settled.append({"league": league, "region_id": region_id, **row})
    db.commit()
    return schemas.TowerSettleOut(month=body.month, settled=settled)


# ——— 榜：只回我前後各三隊 ———
@router.get("/leagues/{league}/board", response_model=schemas.BoardOut)
def board(
    league: str,
    team_id: int = Query(..., description="我的隊伍；榜只回這一隊前後各三隊"),
    subject: str = Query(default="數學"),
    route: Optional[str] = Query(default=None, description="plain／hills／ridge／cloud；不給就用我的路線"),
    db: DBSession = Depends(get_db),
):
    _league(league)
    me = _team(db, team_id)
    route = route or _team_route(db, me)
    if route not in W.ROUTES:
        raise HTTPException(status_code=422, detail="路線只有 plain／hills／ridge／cloud。")
    rows = []
    for t in _league_teams(db, league):
        if t.subject != subject or _team_route(db, t) != route:
            continue
        rows.append({"team_id": t.id, "name": t.name, "records": _points(_team_events(db, t))})
    rows.sort(key=lambda r: (-r["records"], r["team_id"]))
    try:
        entries = W.neighbor_board(rows, me.id)
    except ValueError:
        raise HTTPException(status_code=404, detail="這一隊不在這個榜上（聯賽區、科目或路線不符）。") from None
    return schemas.BoardOut(league=league, subject=subject, route=route, entries=entries)


# ——— 題目變體（0.3）：給作答的題不帶答案，用 answer_token 判題 ———
def _variant_secret(request: Request) -> str:
    return request.app.state.variant_secret


def _route(route: str) -> str:
    if route not in W.ROUTES:
        raise HTTPException(status_code=422, detail="路線只有 plain／hills／ridge／cloud。")
    return route


def _bank(monster_id: str, n: int, route: str, seed: str) -> List[Dict[str, Any]]:
    try:
        return V.bank(monster_id, n, route, seed)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e)) from None


@router.get("/world/monsters/{monster_id}/variants", response_model=schemas.VariantListOut)
def monster_variants(
    monster_id: str,
    request: Request,
    n: int = Query(default=5, ge=1, le=V.TOKEN_MAX_INDEX, description="幾題（互不重複）"),
    route: str = Query(default=W.FIRST_ROUTE, description="plain／hills／ridge／cloud＝難度"),
    seed: str = Query(default="0", max_length=40, description="同一個種子永遠拿到同一套題"),
):
    m = _monster(monster_id)
    if monster_id not in V.GENERATORS:
        raise HTTPException(status_code=404, detail="這隻怪還沒有題目產生器（目前只有數學八隻）。")
    _route(route)
    secret = _variant_secret(request)
    items = [
        schemas.VariantOut(
            index=i,
            variant_key=v["variant_key"],
            monster_id=v["monster_id"],
            difficulty=v["difficulty"],
            level=v["level"],
            cross_chapter=v["cross_chapter"],
            stem=v["stem"],
            options=v["options"],
            answer_token=V.sign_token(secret, monster_id, route, seed, i),
        )
        for i, v in enumerate(_bank(monster_id, n, route, seed))
    ]
    return schemas.VariantListOut(monster_id=monster_id, name=m["name"], route=route, seed=seed, n=len(items), items=items)


@router.post("/world/monsters/{monster_id}/variants/check", response_model=schemas.VariantCheckOut)
def check_variant(monster_id: str, body: schemas.VariantCheckIn, request: Request):
    _monster(monster_id)
    try:
        tok = V.parse_token(_variant_secret(request), body.answer_token)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None
    if tok["monster_id"] != monster_id:
        raise HTTPException(status_code=422, detail="這個 answer_token 不是這隻怪的題。")
    v = _bank(monster_id, tok["index"] + 1, tok["route"], tok["seed"])[tok["index"]]
    r = V.judge(v, body.choice)
    return schemas.VariantCheckOut(monster_id=monster_id, variant_key=v["variant_key"], **r)


@router.get("/world/monsters/{monster_id}/bank-status", response_model=schemas.BankStatusOut)
def bank_status(
    monster_id: str,
    size: int = Query(default=6, ge=1, le=6, description="隊伍人數；門檻＝人數 × 6 ＋ 4"),
    seed: str = Query(default="0", max_length=40),
):
    m = _monster(monster_id)
    if monster_id not in V.GENERATORS:
        raise HTTPException(status_code=404, detail="這隻怪還沒有題目產生器（目前只有數學八隻）。")
    return schemas.BankStatusOut(name=m["name"], **V.bank_status(monster_id, size, seed))
