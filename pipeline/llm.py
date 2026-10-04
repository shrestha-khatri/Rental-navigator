import os, re, json, time, threading, pathlib
from . import config, audit

_CACHE = config.OUT / "llm_cache"
_lock = threading.Lock()
_last = [0.0]
MIN_INTERVAL = float(os.getenv("MIN_INTERVAL", "0"))   # seconds between calls (e.g. 13 for a 5 requests/min limit)

_override = None
def set_llm(fn):
    """Inject a fake LLM (system, prompt) -> str, used by tests."""
    global _override
    _override = fn

def _strip(t: str) -> str:
    t = t.strip()
    return re.sub(r"^```(?:json)?\s*|\s*```$", "", t)

def _call(system: str, prompt: str) -> str:
    if config.LLM_PROVIDER == "openai":
        from openai import OpenAI
        r = OpenAI().chat.completions.create(
            model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"), temperature=0,
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}])
        return r.choices[0].message.content
    if config.LLM_PROVIDER == "anthropic":
        import anthropic
        c = anthropic.Anthropic()
        r = c.messages.create(model=config.ANTHROPIC_MODEL, max_tokens=8000, temperature=0,
                              system=system, messages=[{"role": "user", "content": prompt}])
        return "".join(b.text for b in r.content if getattr(b, "type", "") == "text")
    from google import genai
    c = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    r = c.models.generate_content(model=config.GEMINI_MODEL, contents=prompt, config={
        "system_instruction": system, "response_mime_type": "application/json", "temperature": 0})
    return r.text

def _wait_turn():
    if MIN_INTERVAL <= 0: return
    with _lock:
        d = _last[0] + MIN_INTERVAL - time.time()
        if d > 0: time.sleep(d)
        _last[0] = time.time()

def complete_json(system: str, prompt: str, retries: int = 8) -> dict:
    last = None
    key = None
    if not _override:
        key = audit.sha(config.LLM_PROVIDER + (os.environ.get("OPENAI_MODEL","") if config.LLM_PROVIDER == "openai" else config.GEMINI_MODEL if config.LLM_PROVIDER != "anthropic" else config.ANTHROPIC_MODEL) + system + prompt)
        f = _CACHE / f"{key}.json"
        if f.exists():
            try: return json.loads(f.read_text(encoding="utf-8"))
            except Exception: pass
    for attempt in range(retries):
        try:
            _wait_turn()
            raw = _override(system, prompt) if _override else _call(system, prompt)
            audit.log("llm_call", provider=config.LLM_PROVIDER, prompt_sha=audit.sha(prompt),
                      response_sha=audit.sha(raw), response_preview=raw[:300])
            out = json.loads(_strip(raw))
            print("  LLM call ok", flush=True)
            if key:
                _CACHE.mkdir(parents=True, exist_ok=True)
                (_CACHE / f"{key}.json").write_text(json.dumps(out), encoding="utf-8")
            return out
        except Exception as e:  # noqa
            last = e
            audit.log("llm_error", error=str(e)[:500], attempt=attempt)
            if not _override:
                m = re.search(r"retry in ([\d.]+)s", str(e), re.I)
                if "insufficient_quota" in str(e) or "invalid_api_key" in str(e) or "Incorrect API key" in str(e):
                    raise RuntimeError("Fatal API error (check key/billing): " + str(e)[:300])
                if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                    if "PerDay" in str(e) or "per_day" in str(e).lower():
                        raise RuntimeError("Daily quota exhausted: " + str(e)[:200])
                    time.sleep(min(90, float(m.group(1)) + 2 if m else 30))
                else:
                    time.sleep(min(30, 2 ** attempt))
    raise RuntimeError(f"LLM failed after {retries} attempts: {last}")