import json, os, tempfile, unittest
os.environ["OUT_DIR"] = tempfile.mkdtemp(); os.environ["WEB_DATA_DIR"] = tempfile.mkdtemp()
from pipeline import extract, llm, lookups, changes, config
from pipeline.coverage import coverage, result_for

DOC = {"doc_id": "d1", "url": "http://x", "retrieved": "2026-10-01", "hint": "San Francisco"}
TEXT = "SEC. 37.3.  A landlord\u2019s annual rent increase is limited to the allowable amount.\n\nThe ordinance applies to units with a certificate of occupancy on or before June 13, 1979."

def R(cat, lvl, name, st, cit, status="enacted", eff="2020-01-01", cond=None, exm=None, **kw):
    d = dict(rule_id=f"{st}-{name}-{cat}-{cit}".replace(" ", ""), category=cat, jurisdiction_level=lvl, jurisdiction_name=name,
             state=st, citation=cit, status=status, effective_date=eff, conditions=cond or [], exemption_conditions=exm or [],
             quoted_span="x" * 20, requirement="r", summary_plain="s", source_url="u", retrieval_date="2026-10-01")
    d.update(kw); return d

RULES = [
    R("rent_increase_limits", "state", "California", "CA", "Civ. Code 1947.12", cond=[{"field": "year_built", "op": "lt", "value": 2011}]),
    R("rent_increase_limits", "city", "San Francisco", "CA", "SF Admin Code ch.37", cond=[{"field": "year_built", "op": "lte", "value": 1979}], local_supersedes_state=True),
    R("security_deposits", "state", "California", "CA", "Civ. Code 1950.5", exm=[{"field": "owner_type", "op": "eq", "value": "small_landlord"}]),
    R("algorithmic_rent_setting", "state", "California", "CA", "AB 325 / SB 763", eff="2026-01-01"),
    R("algorithmic_rent_setting", "city", "Hoboken", "NJ", "Hoboken ch.158"),
    R("algorithmic_rent_setting", "city", "Jersey City", "NJ", "Jersey City 218-12"),
    R("algorithmic_rent_setting", "state", "New Jersey", "NJ", "NJ FAIR Act P.L.2026 c.43", eff="2027-07-01", preempts_local="possible", preempts_note="may preempt"),
    R("algorithmic_rent_setting", "state", "Massachusetts", "MA", "S.2983", status="pending", eff=None),
    R("rent_increase_limits", "state", "Massachusetts", "MA", "Ballot Q", status="failed", eff=None),
]
def A(i, city, st, yb, u): return {"address_id": i, "street": "1 Main", "postal_city": city, "state": st, "zip": "0", "year_built": yb, "units": u, "use_code": None, "owner_type": None}
def L(city, st, county="X"): return {"geocoded": True, "city_source": "census_place_polygon", "city": city, "state": st, "county": county,
    "stack": [{"level": "state", "name": {"CA": "California", "NJ": "New Jersey", "MA": "Massachusetts"}[st]}, {"level": "county", "name": county + " County"}, {"level": "city", "name": city}]}
ADDRS = [A("sf62", "San Francisco", "CA", 1962, 20), A("sf90", "San Francisco", "CA", 1990, 10), A("sfnone", "San Francisco", "CA", None, 10),
         A("hob", "Hoboken", "NJ", 1950, 10), A("jc", "Jersey City", "NJ", 1960, 8), A("new", "Newark", "NJ", 1960, 8), A("bos", "Boston", "MA", 1900, 6)]
LOCS = {a["address_id"]: L(a["postal_city"], a["state"], "San Francisco" if a["postal_city"] == "San Francisco" else "X") for a in ADDRS}

def look(aid, d):
    a = next(x for x in ADDRS if x["address_id"] == aid)
    return lookups.compute_address(RULES, a, LOCS[aid], d, lookups.build_no_rule_index(RULES))
def res(rec, cat): return {r["rule_id"].split("-")[-1]: r for r in rec["results"] if r["category"] == cat}

class T(unittest.TestCase):
    def test_locate_smart_quotes_and_whitespace(self):
        q = extract.locate(TEXT, "landlord's  annual rent increase is limited")
        self.assertEqual(q, "landlord\u2019s annual rent increase is limited")
        self.assertIn(q, TEXT)
        self.assertIsNone(extract.locate(TEXT, "this sentence is not in the source at all"))

    def test_extraction_rejects_invented_quotes_and_fixes_near_quotes(self):
        good = {"category": "rent_increase_limits", "jurisdiction_level": "city", "jurisdiction_name": "San Francisco", "state": "CA",
                "citation": "SF Admin Code 37.3", "status": "enacted", "effective_date": "1980-01-01", "requirement": "cap",
                "quoted_span": "A landlord's annual rent increase is limited to the allowable amount.", "conditions": [{"field": "year_built", "op": "lte", "value": 1979}]}
        bad = dict(good, citation="Fake 1", quoted_span="Landlords may never raise rent above one dollar per year ever")
        badcat = dict(good, category="parking")
        llm.set_llm(lambda s, p: json.dumps({"rules": [good, bad, badcat]}))
        rules = extract.extract_document(DOC, TEXT)
        self.assertEqual(len(rules), 1)
        self.assertIn(rules[0]["quoted_span"], TEXT)
        self.assertEqual(rules[0]["source_doc_id"], "d1")

    def test_sf_override_and_unknown(self):
        r = res(look("sf62", "2026-10-01"), "rent_increase_limits")
        self.assertEqual(r["SFAdminCodech.37"]["result"] if "SFAdminCodech.37" in r else list(r.values())[1]["result"], "applies")
        vals = {v["level"]: v for v in r.values()}
        self.assertEqual(vals["city"]["result"], "applies")
        self.assertEqual(vals["state"]["result"], "superseded"); self.assertTrue(vals["state"]["superseded_by"])
        r = {v["level"]: v for v in res(look("sf90", "2026-10-01"), "rent_increase_limits").values()}
        self.assertNotIn("city", r); self.assertEqual(r["state"]["result"], "applies")   # built 1990 -> SF ordinance not covering
        r = {v["level"]: v for v in res(look("sfnone", "2026-10-01"), "rent_increase_limits").values()}
        self.assertEqual(r["state"]["result"], "unknown"); self.assertEqual(r["city"]["result"], "unknown")  # no year_built -> never guess

    def test_owner_type_unknown(self):
        r = list(res(look("sf62", "2026-10-01"), "security_deposits").values())[0]
        self.assertEqual(r["result"], "unknown"); self.assertIn("owner_type", r["missing_facts"])

    def test_dates_and_pending(self):
        a = lambda d: list(res(look("sf62", d), "algorithmic_rent_setting").values())[0]["result"]
        self.assertEqual(a("2025-12-31"), "not_yet_effective"); self.assertEqual(a("2026-01-02"), "applies")
        bos = list(res(look("bos", "2026-10-01"), "algorithmic_rent_setting").values())[0]
        self.assertEqual(bos["result"], "pending")
        self.assertEqual(res(look("bos", "2026-10-01"), "rent_increase_limits"), {})   # struck ballot question: no rent cap

    def test_nj_conflict_flag(self):
        rec = look("hob", "2026-10-01")
        self.assertTrue(any(f["type"] == "possible_preemption" for f in rec["conflict_flags"]))

    def test_changes(self):
        out = changes.run_changes(RULES, ADDRS, LOCS)
        self.assertEqual(sorted(out["T1"]["affected_address_ids"]), ["sf62", "sf90", "sfnone"])
        self.assertEqual(sorted(out["T2"]["affected_address_ids"]), ["hob", "jc"])
        self.assertEqual(sorted(out["T3"]["affected_address_ids"]), ["hob", "jc", "new"])
        self.assertEqual(sorted(out["T3"]["conflict_flag_address_ids"]), ["hob", "jc"])
        self.assertEqual(out["T4"]["affected_address_ids"], ["bos"])
        self.assertEqual(out["T5"]["affected_address_ids"], [])

    def test_hour16_future_date(self):
        new = [R("algorithmic_rent_setting", "city", "Cambridge", "MA", "Cambridge Ord X", eff="2027-03-01")]
        out = changes.run_changes(RULES, ADDRS + [A("cam", "Cambridge", "MA", 1950, 9)], {**LOCS, "cam": L("Cambridge", "MA", "Middlesex")}, new)
        self.assertEqual(out["T6"]["affected_address_ids"], ["cam"])

if __name__ == "__main__": unittest.main()
