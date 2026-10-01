"""題目變體引擎（0.3）：八隻數學怪的參數化產生器、規則版三檢查、題庫去重與門檻、answer_token。
前半是純規則（不開伺服器），後半是 API 流程。數字全部鎖住：門檻＝人數 × 6 ＋ 4、四條路線難度係數遞增、trap 一定是那隻怪的錯法。"""

import base64

import pytest
from app.services import content as C
from app.services import variants as V

MONSTERS = ["sq-cross", "sign-dist", "sqrt-split", "sqrt-abs", "pyth-hyp", "factor-diff", "factor-cross", "quad-zero"]
COEF_DRIVEN = ["sq-cross", "sign-dist", "sqrt-abs", "factor-diff", "factor-cross", "quad-zero"]  # 難度靠係數放大的怪


def _avg_magnitude(monster_id, route):
    b = V.bank(monster_id, V.threshold(6), route)
    return sum(v["params"]["magnitude"] for v in b) / len(b)


# ——— 產生器 ———
def test_eight_math_monsters_have_generators_and_solvers():
    assert list(V.GENERATORS) == MONSTERS == list(V.MONSTERS)
    assert set(V.SOLVERS) == set(MONSTERS)
    assert set(MONSTERS) <= set(C.monsters()) and set(MONSTERS) == set(C.skills())  # id 沿用 content.json 的卡點 id


@pytest.mark.parametrize("route", V.ROUTES)
@pytest.mark.parametrize("monster_id", MONSTERS)
def test_generate_is_deterministic_for_fixed_seed(monster_id, route):
    a = V.generate(monster_id, 7, route)
    assert a == V.generate(monster_id, 7, route)
    assert a["monster_id"] == monster_id and a["difficulty"] == route and a["trap_kind"] == V.TRAP_KINDS[monster_id]
    assert len(a["options"]) == 4 and a["options"][a["answer"]] and a["trap"] != a["answer"]
    assert a["variant_key"].startswith(f"{monster_id}:{route}:") and a["steps"] and a["why"]
    # 同一隻怪同一路線，十個種子至少換出五題不一樣的
    assert len({V.generate(monster_id, s, route)["variant_key"] for s in range(10)}) >= 5


def test_generate_rejects_unknown_monster_or_route():
    with pytest.raises(ValueError):
        V.generate("tense-ghost", 1)
    with pytest.raises(ValueError):
        V.generate("sq-cross", 1, "silver")


def test_stems_use_plain_text_math():
    for m in MONSTERS:
        for v in V.bank(m, 10, "plain"):
            text = v["stem"] + " ".join(v["options"])
            assert "\\" not in text and "^" not in text and "$" not in text  # 不用 LaTeX


# ——— 門檻與題庫 ———
def test_threshold_is_size_times_six_plus_four():
    assert (V.THRESHOLD_PER_MEMBER, V.THRESHOLD_BASE) == (6, 4)
    assert V.threshold(6) == 40 and V.threshold(5) == 34 and V.threshold(4) == 28


@pytest.mark.parametrize("route", V.ROUTES)
@pytest.mark.parametrize("monster_id", MONSTERS)
def test_bank_forty_unique_variants_all_pass_check(monster_id, route):
    b = V.bank(monster_id, V.threshold(6), route)
    assert len(b) == 40
    assert len({v["variant_key"] for v in b}) == 40 and len({v["stem"] for v in b}) == 40
    for v in b:
        assert V.check(v) == {"ok": True, "checks": ["unique_answer", "distinct_options", "solvable"]}
        assert v["difficulty"] == route and len(set(v["options"])) == 4
    assert V.ready(monster_id, 6, route) is True


def test_bank_item_i_does_not_depend_on_n():
    assert V.bank("sq-cross", 3, "hills", "s1")[2]["variant_key"] == V.bank("sq-cross", 10, "hills", "s1")[2]["variant_key"]
    assert V.bank("sq-cross", 3, "hills", "s1") == V.bank("sq-cross", 3, "hills", "s1")
    with pytest.raises(ValueError):
        V.bank("sq-cross", 0)


def test_bank_status_per_route():
    st = V.bank_status("quad-zero", 6)
    assert st["threshold"] == 40 and st["ready"] is True and list(st["routes"]) == ["plain", "hills", "ridge", "cloud"]
    assert all(r == {"count": 40, "threshold": 40, "ready": True} for r in st["routes"].values())


# ——— 三檢查 ———
def test_check_rejects_bad_variants():
    v = V.generate("sq-cross", 1)
    assert V.check(v)["ok"] is True
    with pytest.raises(ValueError):
        V.check({**v, "answer": v["trap"]})  # trap 與答案同一個
    with pytest.raises(ValueError):
        V.check({**v, "answer": 4})  # 不在選項裡
    dup = list(v["options"])
    dup[(v["answer"] + 1) % 4] = v["options"][v["answer"]]
    with pytest.raises(ValueError):
        V.check({**v, "options": dup})  # 答案不唯一
    i, j = [k for k in range(4) if k not in (v["answer"], v["trap"])]
    dup2 = list(v["options"])
    dup2[i] = dup2[j]
    with pytest.raises(ValueError):
        V.check({**v, "options": dup2})  # 干擾項重複
    with pytest.raises(ValueError):
        V.check({**v, "params": {**v["params"], "b": v["params"]["b"] + 1}})  # 重算的答案對不上
    with pytest.raises(ValueError):
        V.check({**v, "steps": ["沒有結論"]})  # 最後一步沒得出答案
    with pytest.raises(ValueError):
        V.check({k: x for k, x in v.items() if k != "stem"})
    with pytest.raises(ValueError):
        V.check({**v, "params": {}})


# ——— trap 的錯法 ———
def test_trap_kinds_table():
    assert V.TRAP_KINDS == {
        "sq-cross": "missing_middle",
        "sign-dist": "first_term_only",
        "sqrt-split": "split_root",
        "sqrt-abs": "plus_minus",
        "pyth-hyp": "wrong_hypotenuse",
        "factor-diff": "both_minus",
        "factor-cross": "sign_swapped",
        "quad-zero": "dropped_zero",
    }


def _each(monster_id):
    for route in V.ROUTES:
        for v in V.bank(monster_id, 12, route):
            yield route, v, v["params"], v["options"][v["answer"]], v["options"][v["trap"]]


def test_trap_sq_cross_drops_middle_term():
    for _, _, p, answer, trap in _each("sq-cross"):
        a, b = p["a"], p["b"]
        if p["var2"]:
            expect = V._poly({(2, 0): a * a, (0, 2): b * b}, (p["var"], p["var2"]))
        else:
            expect = V._poly({(2,): a * a, (0,): b * b}, (p["var"],))
        assert trap == expect and trap != answer


def test_trap_sign_dist_only_flips_first_term():
    for _, _, p, answer, trap in _each("sign-dist"):
        a, b = V._u(*p["a"]), V._u(*p["b"])
        first = max(b, key=lambda k: k[0])
        expect = V._padd(V._psub(a, {first: b[first]}), {k: c for k, c in b.items() if k != first})
        assert trap == V._poly(expect) and answer == V._poly(V._psub(a, b))


def test_trap_sqrt_split_takes_each_root_separately():
    for _, _, p, _answer, trap in _each("sqrt-split"):
        assert trap == V._num(sum(s * r for s, r in zip(p["signs"], p["roots"])))


def test_trap_sqrt_abs_is_plus_minus():
    for _, _, _, answer, trap in _each("sqrt-abs"):
        assert trap == "±" + answer.lstrip("−") and not answer.startswith("±")


def test_trap_pyth_uses_wrong_hypotenuse():
    for route, _, p, _answer, trap in _each("pyth-hyp"):
        simplify = route in ("ridge", "cloud")
        a, b = p["legs"]
        if p["form"] == "leg":
            assert trap == V._sqrt_str(p["hyp"] ** 2 + a * a, simplify)  # 把斜邊當股拿去加
        else:
            assert trap == V._sqrt_str(abs(b * b - a * a), simplify)  # 把長的股當斜邊


def test_trap_factor_diff_writes_both_minus():
    for _, _, p, answer, trap in _each("factor-diff"):
        second = "(" + answer.split(")(")[1]  # 答案的第二個因式（減的那個）
        assert trap == second + "²"  # 兩個括號都拿減的那個
        if p["form"] != "shift":
            assert "−" in second


def test_trap_factor_cross_swaps_signs():
    swap = str.maketrans({"+": "−", "−": "+"})
    for _, _, _, answer, trap in _each("factor-cross"):
        assert trap == answer.translate(swap)


def test_trap_quad_zero_drops_a_root():
    for route, _, p, answer, trap in _each("quad-zero"):
        roots = answer.split(" 或 ")
        assert len(roots) == 2 and "或" not in trap and trap == roots[1]
        assert roots[0] == ("x = 0" if route != "cloud" else f"x = {V._num(-p['c'])}")


# ——— 四條路線難度遞增 ———
def test_four_routes_increase_difficulty():
    assert V.DIFFICULTY_LEVEL == {"plain": 1, "hills": 2, "ridge": 3, "cloud": 4}
    assert V.DIFFICULTY_FACTOR == {"plain": 1.0, "hills": 1.5, "ridge": 2.0, "cloud": 2.5}
    assert [V._top(10, r) for r in V.ROUTES] == [10, 15, 20, 25]
    for m in COEF_DRIVEN:
        avg = [_avg_magnitude(m, r) for r in V.ROUTES]
        assert avg == sorted(avg) and avg[0] < avg[-1], (m, avg)
    for m in MONSTERS:
        assert [V.generate(m, 1, r)["level"] for r in V.ROUTES] == [1, 2, 3, 4]
        assert all(v["cross_chapter"] for v in V.bank(m, 5, "cloud"))
        assert not any(v["cross_chapter"] for v in V.bank(m, 5, "plain"))


# ——— answer_token 與判題 ———
def test_answer_token_roundtrip_without_answer_and_rejects_tamper():
    tok = V.sign_token("secret", "sq-cross", "hills", "s1", 3)
    assert V.parse_token("secret", tok) == {"monster_id": "sq-cross", "route": "hills", "seed": "s1", "index": 3}
    body = tok.split(".")[0]
    payload = base64.urlsafe_b64decode(body + "=" * (-len(body) % 4))
    assert b'"i":3' in payload and b"answer" not in payload and b"trap" not in payload
    with pytest.raises(ValueError):
        V.parse_token("other", tok)
    with pytest.raises(ValueError):
        V.parse_token("secret", tok[:-1] + ("0" if tok[-1] != "0" else "1"))
    with pytest.raises(ValueError):
        V.parse_token("secret", "nodot")
    with pytest.raises(ValueError):
        V.parse_token("secret", V.sign_token("secret", "sq-cross", "hills", "s1", V.TOKEN_MAX_INDEX + 1))


def test_judge_reports_correct_and_trap():
    v = V.generate("quad-zero", 2)
    ok = V.judge(v, v["answer"])
    assert ok["correct"] is True and ok["hit_trap"] is False and ok["answer"] == v["answer"] and ok["steps"] == v["steps"]
    hit = V.judge(v, v["trap"])
    assert hit["correct"] is False and hit["hit_trap"] is True and hit["trap_kind"] == "dropped_zero" and hit["trap_label"] == "弄丟 x = 0"
    other = next(i for i in range(4) if i not in (v["answer"], v["trap"]))
    miss = V.judge(v, other)
    assert miss["correct"] is False and miss["hit_trap"] is False
    with pytest.raises(ValueError):
        V.judge(v, 4)


# ——— API 流程 ———
def test_api_variants_hide_answer_and_check_by_token(client):
    url = "/api/v1/world/monsters/sign-dist/variants"
    params = {"n": 40, "route": "ridge", "seed": "demo"}
    r = client.get(url, params=params)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["n"] == 40 and body["name"] == "負號幽靈" and body["route"] == "ridge" and body["seed"] == "demo"
    items = body["items"]
    assert len({i["variant_key"] for i in items}) == 40
    for it in items:
        assert set(it) == {"index", "variant_key", "monster_id", "difficulty", "level", "cross_chapter", "stem", "options", "answer_token"}
        assert len(it["options"]) == 4 and it["difficulty"] == "ridge" and it["level"] == 3
    # 同一個種子永遠同一套題、同一批 token
    again = client.get(url, params=params).json()["items"]
    assert [i["variant_key"] for i in again] == [i["variant_key"] for i in items]
    assert [i["answer_token"] for i in again] == [i["answer_token"] for i in items]
    # 判題：用純函式算出來的答案和 trap 對 API 來回
    it = items[5]
    v = V.bank("sign-dist", 6, "ridge", "demo")[5]
    assert v["variant_key"] == it["variant_key"] and v["options"] == it["options"]
    check = "/api/v1/world/monsters/sign-dist/variants/check"
    ok = client.post(check, json={"answer_token": it["answer_token"], "choice": v["answer"]})
    assert ok.status_code == 200, ok.text
    assert ok.json()["correct"] is True and ok.json()["hit_trap"] is False and ok.json()["answer"] == v["answer"]
    assert ok.json()["steps"] == v["steps"] and ok.json()["why"] == v["why"] and ok.json()["variant_key"] == v["variant_key"]
    hit = client.post(check, json={"answer_token": it["answer_token"], "choice": v["trap"]}).json()
    assert hit["correct"] is False and hit["hit_trap"] is True and hit["trap_kind"] == "first_term_only" and hit["trap_label"] == "負號只給第一項"
    # 竄改的 token 422、別隻怪的 token 422、選項超出 422
    bad = it["answer_token"][:-2] + ("zz" if not it["answer_token"].endswith("zz") else "00")
    assert client.post(check, json={"answer_token": bad, "choice": 0}).status_code == 422
    assert client.post("/api/v1/world/monsters/sq-cross/variants/check", json={"answer_token": it["answer_token"], "choice": 0}).status_code == 422
    assert client.post(check, json={"answer_token": it["answer_token"], "choice": 4}).status_code == 422
    # 沒有這隻怪 404；非數學怪（提案中的怪）還沒有產生器 404；路線錯 422；n 超過 422
    proposal = next(m["id"] for m in C.world()["monsters"] if m["status"] == "proposal")
    assert client.get("/api/v1/world/monsters/nope/variants").status_code == 404
    assert client.get(f"/api/v1/world/monsters/{proposal}/variants").status_code == 404
    assert client.get("/api/v1/world/monsters/sq-cross/variants", params={"route": "silver"}).status_code == 422
    assert client.get("/api/v1/world/monsters/sq-cross/variants", params={"n": 0}).status_code == 422
    # 預設五題平原線
    d = client.get("/api/v1/world/monsters/sq-cross/variants").json()
    assert d["n"] == 5 and d["route"] == "plain" and all(i["level"] == 1 for i in d["items"])


def test_api_bank_status_threshold(client):
    r = client.get("/api/v1/world/monsters/sqrt-split/bank-status", params={"size": 6})
    assert r.status_code == 200, r.text
    st = r.json()
    assert st["name"] == "拆根蟲" and st["threshold"] == 40 and st["ready"] is True
    assert set(st["routes"]) == {"plain", "hills", "ridge", "cloud"}
    assert all(x["count"] == 40 and x["ready"] is True for x in st["routes"].values())
    assert client.get("/api/v1/world/monsters/sqrt-split/bank-status", params={"size": 4}).json()["threshold"] == 28
    assert client.get("/api/v1/world/monsters/sqrt-split/bank-status", params={"size": 7}).status_code == 422
    assert client.get("/api/v1/world/monsters/nope/bank-status").status_code == 404
