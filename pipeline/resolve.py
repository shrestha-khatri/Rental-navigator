"""Module B (part 1): load addresses, batch-geocode with the Census Geocoder, build jurisdiction stacks."""
import csv, io, json, re, glob
import requests
from . import config, audit

CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/geographies/addressbatch"
STATE_FIPS = {"06": "CA", "34": "NJ", "25": "MA"}
STATE_NAMES = {"CA": "California", "NJ": "New Jersey", "MA": "Massachusetts"}
COUNTY_FIPS = {("CA", "037"): "Los Angeles", ("CA", "075"): "San Francisco", ("CA", "073"): "San Diego",
               ("CA", "001"): "Alameda", ("CA", "059"): "Orange", ("NJ", "017"): "Hudson", ("NJ", "013"): "Essex",
               ("MA", "025"): "Suffolk", ("MA", "017"): "Middlesex"}
CITY_STATE = {"los angeles": "CA", "san francisco": "CA", "san diego": "CA", "berkeley": "CA", "santa ana": "CA",
              "jersey city": "NJ", "hoboken": "NJ", "newark": "NJ", "boston": "MA", "cambridge": "MA"}

# Mailing "cities" that are neighborhoods of an in-scope legal city (used only if geocoding/polygons are unavailable)
ALIAS = {"dorchester": "Boston", "roxbury": "Boston", "east boston": "Boston", "brighton": "Boston", "allston": "Boston",
         "mattapan": "Boston", "jamaica plain": "Boston", "hyde park": "Boston", "south boston": "Boston",
         "charlestown": "Boston", "roslindale": "Boston", "west roxbury": "Boston", "san ysidro": "San Diego",
         "van nuys": "Los Angeles", "north hollywood": "Los Angeles", "sherman oaks": "Los Angeles"}

def _pick(row, names):
    low = {k.strip().lower(): v for k, v in row.items() if k}
    for n in names:
        if n in low and str(low[n]).strip() not in ("", "nan", "None"): return str(low[n]).strip()
    return None

def _num(v):
    try:
        x = float(str(v).replace(",", ""))
        return int(x) if x > 0 else None   # 0 / blank means "not in public data"
    except (TypeError, ValueError): return None

def load_addresses(path=None):
    path = path or config.ADDRESSES
    out = []
    for i, row in enumerate(csv.DictReader(open(path, encoding="utf-8-sig"))):
        city = _pick(row, ["postal_city", "city", "municipality"]) or ""
        st = (_pick(row, ["state", "state_abbr"]) or CITY_STATE.get(city.lower(), "")).upper()[:2]
        out.append({"address_id": _pick(row, ["address_id", "id", "property_id", "parcel_id"]) or f"addr-{i}",
                    "street": _pick(row, ["street_address", "street", "address", "site_address"]) or "",
                    "postal_city": city, "state": st, "zip": (_pick(row, ["zip", "zipcode", "postal_code"]) or "").split(".")[0].zfill(5) if _pick(row, ["zip", "zipcode", "postal_code"]) else "",
                    "year_built": _num(_pick(row, ["year_built", "yearbuilt", "yr_built"])),
                    "units": _num(_pick(row, ["units", "unit_count", "num_units", "total_units"])),
                    "use_code": _pick(row, ["use_code", "usecode", "land_use"]),
                    "owner_type": None})   # owner names are not provided -> always unknown
    return out

def batch_geocode(addrs, chunk=1000):
    res = {}
    for s in range(0, len(addrs), chunk):
        part = addrs[s:s + chunk]
        buf = io.StringIO(); w = csv.writer(buf)
        for a in part: w.writerow([a["address_id"], a["street"], a["postal_city"], a["state"], a["zip"]])
        r = requests.post(CENSUS_URL, files={"addressFile": ("a.csv", buf.getvalue())},
                          data={"benchmark": "Public_AR_Current", "vintage": "Current_Current"}, timeout=300)
        r.raise_for_status()
        for row in csv.reader(io.StringIO(r.text)):
            if len(row) < 12 or not row[2].lower().startswith("match"): continue
            try: lon, lat = [float(x) for x in row[5].split(",")]
            except ValueError: continue
            res[row[0]] = {"lat": lat, "lon": lon, "state_fips": row[8], "county_fips": row[9], "matched": row[4]}
        audit.log("geocode_batch", start=s, size=len(part), matched=len(res))
    return res

def place_from_census_api(lat, lon):
    """Fallback when TIGER shapefiles are not installed: Census 'coordinates' geographies lookup (one request per point)."""
    try:
        r = requests.get("https://geocoding.geo.census.gov/geocoder/geographies/coordinates",
                         params={"x": lon, "y": lat, "benchmark": "Public_AR_Current", "vintage": "Current_Current",
                                 "layers": "Incorporated Places", "format": "json"}, timeout=30)
        pl = r.json()["result"]["geographies"].get("Incorporated Places") or []
        return re.sub(r" (city|town)$", "", pl[0]["BASENAME"]) if pl else None
    except Exception:
        return None

_places = None
def _load_places():
    global _places
    if _places is not None: return _places
    _places = []
    try:
        import shapefile
        from shapely.geometry import shape
        from shapely.strtree import STRtree
    except ImportError:
        return _places
    geoms, names = [], []
    for z in glob.glob(str(config.PLACES_DIR / "*place*.zip")):
        for sr in shapefile.Reader(z).shapeRecords():
            geoms.append(shape(sr.shape.__geo_interface__)); names.append(sr.record.as_dict().get("NAME"))
    if geoms: _places = (STRtree(geoms), geoms, names)
    return _places

def place_of(lat, lon):
    p = _load_places()
    if not p: return None
    from shapely.geometry import Point
    tree, geoms, names = p
    pt = Point(lon, lat)
    for i in tree.query(pt):
        if geoms[i].contains(pt): return names[i]
    return None

def resolve_all(addrs, geocoded=None, use_api=True):
    geocoded = geocoded if geocoded is not None else batch_geocode(addrs)
    out = {}
    for a in addrs:
        g = geocoded.get(a["address_id"])
        state = STATE_FIPS.get(g["state_fips"]) if g else a["state"]
        county = COUNTY_FIPS.get((state, g["county_fips"]), f'FIPS {g["county_fips"]}') if g else None
        city, src = None, "unresolved"
        if g:
            city = place_of(g["lat"], g["lon"])
            src = "census_place_polygon" if city else None
            if not city and use_api:
                city = place_from_census_api(g["lat"], g["lon"]); src = "census_api_place" if city else None
        if not city:
            pc = (a["postal_city"] or "").strip()
            if pc.lower() in ALIAS: city, src = ALIAS[pc.lower()], "neighborhood_alias"
            elif pc: city, src = pc, "postal_city_fallback"
            else: src = "unresolved"
        stack = [{"level": "state", "name": STATE_NAMES.get(state, state)}]
        if county: stack.append({"level": "county", "name": county + " County"})  # shown for context; no county rules in corpus
        if city: stack.append({"level": "city", "name": city})
        out[a["address_id"]] = {"lat": g and g["lat"], "lon": g and g["lon"], "geocoded": bool(g),
                                "state": state, "county": county, "city": city, "city_source": src, "stack": stack}
    return out

_STRIP = re.compile(r"\b(city and county of|city of|town of|county of|county|city)\b")
def norm_name(n): return re.sub(r"\s+", " ", _STRIP.sub("", (n or "").lower().replace(",", " "))).strip()
def norm_state(n):
    n = (n or "").strip()
    return STATE_NAMES.get(n.upper(), n).lower()
