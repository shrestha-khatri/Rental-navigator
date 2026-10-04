"""CLI:  python -m pipeline.run extract|resolve|lookups|changes|all  [--hour16 path/to/ordinance.txt]"""
import argparse, json, pathlib
from . import config, extract, resolve, lookups, changes, audit

def _rules():
    return json.load(open(config.OUT / "rules_internal.json"))

def _addrs_locs(force=False):
    addrs = resolve.load_addresses()
    cache = config.OUT / "resolved.json"
    if cache.exists() and not force: return addrs, json.load(open(cache))
    locs = resolve.resolve_all(addrs)
    config.OUT.mkdir(parents=True, exist_ok=True)
    json.dump(locs, open(cache, "w"))
    return addrs, locs

def main():
    p = argparse.ArgumentParser()
    p.add_argument("step", choices=["extract", "resolve", "lookups", "changes", "all", "hour16", "check"])
    p.add_argument("--hour16", help="path to the hour-16 ordinance text file")
    p.add_argument("--as-of", action="append", help="extra as-of date(s) YYYY-MM-DD")
    a = p.parse_args()
    if a.step in ("extract", "all"): extract.run_extraction()
    if a.step in ("resolve", "all"): _addrs_locs(force=True)
    if a.step in ("lookups", "all"):
        addrs, locs = _addrs_locs()
        dates = sorted(set([config.DEFAULT_AS_OF] + config.EXTRA_AS_OF + (a.as_of or [])))
        lookups.run_lookups(_rules(), addrs, locs, dates)
    new = None
    if a.hour16 or a.step == "hour16":
        path = pathlib.Path(a.hour16)
        doc = {"doc_id": "hour16-" + path.stem, "url": None, "retrieved": None, "hint": None}
        new = extract.extract_document(doc, path.read_text(encoding="utf-8", errors="ignore"))
        new = extract.link_rules(extract.dedupe(new))
        for i, r in enumerate(new, 1): r["rule_id"] = f"r-h16-{i:02d}"
        with open(config.OUT / "rules_hour16.json", "w", encoding="utf-8") as f: json.dump(new, f, indent=2, ensure_ascii=False)
        with open(config.OUT / "rules_hour16_official.json", "w", encoding="utf-8") as f: json.dump({"rules": [extract.to_official(r) for r in new]}, f, indent=2, ensure_ascii=False)
        print(f"Hour-16: extracted {len(new)} rule(s)")
    if a.step in ("changes", "all", "hour16"):
        addrs, locs = _addrs_locs()
        res = changes.run_changes(_rules(), addrs, locs, new)
        for k, v in res.items(): print(k, "| affected:", len(v["affected_address_ids"]), "| conflict flags:", len(v.get("conflict_flag_address_ids", [])))
    if a.step in ("all", "check"):
        from . import selfcheck; selfcheck.main()
    audit.log("run_complete", step=a.step)

if __name__ == "__main__":
    main()
