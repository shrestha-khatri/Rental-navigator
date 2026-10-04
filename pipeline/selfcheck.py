"""Local sanity checks against the README/dev expectations (the official score.py is not in the participant pack)."""
import json, collections
from . import config, resolve, extract

def main():
    out, fails, notes = config.OUT, [], []
    ok = lambda c, m: (print(("PASS " if c else "FAIL ") + m), (None if c else fails.append(m)))
    rules = json.load(open(out / "rules.json"))["rules"]
    internal = {r["rule_id"]: r for r in json.load(open(out / "rules_internal.json"))}
    ids = {r["team_rule_id"] for r in rules}
    print(f"\n== Module A: {len(rules)} rules")
    errs = extract.validate_schema(rules); ok(not errs, f"all rules valid against rule_record.schema.json ({len(errs)} errors)")
    docs = {d["doc_id"]: d["path"].read_text(encoding="utf-8", errors="ignore") for d in extract.load_corpus()}
    bad = [r["team_rule_id"] for r in rules if r.get("source_doc_id") not in docs or extract.locate(docs[r["source_doc_id"]], r["quoted_span"]) != r["quoted_span"]]
    ok(not bad, f"every quoted_span is an exact substring of its source document ({len(bad)} bad: {bad[:5]})")
    print("   by jurisdiction:", dict(collections.Counter(r["jurisdiction"] for r in rules)))
    print("   by category:", dict(collections.Counter(r["category"] for r in rules)))
    print("   by status:", dict(collections.Counter(r["status"] for r in rules)))
    want = ["CA", "NJ", "MA"] + [f"{c}, {s}" for c, s in [("Los Angeles", "CA"), ("San Francisco", "CA"), ("San Diego", "CA"), ("Berkeley", "CA"),
            ("Santa Ana", "CA"), ("Jersey City", "NJ"), ("Hoboken", "NJ"), ("Newark", "NJ"), ("Boston", "MA"), ("Cambridge", "MA")]]
    have = {r["jurisdiction"] for r in rules}
    print("   jurisdictions with NO rule extracted:", [w for w in want if w not in have] or "none")
    ok(any(r["status"] == "pending" for r in rules), "at least one pending rule extracted (MA bills)")
    ok(any(r["status"] == "failed" for r in rules), "at least one failed rule extracted (MA ballot question)")
    ok(any(r["status"] == "not_yet_effective" for r in rules), "at least one not_yet_effective rule (e.g. NJ FAIR Act)")

    print("\n== Module B")
    addrs = resolve.load_addresses(); locs = json.load(open(out / "resolved.json"))
    lk = json.load(open(out / "lookups.json"))
    ok(set(lk["lookups"]) == {a["address_id"] for a in addrs}, f"lookups cover all {len(addrs)} addresses")
    allres = [(aid, e) for aid, es in lk["lookups"].items() for e in es]
    ok(all(e["team_rule_id"] in ids for _, e in allres), "every lookup refers to an existing team_rule_id")
    ok(all(e["result"] in {"applies", "unknown", "superseded", "not_yet_effective", "pending"} for _, e in allres), "result values valid")
    cnt = collections.Counter(e["result"] for _, e in allres); print("   result counts:", dict(cnt))
    ok(not any(e["result"] == "applies" and internal[e["team_rule_id"]]["status"] in ("pending", "failed") for _, e in allres), "no pending/failed rule ever reported as 'applies'")
    unres = [a for a in locs.values() if a["city_source"] in ("unresolved", "postal_city_fallback")]
    print(f"   addresses whose city came from postal-city fallback / unresolved: {len(unres)}")

    print("\n== Module C")
    ch = json.load(open(out / "changes.json")); city = lambda aid: locs[aid]["city"]; st = lambda aid: locs[aid]["state"]
    A = [a["address_id"] for a in addrs]
    S = lambda k: set(ch.get(k, {}).get("affected_address_ids", []))
    ok(S("T1") == {a for a in A if st(a) == "CA"}, f"T1 = every CA address ({len(S('T1'))})")
    ok(S("T2") == {a for a in A if city(a) in ("Hoboken", "Jersey City")}, f"T2 = Hoboken + Jersey City only ({len(S('T2'))}), none in Newark")
    ok(S("T3") == {a for a in A if st(a) == "NJ"}, f"T3 = every NJ address ({len(S('T3'))})")
    ok(set(ch["T3"].get("conflict_flag_address_ids", [])) == {a for a in A if city(a) in ("Hoboken", "Jersey City")}, "T3 conflict flags = Hoboken + Jersey City addresses")
    ok(S("T4") == {a for a in A if st(a) == "MA"}, f"T4 = every MA address ({len(S('T4'))})")
    ok(S("T5") == set(), "T5 affected set is empty")
    caps = [aid for aid, e in allres if st(aid) == "MA" and e["result"] in ("applies", "unknown") and internal[e["team_rule_id"]]["category"] == "rent_increase_limits"]
    ok(not caps, f"no rent cap reported for any Boston/Cambridge address ({len(caps)} found)")
    print("\nSUMMARY:", "ALL CHECKS PASSED" if not fails else f"{len(fails)} CHECK(S) FAILED")
    return not fails

if __name__ == "__main__":
    main()
