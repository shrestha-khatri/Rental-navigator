"""Module B (part 2): deterministic coverage + status logic. Missing facts => unknown, never a guess."""
from . import dates
from .resolve import norm_name, norm_state

def _cond(c, facts):
    v = facts.get(c["field"])
    if v is None: return None
    t, op = c.get("value"), c.get("op", "eq")
    if c.get("proxy") and isinstance(v, (int, float)) and isinstance(t, (int, float)) and v == t:
        return None            # certificate-of-occupancy cutoff year: year built cannot decide -> unknown
    try:
        if op == "lt": return v < t
        if op == "lte": return v <= t
        if op == "gt": return v > t
        if op == "gte": return v >= t
        if op == "eq": return str(v).lower() == str(t).lower()
        if op == "ne": return str(v).lower() != str(t).lower()
        if op == "in": return str(v).lower() in [str(x).lower() for x in t]
        if op == "not_in": return str(v).lower() not in [str(x).lower() for x in t]
    except TypeError: return None
    return None

def _all(conds, facts):
    vals = [_cond(c, facts) for c in conds]
    if any(v is False for v in vals): return False
    if any(v is None for v in vals): return None
    return True

def _any(conds, facts):
    vals = [_cond(c, facts) for c in conds]
    if any(v is True for v in vals): return True
    if any(v is None for v in vals): return None
    return False

def in_jurisdiction(rule, stack):
    lvl, name = rule["jurisdiction_level"], rule.get("jurisdiction_name")
    for s in stack:
        if s["level"] != lvl: continue
        if lvl == "state":
            if norm_state(s["name"]) == norm_state(name) or norm_state(s["name"]) == norm_state(rule.get("state")): return True
        elif norm_name(s["name"]) == norm_name(name): return True
    return False

def coverage(rule, facts, stack):
    """-> ('yes'|'no'|'unknown', [missing facts], reason)"""
    if not in_jurisdiction(rule, stack): return "no", [], "outside jurisdiction"
    missing = sorted({c["field"] for c in rule.get("conditions", []) + rule.get("exemption_conditions", [])
                      if facts.get(c["field"]) is None})
    cov = _all(rule.get("conditions", []), facts)
    exm = _any(rule.get("exemption_conditions", []), facts) if rule.get("exemption_conditions") else False
    if cov is False: return "no", [], "coverage conditions not met"
    if exm is True: return "no", [], "exemption applies"
    if rule.get("conditions_unparsed"):
        return "unknown", missing, "coverage conditions could not be machine-checked: " + (rule.get("coverage_conditions_text") or "")
    if cov is True and exm is False: return "yes", [], "all coverage conditions met"
    return "unknown", missing, "coverage depends on facts not in the data: " + ", ".join(missing)

def _d(s): return dates.parse(s)

def result_for(rule, cov, as_of: str):
    """Map coverage + dates + status to one of: applies, unknown, not_yet_effective, pending, or None (not in force/covered)."""
    if cov == "no" or rule["status"] == "failed": return None
    a, eff, exp = _d(as_of), _d(rule.get("effective_date")), _d(rule.get("expiration_date"))
    if rule["status"] == "pending": return "pending"
    if exp and a > exp: return None
    if eff and a < eff: return "not_yet_effective"
    return "applies" if cov == "yes" else "unknown"
