"""Group media into trips: runs of activity far from home.

Method, so you can judge whether to trust it:
  1. Home = the 0.5 degree grid cell with the most distinct photo days.
  2. An item is "away" if its GPS is more than trip_km from home.
  3. Away items within gap_hours of each other form one trip.
  4. Items without GPS (or near home) join a trip if their time falls inside its window.
It needs GPS in the photos. Without GPS there are no trips, only year/month folders.
"""
from __future__ import annotations

import math
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from statistics import median

from .media import Media


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371.0 * 2 * math.asin(math.sqrt(h))


@dataclass
class Trip:
    start: datetime
    end: datetime
    items: list[Media] = field(default_factory=list)
    centroid: tuple[float, float] | None = None
    name: str = ""
    name_source: str = "none"  # geocoder | none

    @property
    def folder(self) -> str:
        label = self.name or "Trip"
        return f"{self.start:%Y-%m} {label}"


def find_home(items: list[Media], min_days: int = 3) -> tuple[float, float] | None:
    days: dict[tuple[int, int], set] = defaultdict(set)
    pts: dict[tuple[int, int], list] = defaultdict(list)
    for m in items:
        if m.lat is None or not m.reliable_date:
            continue
        cell = (math.floor(m.lat / 0.5), math.floor(m.lon / 0.5))
        days[cell].add(m.taken_at.date())
        pts[cell].append((m.lat, m.lon))
    if not days:
        return None
    best = max(days, key=lambda c: len(days[c]))
    if len(days[best]) < min_days:
        return None
    return median(p[0] for p in pts[best]), median(p[1] for p in pts[best])


def build_trips(
    items: list[Media],
    home: tuple[float, float] | None,
    trip_km: float = 80.0,
    gap_hours: float = 48.0,
    min_items: int = 5,
) -> list[Trip]:
    if home is None:
        return []
    away = sorted(
        (m for m in items if m.lat is not None and m.reliable_date and haversine_km(home, (m.lat, m.lon)) > trip_km),
        key=lambda m: m.taken_at,
    )
    groups: list[list[Media]] = []
    for m in away:
        if groups and m.taken_at - groups[-1][-1].taken_at <= timedelta(hours=gap_hours):
            groups[-1].append(m)
        else:
            groups.append([m])
    trips = []
    for g in groups:
        if len(g) < min_items:
            continue
        t = Trip(start=g[0].taken_at, end=g[-1].taken_at)
        t.centroid = (median(m.lat for m in g), median(m.lon for m in g))
        trips.append(t)
    # Attach everything else (non-GPS photos, videos) by time window. A day's slack
    # covers photos taken after the last geotagged shot.
    for m in items:
        if not m.reliable_date and m.kind != "video":
            continue
        for t in trips:
            if t.start.replace(hour=0, minute=0, second=0) <= m.taken_at <= t.end + timedelta(hours=12):
                t.items.append(m)
                break
    return [t for t in trips if t.items]


def name_trips(trips: list[Trip], geocode=None) -> None:
    """Name each trip after its most common nearby town. `geocode` maps [(lat, lon)] -> [{'name', 'cc'}]."""
    if geocode is None:
        geocode = default_geocoder()
    if geocode is None:
        return
    for t in trips:
        pts = [(m.lat, m.lon) for m in t.items if m.lat is not None]
        if not pts:
            continue
        hits = geocode(pts)
        top, _ = Counter((h["name"], h["cc"]) for h in hits).most_common(1)[0]
        t.name, t.name_source = f"{top[0]} {top[1]}", "geocoder"


def apply_overrides(trips: list[Trip], overrides: list[str]) -> None:
    """Apply 'YYYY-MM-DD=Name' overrides to the trip that starts on that date."""
    for o in overrides:
        date, _, name = o.partition("=")
        if not name.strip():
            raise ValueError(f"bad --trip-name {o!r}, expected YYYY-MM-DD=Name")
        hit = [t for t in trips if f"{t.start:%Y-%m-%d}" == date.strip()]
        if not hit:
            raise ValueError(f"no trip starts on {date.strip()}")
        hit[0].name, hit[0].name_source = name.strip(), "you"


def default_geocoder():
    try:
        import reverse_geocoder as rg
    except ImportError:
        return None
    return lambda pts: rg.search(pts, mode=1)
