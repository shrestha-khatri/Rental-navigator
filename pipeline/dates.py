import re, datetime as dt
_P = re.compile(r"^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$")

def valid(s):
    """Schema pattern: YYYY, YYYY-MM or YYYY-MM-DD."""
    return bool(s) and bool(_P.match(str(s))) and parse(s) is not None

def parse(s):
    """Partial dates resolve to the first day of the period."""
    m = _P.match(str(s or "").strip())
    if not m: return None
    try: return dt.date(int(m[1]), int(m[2] or 1), int(m[3] or 1))
    except ValueError: return None
