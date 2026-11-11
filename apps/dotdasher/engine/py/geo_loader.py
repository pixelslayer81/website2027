"""
Static geographic shape loader — drop-in replacement for geo_loader.py that
reads precomputed JSON (scripts/export_geodata.py) instead of the Natural
Earth shapefile, so it runs without geopandas/fiona/shapely (e.g. in Pyodide).

In the browser build this file is shipped AS geo_loader.py, so main.py
imports it unchanged. Rasterization math is copied verbatim from
geo_loader.py to keep masks byte-identical.
"""

import json
import math
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image, ImageDraw

# Search order: Pyodide FS layout, synced-copy layout (public/engine/py/ →
# sibling data/), then the repo layout (backend/ during native testing)
_DATA_DIRS = [
    Path("/engine/data"),
    Path(__file__).resolve().parent.parent / "data",
    Path(__file__).resolve().parent.parent / "frontend" / "public" / "engine" / "data",
]

_world_cache: Optional[dict] = None


def _data_dir() -> Path:
    for d in _DATA_DIRS:
        if (d / "world_shapes.json").exists():
            return d
    raise FileNotFoundError(
        "world_shapes.json not found — run scripts/export_geodata.py first"
    )


def _world() -> dict:
    global _world_cache
    if _world_cache is None:
        _world_cache = json.loads(
            (_data_dir() / "world_shapes.json").read_text(encoding="utf-8")
        )
    return _world_cache


def _entry(shape_id: str) -> Optional[dict]:
    data = _world()
    e = data["entries"].get(shape_id)
    if e is None:
        alias = data["aliases"].get(shape_id)
        if alias:
            e = data["entries"].get(alias)
    return e


def _ring_pairs(flat: list) -> list:
    return [(flat[i], flat[i + 1]) for i in range(0, len(flat), 2)]


def _draw_polys(entry: dict) -> list:
    """Polygons in draw order (continents concatenate members in row order)."""
    if entry["type"] == "continent":
        data = _world()
        polys: list = []
        for sid in entry["members"]:
            polys.extend(data["entries"][sid]["polys"])
        return polys
    return entry["polys"]


def _parts_polys(entry: dict) -> list:
    """Polygons in parts order (index used by '{shape_id}|{i}' part IDs)."""
    if entry["type"] == "continent":
        data = _world()
        polys: list = []
        for sid in entry["members"]:
            m = data["entries"][sid]
            polys.extend(m["polys"][i] for i in m["parts"])
        return polys
    return [entry["polys"][i] for i in entry["parts"]]


# --------------------------------------------------------------------------- #
# Rasterisation — math copied verbatim from geo_loader.py                      #
# --------------------------------------------------------------------------- #

BOUNDS_OVERRIDE: dict[str, tuple] = {
    "usa":         (-125.0, 24.0,  -66.0, 50.0),  # CONUS only
    "canada":      (-141.0, 41.5,  -52.0, 70.0),  # mainland Canada
    "russia_west": (  18.0, 41.0,   67.0, 75.0),  # Kaliningrad → Urals
    "russia_east": (  57.0, 40.0,  180.0, 78.0),  # Urals → Far East
}


def _rasterize(polys: list, bounds: tuple, base_width: int) -> Optional[np.ndarray]:
    minx, miny, maxx, maxy = bounds
    span_x = maxx - minx
    span_y = maxy - miny
    if span_x <= 0 or span_y <= 0:
        return None

    cos_lat = math.cos(math.radians((miny + maxy) / 2.0))
    aspect = span_y / max(span_x * cos_lat, 1e-9)
    base_height = max(1, int(base_width * aspect))

    img = Image.new("L", (base_width, base_height), 0)
    draw = ImageDraw.Draw(img)

    def geo_to_px(lon: float, lat: float):
        px = (lon - minx) / span_x * base_width
        py = (1.0 - (lat - miny) / span_y) * base_height  # flip Y axis
        return px, py

    for poly in polys:
        exterior = [geo_to_px(x, y) for x, y in _ring_pairs(poly["e"])]
        if len(exterior) >= 3:
            draw.polygon(exterior, fill=255)
        for hole_flat in poly["h"]:
            hole = [geo_to_px(x, y) for x, y in _ring_pairs(hole_flat)]
            if len(hole) >= 3:
                draw.polygon(hole, fill=0)

    return np.array(img)


def shape_to_mask(shape_id: str, base_width: int = 2000) -> Optional[np.ndarray]:
    entry = _entry(shape_id)
    if entry is None:
        return None
    if shape_id in BOUNDS_OVERRIDE:
        bounds = BOUNDS_OVERRIDE[shape_id]
    else:
        bounds = tuple(entry["bounds"])
    return _rasterize(_draw_polys(entry), bounds, base_width)


def parts_to_mask(part_ids: list, base_width: int = 2000) -> Optional[np.ndarray]:
    polys = []
    for pid in part_ids:
        if "|" not in pid:
            continue
        shape_id, idx_str = pid.rsplit("|", 1)
        try:
            poly_idx = int(idx_str)
        except ValueError:
            continue
        entry = _entry(shape_id)
        if entry is None:
            continue
        entry_polys = _parts_polys(entry)
        if poly_idx < len(entry_polys):
            polys.append(entry_polys[poly_idx])

    if not polys:
        return None

    # Bounds from exterior rings (holes lie inside → same as shapely .bounds)
    minx = min(min(p["e"][0::2]) for p in polys)
    maxx = max(max(p["e"][0::2]) for p in polys)
    miny = min(min(p["e"][1::2]) for p in polys)
    maxy = max(max(p["e"][1::2]) for p in polys)

    return _rasterize(polys, (minx, miny, maxx, maxy), base_width)


def get_shapes_catalog() -> list:
    return json.loads(
        (_data_dir() / "shapes_catalog.json").read_text(encoding="utf-8")
    )


def get_world_geojson() -> str:
    return (_data_dir() / "world_map.geojson").read_text(encoding="utf-8")
