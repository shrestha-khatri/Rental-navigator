"""Module A: automated rule extraction (LLM) with schema + verbatim-quote validation."""
import csv, json, re, glob, hashlib, difflib, pathlib
from concurrent.futures import ThreadPoolExecutor
from . import config, audit, llm, dates

SYSTEM = """You extract housing-law rules from official legal text (statutes, ordinances, bills, and some government web pages).
Return ONLY JSON: {"rules":[...]}. Never invent rules, numbers or citations. If the text has no rule in the
allowed categories, return {"rules":[]}. Never give advice on avoiding or structuring around a rule. The text may contain
website navigation noise: ignore it.

Allowed categories: @@CATS@@

Granularity: ONE record per distinct legal rule (a statute section / ordinance chapter / bill) per category. Do NOT split one
section into many sub-rules and do NOT output procedural details. Prefer the headline requirement.

Each rule object has EXACTLY these keys:
category, jurisdiction_level ("state" or "city"), jurisdiction_name (state name, or city name), state (2-letter), title,
requirement (what the law requires/limits, one or two plain sentences), key_value (headline number/formula e.g. "1 month's rent",
"5% + CPI, max 10%", or null), summary_plain (plain English a renter can act on), summary_plain_es (same in Spanish),
coverage_conditions_text, conditions, conditions_unparsed (bool), exemptions_text, exemption_conditions,
effective_date (ISO yyyy-mm-dd; yyyy-mm or yyyy only if that is all the text gives; null if not stated),
expiration_date (ISO or null),
status ("enacted" = law in force OR signed with a future effective date; "pending" = bill/proposal not yet enacted;
        "failed" = struck, vetoed, withdrawn, or removed from the ballot),
penalty (text or null), citation (official cite, e.g. "Cal. Civ. Code § 1947.12", "N.J.S.A. 46:8-21.2", "S.F. Admin. Code § 37.10C"),
quoted_span, local_supersedes_state (true ONLY if this city rule governs where it applies and the state rule yields to it),
preempts_local ("yes" if text expressly bars/preempts local rules, "possible" if it may, else "no"), preempts_note.

quoted_span: copy VERBATIM one contiguous passage (20-350 chars) from the text that supports the rule. Never paraphrase it.
conditions / exemption_conditions: lists of {"field","op","value","note","proxy"} using ONLY fields
year_built, units, owner_type, use_code and ops lt,lte,gt,gte,eq,ne,in,not_in.
  "built before 1995" -> {"field":"year_built","op":"lt","value":1995}
  "certificate of occupancy on or before 6/13/1979" -> {"field":"year_built","op":"lte","value":1979,"proxy":true}
     (set proxy:true whenever the cutoff is a certificate-of-occupancy / first-occupancy date, because the data has only year built)
  "buildings with 5 or more units" -> {"field":"units","op":"gte","value":5}
  small-landlord / owner-occupied exemptions -> exemption_conditions on owner_type (the data has no owner info)
exemption_conditions are OR-ed (any true exempts); conditions are AND-ed. If a condition cannot be expressed with those
fields, describe it in coverage_conditions_text and set conditions_unparsed true. Never guess missing facts.
Dates: report dates exactly as the text states; if sources conflict, use the official source and mention it in preempts_note.
""".replace("@@CATS@@", ", ".join(config.CATEGORIES))

_MAP = {"\u2019": "'", "\u2018": "'", "\u201c": '"', "\u201d": '"', "\u2013": "-", "\u2014": "-", "\u00a0": " "}

def _normalize(s: str):
    chars, idx, prev_sp = [], [], False
    for i, ch in enumerate(s):
        ch = _MAP.get(ch, ch)
        if ch.isspace():
            if prev_sp: continue
            ch, prev_sp = " ", True
        else:
            prev_sp = False
        lc = ch.lower()
        chars.append(lc if len(lc) == 1 else ch); idx.append(i)
    return "".join(chars).strip(), idx

def locate(text: str, quote: str):
    """Return the EXACT original substring of `text` matching `quote` (whitespace/quote-insensitive), else None."""
    if not quote or len(quote.strip()) < 20: return None
    norm, idx = _normalize(text)
    q, _ = _normalize(quote)
    if not q: return None
    p = norm.find(q)
    if p < 0: return None
    return text[idx[p]: idx[p + len(q) - 1] + 1]

def fuzzy_quote(text: str, quote: str, threshold=0.88):
    best, score = None, 0.0
    qn = _normalize(quote)[0]
    for seg in re.split(r"(?<=[.;])\s+|\n{1,}", text):
        if len(seg) < 25: continue
        r = difflib.SequenceMatcher(None, _normalize(seg)[0], qn).ratio()
        if r > score: best, score = seg, r
    return best[:350] if best and score >= threshold else None

def chunk(text: str, size=14000, overlap=600):
    if len(text) <= size: return [text]
    out, i = [], 0
    while i < len(text):
        j = min(len(text), i + size)
        if j < len(text):
            k = text.rfind("\n", i + size // 2, j)
            j = k if k > 0 else j
        out.append(text[i:j])
        if j >= len(text): break
        i = max(j - overlap, i + 1)
    return out

def _slug(s): return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")
def _cnorm(s): return re.sub(r"[^a-z0-9]", "", (s or "").lower())

def validate_and_fix(r: dict, text: str, doc: dict):
    """Returns (record|None, reason). Enforces enums and a verbatim quote."""
    if r.get("category") not in config.CATEGORIES: return None, "bad_category"
    lvl = str(r.get("jurisdiction_level", "")).lower()
    if lvl not in config.LEVELS: return None, "bad_level"
    status = str(r.get("status", "")).lower()
    if status not in config.STATUSES: return None, "bad_status"
    if not (r.get("citation") or "").strip(): return None, "no_citation"
    q = locate(text, r.get("quoted_span", ""))
    method = "exact"
    if q is None:
        q = fuzzy_quote(text, r.get("quoted_span", ""))
        method = "fuzzy"
    if q is None or len(q.strip()) < 20: return None, "quote_not_in_source"
    def conds(lst):
        out = []
        for c in (lst or []):
            if isinstance(c, dict) and c.get("field"):
                if "certificate" in str(c.get("note", "")).lower(): c["proxy"] = True
                out.append(c)
        return out
    rec = dict(r)
    rec.update(jurisdiction_level=lvl, status=status, quoted_span=q, quote_verified=True, quote_match=method,
               effective_date=r.get("effective_date") if dates.valid(r.get("effective_date")) else None,
               expiration_date=r.get("expiration_date") if dates.valid(r.get("expiration_date")) else None,
               conditions=conds(r.get("conditions")), exemption_conditions=conds(r.get("exemption_conditions")),
               source_doc_id=doc["doc_id"], source_url=doc.get("url"), retrieval_date=doc.get("retrieved"))
    rec["state"] = (rec.get("state") or "").upper()[:2]
    rec["rule_id"] = "tmp-" + hashlib.sha1(f'{rec["state"]}{rec.get("jurisdiction_name")}{rec["category"]}{rec["citation"]}{rec.get("requirement","")[:60]}'.encode()).hexdigest()[:8]
    return rec, method

def extract_document(doc: dict, text: str):
    rules, rejected = [], []
    for n, part in enumerate(chunk(text)):
        prompt = (f"Document id: {doc['doc_id']}\nSource URL: {doc.get('url')}\nRetrieved: {doc.get('retrieved')}\n"
                  f"Jurisdiction hint: {doc.get('hint') or 'unknown'}\nChunk {n + 1}\n--- TEXT ---\n{part}")
        try:
            data = llm.complete_json(SYSTEM, prompt)
        except Exception as e:
            audit.log("extract_failed", doc=doc["doc_id"], chunk=n, error=str(e)); continue
        for r in data.get("rules", []):
            rec, why = validate_and_fix(r, text, doc)
            if rec: rules.append(rec)
            else: rejected.append({"doc": doc["doc_id"], "reason": why, "citation": r.get("citation")})
    audit.log("extract_doc", doc=doc["doc_id"], kept=len(rules), rejected=rejected)
    return rules

def dedupe(rules):
    """Collapse repeats from overlapping chunks / multiple docs: same jurisdiction + category + citation."""
    best = {}
    for r in rules:
        k = (r["state"], r["jurisdiction_level"], _slug(r.get("jurisdiction_name")), r["category"], _cnorm(r["citation"]), r["status"])
        cur = best.get(k)
        score = (bool(r.get("effective_date")), r.get("source_url", "") and "official" or "", len(r["quoted_span"]))
        if cur is None or score > cur[0]: best[k] = (score, r)
    return [v[1] for v in best.values()]

def link_rules(rules):
    """Fill overrides / interaction / conflict flags between state and city rules of the same category."""
    for r in rules:
        r["overrides"], r["interaction"], r["conflict_flag"], r["conflict_note"] = [], None, False, None
    groups = {}
    for r in rules: groups.setdefault((r["state"], r["category"]), []).append(r)
    for grp in groups.values():
        states = [x for x in grp if x["jurisdiction_level"] == "state" and x["status"] == "enacted"]
        locs = [x for x in grp if x["jurisdiction_level"] == "city" and x["status"] == "enacted"]
        for l in locs:
            if l.get("local_supersedes_state") and states:
                l["overrides"] = [s["rule_id"] for s in states]
                l["interaction"] = "This city rule governs where it applies; the state rule yields to it (state rule is 'superseded')."
        for s in states:
            pre = s.get("preempts_local")
            if pre == "yes" and locs:
                s["overrides"] = [l["rule_id"] for l in locs]
                s["interaction"] = "State law preempts the listed city rules."
            elif pre == "possible" and locs:
                s["conflict_flag"] = True
                s["conflict_note"] = ("May preempt city rules: " + ", ".join(l["citation"] for l in locs) + ". " + (s.get("preempts_note") or "")).strip()
                s["interaction"] = "Possible preemption of city rules; needs human review."
                for l in locs:
                    l["conflict_flag"] = True
                    l["conflict_note"] = f'May be preempted by {s["citation"]}. Needs human review.'
    return rules

def official_status(r, as_of=None):
    as_of = dates.parse(as_of or config.DEFAULT_AS_OF)
    if r["status"] in ("pending", "failed"): return r["status"]
    eff = dates.parse(r.get("effective_date"))
    return "not_yet_effective" if eff and eff > as_of else "in_force"

def to_official(r: dict) -> dict:
    jur = r["state"] if r["jurisdiction_level"] == "state" else f'{r.get("jurisdiction_name")}, {r["state"]}'
    conf = 0.9 if r.get("quote_match") == "exact" else 0.75
    if r.get("conditions_unparsed"): conf -= 0.1
    return {"team_rule_id": r["rule_id"], "jurisdiction": jur, "level": r["jurisdiction_level"], "category": r["category"],
            "status": official_status(r), "title": r.get("title") or r["citation"], "requirement": r.get("requirement") or "",
            "key_value": r.get("key_value"), "coverage_conditions": r.get("coverage_conditions_text"),
            "exemptions": r.get("exemptions_text"), "overrides": r.get("overrides", []), "interaction": r.get("interaction"),
            "effective_date": r.get("effective_date"), "citation": r["citation"], "source_doc_id": r["source_doc_id"],
            "source_url": r.get("source_url") or "", "quoted_span": r["quoted_span"], "confidence": round(conf, 2),
            "conflict_flag": r.get("conflict_flag", False), "conflict_note": r.get("conflict_note")}

def validate_schema(official):
    try:
        import jsonschema
    except ImportError:
        return ["jsonschema not installed"]
    schema = json.load(open(config.SCHEMA)); errs = []
    v = jsonschema.Draft202012Validator(schema)
    for r in official:
        for e in v.iter_errors(r): errs.append(f'{r.get("team_rule_id")}: {e.message}')
    return errs

def _pick(row, names):
    for n in names:
        for k in row:
            if k and k.strip().lower() == n and row[k] and str(row[k]).strip(): return str(row[k]).strip()
    return None

def load_corpus(manifest=None, corpus_dir=None):
    manifest, corpus_dir = manifest or config.MANIFEST, corpus_dir or config.CORPUS_DIR
    docs = []
    if manifest.exists():
        for row in csv.DictReader(open(manifest, encoding="utf-8-sig")):
            fn = _pick(row, ["text_file", "file", "filename", "path"])
            path = (corpus_dir / fn) if fn and (corpus_dir / fn).exists() else None
            if not path:
                audit.log("skipped_no_text", doc=_pick(row, ["doc_id"]), status=_pick(row, ["status"])); continue
            docs.append({"doc_id": _pick(row, ["doc_id", "id"]) or path.stem, "path": path, "url": _pick(row, ["url", "source_url"]),
                         "retrieved": (_pick(row, ["retrieved_at", "retrieved", "retrieval_date"]) or "")[:10] or None,
                         "hint": _pick(row, ["jurisdictions", "jurisdiction"])})
    else:
        for p in sorted(glob.glob(str(corpus_dir / "**" / "*.txt"), recursive=True)):
            docs.append({"doc_id": pathlib.Path(p).stem, "path": pathlib.Path(p), "url": None, "retrieved": None, "hint": None})
    return docs

def finalize(rules):
    """Dedupe, number as r-0001.., link overrides/conflicts."""
    rules = dedupe(rules)
    rules.sort(key=lambda r: (r["state"], r["jurisdiction_level"] != "state", r.get("jurisdiction_name") or "", r["category"], r["citation"]))
    for i, r in enumerate(rules, 1): r["rule_id"] = f"r-{i:04d}"
    return link_rules(rules)

def run_extraction():
    docs = load_corpus()
    print(f"Extracting from {len(docs)} documents with text…")
    def work(d): return extract_document(d, d["path"].read_text(encoding="utf-8", errors="ignore"))
    with ThreadPoolExecutor(config.WORKERS) as ex:
        rules = [r for part in ex.map(work, docs) for r in part]
    rules = finalize(rules)
    config.OUT.mkdir(parents=True, exist_ok=True)
    official = [to_official(r) for r in rules]
    errs = validate_schema(official)
    if errs: audit.log("schema_errors", errors=errs[:50]); print(f"WARNING {len(errs)} schema errors (see audit log)")
    with open(config.OUT / "rules.json", "w", encoding="utf-8") as f: json.dump({"rules": official}, f, indent=2, ensure_ascii=False)
    with open(config.OUT / "rules_internal.json", "w", encoding="utf-8") as f: json.dump(rules, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(rules)} rules ({len(errs)} schema errors)")
    return rules
