#!/usr/bin/env bash
# Fetches Bengaluru office/company nodes and ways from OpenStreetMap via the
# Overpass API and writes src/data/companies-osm.json: a second, much larger
# pin layer to sit alongside the 39 hand-verified src/data/companies.json.
#
# Data source and licence: (c) OpenStreetMap contributors, ODbL
# (https://www.openstreetmap.org/copyright). The attribution already shown on
# the map satisfies the ODbL's attribution requirement; nothing here needs a
# separate credit line. Google's favicon endpoint is only ever linked to, not
# stored or redistributed.
#
# Overpass usage policy (https://overpass-api.de): one request at a time, a
# named User-Agent, timeout 180s. This script issues exactly one request per
# run (two only if the office-tag query comes back thin; see WIDEN below).
#
# Usage:
#   scripts/fetch-osm-companies.sh
set -euo pipefail

CURL=/usr/bin/curl
PYTHON3=python3
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/src/data/companies-osm.json"

# Raw Overpass response is scratch data, not vault/repo content: kept outside
# the repo entirely so there is nothing to gitignore and nothing to commit.
SCRATCH="/tmp/echoe-osm"
RAW="$SCRATCH/raw.json"
mkdir -p "$SCRATCH"

UA="EchoeMapBot/1.0 (+https://github.com/jaylabs/echo; Bengaluru startup map, contact via repo)"
SOUTH=12.83 WEST=77.45 NORTH=13.13 EAST=77.78
BBOX="$SOUTH,$WEST,$NORTH,$EAST"

# office values we treat as an actual company/startup office. estate_agent is
# deliberately excluded (real-estate brokers, not the companies on the map).
OFFICE_TAGS="company|it|software|coworking|startup|financial|consulting|research|telecommunication"

build_query() {
  local tags="$1"
  cat <<EOF
[out:json][timeout:180];
(
  node["office"~"^($tags)\$"]["name"]($BBOX);
  way["office"~"^($tags)\$"]["name"]($BBOX);
  node["brand"]["office"]["name"]($BBOX);
  way["brand"]["office"]["name"]($BBOX);
);
out center;
EOF
}

fetch() {
  local tags="$1" dest="$2"
  build_query "$tags" > "$SCRATCH/query.txt"
  "$CURL" -sS --max-time 190 -A "$UA" \
    --data-urlencode "data@$SCRATCH/query.txt" \
    "https://overpass-api.de/api/interpreter" \
    -o "$dest"
}

echo "querying Overpass for Bengaluru office nodes/ways..." >&2
fetch "$OFFICE_TAGS" "$RAW"

named_count=$("$PYTHON3" -c "import json; print(len(json.load(open('$RAW'))['elements']))")
echo "raw elements with a name: $named_count" >&2

# WIDEN: office=yes is a generic catch-all a mapper uses for any office they
# didn't want to classify. Only pull it in if the specific tags above came up
# thin, and say so, since it trades precision for volume.
widened=0
if [ "$named_count" -lt 200 ]; then
  echo "fewer than 200 results, widening to include office=yes..." >&2
  fetch "$OFFICE_TAGS|yes" "$RAW"
  widened=1
  named_count=$("$PYTHON3" -c "import json; print(len(json.load(open('$RAW'))['elements']))")
  echo "raw elements after widening: $named_count" >&2
fi

"$PYTHON3" - "$RAW" "$OUT" "$widened" <<'PYEOF'
import json, re, sys
from urllib.parse import urlparse

raw_path, out_path, widened = sys.argv[1], sys.argv[2], sys.argv[3] == "1"

ALLOWED_OFFICE = {
    "company", "it", "software", "coworking", "startup",
    "financial", "consulting", "research", "telecommunication",
}
# Reached us only via the brand+office=* OR-clause; these read as franchise or
# agent branch offices, not the company's own office.
DROP_CATEGORY = {"insurance", "political_party", "ngo"}

NAME_DROP = re.compile(r"\b(atm|branch)\b", re.I)
GOV_DROP = re.compile(
    r"\b(government|govt|municipal|panchayat|collectorate|tehsil|sarkari|bbmp|ward office|tehsildar)\b",
    re.I,
)
PVT_LTD = re.compile(r"\b(pvt\.?\s*ltd\.?|private\s+limited|\bltd\.?\b|\blimited\b)\b", re.I)
TRAIL_NUM = re.compile(r"[\s\-#]*\d+\s*$")


def domain_from(tags: dict) -> str:
    for key in ("website", "contact:website", "url"):
        raw = (tags.get(key) or "").strip()
        if not raw:
            continue
        if "://" not in raw:
            raw = "http://" + raw
        host = urlparse(raw).netloc.lower().split(":")[0]
        if host.startswith("www."):
            host = host[4:]
        if host:
            return host
    return ""


def brand_key(name: str) -> str:
    return TRAIL_NUM.sub("", PVT_LTD.sub("", name)).strip().lower()


def normalize(elements):
    rows = []
    for e in elements:
        tags = e.get("tags", {})
        name = (tags.get("name") or "").strip()
        if not name:
            continue

        office = tags.get("office", "")
        if office not in ALLOWED_OFFICE and office in DROP_CATEGORY:
            continue

        # Franchise/agent counters (a courier or insurance drop-off shop
        # branded as, but not named after, the parent): keep only if the
        # outlet's own name plausibly is the brand.
        brand = tags.get("brand", "")
        if office not in ALLOWED_OFFICE and brand:
            nl, bl = name.lower(), brand.lower()
            if bl not in nl and nl not in bl:
                continue

        if NAME_DROP.search(name) or GOV_DROP.search(name):
            continue

        domain = domain_from(tags)

        # office=company is OSM's generic catch-all, applied to any small
        # registered business as readily as to a real tech company. A bare
        # name+office node carries no signal either way; require a website or
        # enough other tags to show someone actually surveyed the place.
        if office == "company" and not domain and len(tags) < 6:
            continue

        hq_area = tags.get("addr:suburb") or tags.get("addr:neighbourhood") or tags.get("addr:city") or ""

        if e["type"] == "way":
            center = e.get("center") or {}
            lat, lng = center.get("lat"), center.get("lon")
        else:
            lat, lng = e.get("lat"), e.get("lon")
        if lat is None or lng is None:
            continue

        rows.append({
            "name": name,
            "domain": domain,
            "hq_area": hq_area,
            "lat": round(lat, 5),
            "lng": round(lng, 5),
            "category": office or "yes",
            "logo": f"https://www.google.com/s2/favicons?domain={domain}&sz=128" if domain else "",
            "kind": "startup",
            "source": "osm",
            "osm_id": f"{e['type']}/{e['id']}",
            "_tags": len(tags),
        })
    return rows


def dedupe_by_domain(rows):
    by_domain, rest = {}, []
    for r in rows:
        if not r["domain"]:
            rest.append(r)
            continue
        cur = by_domain.get(r["domain"])
        if cur is None or r["_tags"] > cur["_tags"]:
            by_domain[r["domain"]] = r
    return list(by_domain.values()) + rest


def dedupe_by_name_area(rows):
    # A tagged website is a stronger identity signal than one extra addr
    # field, so prefer the domain-bearing duplicate before tag count.
    by_key = {}
    for r in rows:
        key = (r["name"].strip().lower(), r["hq_area"].strip().lower())
        cur = by_key.get(key)
        if cur is None or (bool(r["domain"]), r["_tags"]) > (bool(cur["domain"]), cur["_tags"]):
            by_key[key] = r
    return list(by_key.values())


def cap_brand_chains(rows, cap=3):
    groups = {}
    for r in rows:
        groups.setdefault(brand_key(r["name"]), []).append(r)
    out, capped = [], 0
    for members in groups.values():
        if len(members) <= cap:
            out.extend(members)
            continue
        members.sort(key=lambda r: (bool(r["domain"]), r["_tags"]), reverse=True)
        out.extend(members[:cap])
        capped += len(members) - cap
    return out, capped


def rank_and_feature(rows, featured_n=30):
    rows.sort(key=lambda r: (r["domain"] == "", -r["_tags"]))
    for i, r in enumerate(rows):
        r["featured"] = i < featured_n and bool(r["domain"])
        del r["_tags"]
    return rows


elements = json.load(open(raw_path))["elements"]
rows = normalize(elements)
rows = dedupe_by_domain(rows)
rows = dedupe_by_name_area(rows)
rows, capped = cap_brand_chains(rows)
rows = rank_and_feature(rows)

tmp_path = out_path + ".tmp"
with open(tmp_path, "w") as f:
    json.dump(rows, f, indent=2, ensure_ascii=False)
    f.write("\n")
import os
os.replace(tmp_path, out_path)

with_domain = sum(1 for r in rows if r["domain"])
featured = sum(1 for r in rows if r["featured"])
print(
    f"wrote {out_path}: {len(rows)} companies, {with_domain} with a domain, "
    f"{featured} featured, {capped} dropped by the brand-chain cap"
    + (" (widened with office=yes)" if widened else ""),
    file=sys.stderr,
)
PYEOF
