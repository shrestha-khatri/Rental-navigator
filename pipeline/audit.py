import json, time, hashlib, threading
from . import config
_lock = threading.Lock()

def sha(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8", "ignore")).hexdigest()[:16]

def log(event: str, **data):
    config.OUT.mkdir(parents=True, exist_ok=True)
    rec = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "event": event, **data}
    with _lock, open(config.OUT / "audit_log.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False, default=str) + "\n")
