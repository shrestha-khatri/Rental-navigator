"""Module C: change tracking -> changes.json = {test_id: {affected_address_ids, conflict_flag_address_ids, notes}}."""
import json, datetime as dt
from . import config, audit, dates
from .coverage import coverage, result_for, in_jurisdiction
from .resolve import norm_name

ALG = "algorithmic_rent_setting"
# Our rule ids differ from the answer key's (CA-ALG-01 ...), so tests select rules by meaning, not id.
TESTS = [
    {"id": "T1", "mode": "as_of", "name": "California AB 325 / SB 763", "dates": ["2025-12-31", "2026-01-02"],
     "select": {"state": "CA", "level": "state", "category": ALG, "exclude_status": ["failed", "pending"]}},
    {"id": "T2", "mode": "boundary", "name": "Hoboken vs Jersey City local algorithmic bans", "dates": [config.DEFAULT_AS_OF],
     "select": {"state": "NJ", "level": "city", "category": ALG, "jurisdiction_any": ["hoboken", "jersey city"]},
     "must_exclude_cities": ["Newark"]},
    {"id": "T3", "mode": "as_of", "name": "NJ FAIR Act (enacted 2026-07-20, effective 2027-07-01)", "dates": [config.DEFAULT_AS_OF, "2027-07-02"],
     "select": {"state": "NJ", "level": "state", "category": ALG, "exclude_status": ["failed", "pending"]},
     "conflict_with": {"state": "NJ", "level": "city", "category": ALG, "jurisdiction_any": ["hoboken", "jersey city"]}},
    {"id": "T4", "mode": "pending", "name": "Massachusetts pending bills S.2983 / H.5222", "dates": [config.DEFAULT_AS_OF],
     "select": {"state": "MA", "category": ALG, "status": ["pending"]}},
    {"id": "T5", "mode": "negative", "name": "Massachusetts rent-control ballot question (struck)", "dates": [config.DEFAULT_AS_OF],
     "select": {"state": "MA", "category": "rent_increase_limits", "status": ["failed", "pending"]},
     "scope_cities": ["Boston", "Cambridge"]},
]

def _load_dev_dates():
    """Use the dates from dev/change_tests.json when present."""
    out = {}
    if config.CHANGE_CASES.exists():
        for t in json.load(open(config.CHANGE_CASES)):
            if t.get("as_of_before"): out[t["test_id"]] = [t["as_of_before"], t["as_of_after"]]
            elif t.get("as_of"): out[t["test_id"]] = [t["as_of"]]
    return out

def select_rules(rules, sel):
    out = []
    for r in rules:
        if sel.get("state") and r["state"] != sel["state"]: continue
        if sel.get("level") and r["jurisdiction_level"] != sel["level"]: continue
        if sel.get("category") and r["category"] != sel["category"]: continue
        if sel.get("status") and r["status"] not in sel["status"]: continue
        if sel.get("exclude_status") and r["status"] in sel["exclude_status"]: continue
        if sel.get("jurisdiction_any") and not any(k in (r.get("jurisdiction_name") or "").lower() for k in sel["jurisdiction_any"]): continue
        if sel.get("rule_ids") and r["rule_id"] not in sel["rule_ids"]: continue
        out.append(r)
    return out

def _facts(a): return {k: a.get(k) for k in ("year_built", "units", "use_code", "owner_type")}

def run_test(test, rules, addrs, locs):
    sel = select_rules(rules, test["select"])
    det = {"name": test["name"], "mode": test["mode"], "dates": test["dates"],
           "selected_rules": [{"rule_id": r["rule_id"], "citation": r["citation"], "status": r["status"], "effective_date": r.get("effective_date")} for r in sel],
           "confirmed": [], "possible": [], "per_address": {}}
    notes = []
    if not sel: notes.append("WARNING: no matching rule was extracted; check extraction output for this test.")
    confirmed, possible = set(), set()
    for a in addrs:
        stack = locs[a["address_id"]]["stack"]
        for r in sel:
            if test["mode"] == "pending":
                if in_jurisdiction(r, stack): confirmed.add(a["address_id"]); det["per_address"][a["address_id"]] = {"result": "pending"}
                continue
            if test["mode"] == "negative": continue
            cov, _, _ = coverage(r, _facts(a), stack)
            results = [result_for(r, cov, d) for d in test["dates"]]
            before, after = results[0], results[-1]
            in_after = after in ("applies", "unknown")
            if test["mode"] == "as_of": changed = in_after and before not in ("applies", "unknown")
            else: changed = in_after                                   # boundary
            if changed:
                (confirmed if after == "applies" else possible).add(a["address_id"])
                det["per_address"][a["address_id"]] = {"before": before, "after": after, "rule": r["rule_id"]}
    affected = sorted(confirmed | possible)
    conflict_ids = []
    if test.get("conflict_with"):
        loc_rules = select_rules(rules, test["conflict_with"])
        loc_rules = [x for x in loc_rules if x["status"] != "failed"]
        conflict_ids = sorted(a["address_id"] for a in addrs
                              if any(in_jurisdiction(x, locs[a["address_id"]]["stack"]) for x in loc_rules))
        notes.append(f"{len(conflict_ids)} address(es) also covered by a local ordinance that the state law may preempt (needs human review).")
    if test["mode"] == "boundary":
        leaks = [a["address_id"] for a in addrs if a["address_id"] in set(affected) and locs[a["address_id"]].get("city") in test.get("must_exclude_cities", [])]
        det["scope_leaks"] = leaks
        notes.append("Each ban applies only inside its own city limits; none in Newark." if not leaks else f"WARNING scope leak: {leaks[:5]}")
    if test["mode"] == "pending":
        notes.append("Pending bills are NOT law. Affected = every address in the bill's jurisdiction if it were enacted (coverage conditions not applied because bill text may change).")
    if test["mode"] == "negative":
        affected = []
        cities = {c.lower() for c in test.get("scope_cities", [])}
        viol = [a["address_id"] for a in addrs if (locs[a["address_id"]].get("city") or "").lower() in cities and any(
            r["category"] == "rent_increase_limits" and r["status"] == "enacted" and in_jurisdiction(r, locs[a["address_id"]]["stack"])
            and r["state"] == "MA" for r in rules)]
        det["rent_cap_violations"] = viol
        notes.append("Ballot question struck before the vote; it never became law. No rent cap is reported for Boston or Cambridge." +
                     (f" WARNING: an enacted MA rent rule was extracted for {len(viol)} addresses - review." if viol else ""))
    if test["mode"] == "as_of" and possible:
        notes.append(f"{len(possible)} address(es) are included as possibly affected because coverage depends on facts not in the data.")
    det["confirmed"], det["possible"] = sorted(confirmed), sorted(possible)
    out = {"affected_address_ids": affected, "notes": " ".join(notes) or test["name"]}
    if test.get("conflict_with") or test["id"] == "T3": out["conflict_flag_address_ids"] = conflict_ids
    audit.log("change_test", test=test["id"], affected=len(affected), conflict=len(conflict_ids))
    return out, det

def hour16_test(new_rules):
    eff = next((r["effective_date"] for r in new_rules if r.get("effective_date")), None)
    d = dates.parse(eff)
    pts = [config.DEFAULT_AS_OF] + ([(d + dt.timedelta(days=1)).isoformat()] if d else [])
    return {"id": "T6", "mode": "as_of", "name": "Hour-16 ordinance (extracted live)", "dates": pts,
            "select": {"rule_ids": [r["rule_id"] for r in new_rules]}}

def run_changes(rules, addrs, locs, new_rules=None):
    devd = _load_dev_dates()
    tests = [dict(t, dates=devd.get(t["id"], t["dates"])) for t in TESTS]
    allr = list(rules)
    if new_rules:
        ids = {x["rule_id"] for x in rules}
        allr += [r for r in new_rules if r["rule_id"] not in ids]
        tests.append(hour16_test(new_rules))
    official, detail = {}, {}
    for t in tests:
        official[t["id"]], detail[t["id"]] = run_test(t, allr, addrs, locs)
    config.OUT.mkdir(parents=True, exist_ok=True)
    with open(config.OUT / "changes.json", "w", encoding="utf-8") as f: json.dump(official, f, indent=2, ensure_ascii=False)
    with open(config.OUT / "changes_detail.json", "w", encoding="utf-8") as f: json.dump(detail, f, indent=1, ensure_ascii=False)
    return official
