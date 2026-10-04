# Pipeline (Modules A, B, C) — matches the participant pack formats

The starter pack is already unpacked in `./starter` (corpus, sample_addresses.csv, schema, dev/change_tests.json, templates).

```bash
pip install -r pipeline/requirements.txt
export GEMINI_API_KEY=...             # or: LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=...
# optional but recommended: TIGER place shapefiles (tl_2024_06_place.zip, tl_2024_34_place.zip, tl_2024_25_place.zip)
#   from https://www2.census.gov/geo/tiger/TIGER2024/PLACE/  ->  starter/tiger_places/
python -m pipeline.run extract    # Module A -> output/rules.json            ({"rules":[...]})
python -m pipeline.run resolve    # Census batch geocode + city boundary     -> output/resolved.json
python -m pipeline.run lookups    # Module B -> output/lookups.json          ({"as_of","lookups":{id:[...]}})
python -m pipeline.run changes    # Module C -> output/changes.json          ({"T1":{affected_address_ids,...}})
python -m pipeline.run check      # local sanity checks (schema, quotes, 500 coverage, T1-T5 expectations)
python -m pipeline.run hour16 --hour16 path/to/ordinance.txt   # T6: live extraction + change test
python -m unittest pipeline.tests.test_pipeline                # offline fixture tests
```
Also written: `rules_internal.json` (structured conditions), `lookups_detail.json`, `changes_detail.json`,
`lookups_<date>.json` (official format for other as-of dates), `audit_log.jsonl`.
Copy `output/rules.json`, `lookups.json`, `changes.json` into the submission.

Adding text for a source the pack only links (e.g. Hoboken/Newark on ecode360): fetch the page yourself
where the site's terms allow, save it as `starter/corpus/text/Dxxx.txt` (first lines `SOURCE: url` / `RETRIEVED: ...`)
and put the filename in the `text_file` column of `corpus_manifest.csv`. No code change is needed.

The official score.py and dev answer key are NOT in the participant pack; `run check` covers what can be checked locally.
