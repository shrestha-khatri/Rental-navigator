"""All paths / formats you may need to adapt to the starter pack live here."""
import os, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
STARTER = pathlib.Path(os.getenv("STARTER_DIR", ROOT / "starter"))

CORPUS_DIR = pathlib.Path(os.getenv("CORPUS_DIR", STARTER / "corpus"))
MANIFEST = pathlib.Path(os.getenv("MANIFEST", CORPUS_DIR / "corpus_manifest.csv"))
ADDRESSES = pathlib.Path(os.getenv("ADDRESSES", STARTER / "data" / "sample_addresses.csv"))
SCHEMA = pathlib.Path(os.getenv("RULE_SCHEMA", STARTER / "schema" / "rule_record.schema.json"))
CHANGE_CASES = pathlib.Path(os.getenv("CHANGE_CASES", STARTER / "dev" / "change_tests.json"))
PLACES_DIR = pathlib.Path(os.getenv("PLACES_DIR", STARTER / "tiger_places"))  # tl_*_place.zip files
OUT = pathlib.Path(os.getenv("OUT_DIR", ROOT / "pipeline" / "output"))
WEB_DATA = pathlib.Path(os.getenv("WEB_DATA_DIR", ROOT / "data"))  # read by the Next.js API route

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini")          # gemini | anthropic
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5")
WORKERS = int(os.getenv("WORKERS", "4"))
DEFAULT_AS_OF = os.getenv("AS_OF", "2026-10-01")
EXTRA_AS_OF = ["2025-12-31", "2026-01-02", "2026-10-01", "2027-07-02"]  # dates precomputed for the web UI

CATEGORIES = [
    "rent_increase_limits", "just_cause_eviction", "security_deposits",
    "application_screening_fees", "screening_restrictions", "algorithmic_rent_setting",
]
STATUSES = {"enacted", "pending", "failed"}
LEVELS = {"state", "city"}   # the official schema has no county level
DISCLAIMER = "Legal information, not legal advice. Verify with the source text or a qualified professional."
