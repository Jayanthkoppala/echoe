#!/usr/bin/env python3
"""Normalizes raw Overpass output (pubs/bars/breweries/cafes) into
src/data/spots.json. Run after scripts/fetch-osm-spots.sh.

Usage:
  python3 scripts/normalize-osm-spots.py <raw-osm-json> <out-spots-json>
"""
import json
import re
import sys
from urllib.parse import urlparse

FEATURED_NAMES = [
    "toit", "arbor brewing", "byg brewski", "windmills craftworks",
    "the biere club", "brahma brewing", "geist", "prost", "bob's bar",
    "pecos", "koramangala social", "church street social", "third wave coffee",
    "blue tokai", "matteo", "dyu art cafe", "hard rock cafe", "big brewsky",
    "ironhill", "xoox", "communiti", "loft 38", "skyye", "13th floor",
    "arbor", "the permit room", "fenny's", "watson's", "sly granny",
]
# Cafe Coffee Day is excluded: "only if a flagship" isn't answerable from OSM tags.
FEATURED_CAP = 40


def brand_key(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().lower())


def qualifies(tags: dict) -> bool:
    """Overpass matched brewery=* on presence alone, which also caught
    brewery=no on plain restaurants. Re-check the real condition here."""
    amenity = tags.get("amenity", "")
    return (
        amenity in ("pub", "bar", "biergarten", "cafe")
        or tags.get("craft") == "brewery"
        or tags.get("microbrewery") == "yes"
        or tags.get("brewery", "no") not in ("no", "")
    )


def category_of(tags: dict, name: str) -> str:
    if (
        tags.get("craft") == "brewery"
        or tags.get("microbrewery") == "yes"
        or tags.get("brewery", "no") not in ("no", "")
        or "brew" in name.lower()
    ):
        return "brewery"
    amenity = tags.get("amenity", "")
    if amenity == "pub":
        return "pub"
    if amenity in ("bar", "biergarten"):
        return "bar"
    return "cafe"


def domain_of(tags: dict) -> str:
    raw = tags.get("website") or tags.get("contact:website") or tags.get("url") or ""
    if not raw:
        return ""
    if not re.match(r"^https?://", raw):
        raw = "http://" + raw
    host = (urlparse(raw).netloc or "").lower()
    host = re.sub(r"^www\.", "", host)
    host = host.split(":")[0]
    return host


def is_featured(name: str) -> bool:
    low = name.lower()
    return any(f in low for f in FEATURED_NAMES)


def main():
    raw_path, out_path = sys.argv[1], sys.argv[2]
    with open(raw_path) as f:
        elements = json.load(f)["elements"]

    spots = {}
    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name", "").strip()
        if not name or not qualifies(tags):
            continue
        if el["type"] == "node":
            lat, lng = el.get("lat"), el.get("lon")
        else:
            center = el.get("center") or {}
            lat, lng = center.get("lat"), center.get("lon")
        if lat is None or lng is None:
            continue
        lat, lng = round(lat, 5), round(lng, 5)

        category = category_of(tags, name)
        # Bengaluru's OSM cafe layer is heavily saturated with bare stub nodes
        # (name + amenity, nothing else) from mapathons. Require some real
        # detail so "cafe" means a mappable spot, not a two-tag guess. Pubs,
        # bars and breweries are the primary category and stay unfiltered.
        if category == "cafe" and len(tags) < 4:
            continue

        dedupe_key = (name.lower(), round(lat, 4), round(lng, 4))
        if dedupe_key in spots:
            continue

        domain = domain_of(tags)
        spots[dedupe_key] = {
            "name": name,
            "kind": "spot",
            "category": category,
            "hq_area": tags.get("addr:suburb") or tags.get("addr:neighbourhood") or "",
            "lat": lat,
            "lng": lng,
            "domain": domain,
            "logo": f"https://www.google.com/s2/favicons?domain={domain}&sz=128" if domain else "",
            "featured": is_featured(name),
            "source": "osm",
            "osm_id": f"{el['type']}/{el['id']}",
            "_tag_count": len(tags),
        }

    # Cap chain outlets at 3 per brand, keeping the ones with the most tags.
    by_brand = {}
    for s in spots.values():
        by_brand.setdefault(brand_key(s["name"]), []).append(s)

    kept = []
    for group in by_brand.values():
        group.sort(key=lambda s: s["_tag_count"], reverse=True)
        kept.extend(group[:3])

    featured_count = sum(1 for s in kept if s["featured"])
    if featured_count > FEATURED_CAP:
        # Keep the first FEATURED_CAP by name order, demote the rest.
        featured_sorted = sorted([s for s in kept if s["featured"]], key=lambda s: s["name"])
        for s in featured_sorted[FEATURED_CAP:]:
            s["featured"] = False

    def rank(s):
        group = 0 if s["featured"] else (1 if s["category"] in ("pub", "brewery", "bar") else 2)
        return (group, s["name"].lower())

    kept.sort(key=rank)

    for s in kept:
        del s["_tag_count"]

    with open(out_path, "w") as f:
        json.dump(kept, f, indent=2)
        f.write("\n")

    by_cat = {}
    for s in kept:
        by_cat[s["category"]] = by_cat.get(s["category"], 0) + 1
    print(f"total: {len(kept)}", file=sys.stderr)
    for cat, n in sorted(by_cat.items()):
        print(f"  {cat}: {n}", file=sys.stderr)
    print(f"featured: {sum(1 for s in kept if s['featured'])}", file=sys.stderr)


if __name__ == "__main__":
    main()
