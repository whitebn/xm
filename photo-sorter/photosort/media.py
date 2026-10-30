"""Scan a folder and read the metadata the sorter needs."""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from PIL import ExifTags, Image

try:  # optional: lets Pillow open iPhone HEIC files
    import pillow_heif

    pillow_heif.register_heif_opener()
except ImportError:
    pass

PHOTO_EXT = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp", ".tif", ".tiff", ".gif"}
VIDEO_EXT = {".mp4", ".mov", ".m4v", ".avi", ".mkv"}

_DATE_IN_NAME = re.compile(r"(?<!\d)((?:19|20)\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])(?!\d)")
_SCREENSHOT_NAME = re.compile(r"screen\s?shot|screen[-_ ]?capture", re.I)


@dataclass
class Media:
    path: Path
    kind: str  # photo | screenshot | video
    sha: str
    taken_at: datetime | None = None
    taken_source: str = "none"  # exif | filename | mtime | none
    lat: float | None = None
    lon: float | None = None
    camera: str = ""

    @property
    def reliable_date(self) -> bool:
        return self.taken_source in ("exif", "filename")


def file_sha(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _dms_to_deg(dms, ref) -> float | None:
    try:
        d, m, s = (float(x) for x in dms)
    except (TypeError, ValueError):
        return None
    deg = d + m / 60 + s / 3600
    return -deg if ref in ("S", "W") else deg


def read_exif(path: Path) -> dict:
    """Return {taken_at, lat, lon, camera} from EXIF. Missing values are None/''."""
    out = {"taken_at": None, "lat": None, "lon": None, "camera": ""}
    try:
        with Image.open(path) as img:
            exif = img.getexif()
            if not exif:
                return out
            sub = exif.get_ifd(ExifTags.IFD.Exif)
            raw = sub.get(ExifTags.Base.DateTimeOriginal) or sub.get(ExifTags.Base.DateTimeDigitized) or exif.get(ExifTags.Base.DateTime)
            if raw:
                try:
                    out["taken_at"] = datetime.strptime(str(raw).strip()[:19], "%Y:%m:%d %H:%M:%S")
                except ValueError:
                    pass
            gps = exif.get_ifd(ExifTags.IFD.GPSInfo)
            if gps:
                lat = _dms_to_deg(gps.get(ExifTags.GPS.GPSLatitude), gps.get(ExifTags.GPS.GPSLatitudeRef))
                lon = _dms_to_deg(gps.get(ExifTags.GPS.GPSLongitude), gps.get(ExifTags.GPS.GPSLongitudeRef))
                if lat is not None and lon is not None and (lat, lon) != (0.0, 0.0):
                    out["lat"], out["lon"] = lat, lon
            out["camera"] = " ".join(str(exif.get(t, "")).strip() for t in (ExifTags.Base.Make, ExifTags.Base.Model)).strip()
    except Exception:
        pass  # unreadable or exotic file: fall back to filename/mtime
    return out


def date_from_name(name: str) -> datetime | None:
    m = _DATE_IN_NAME.search(name)
    if not m:
        return None
    try:
        return datetime(int(m[1]), int(m[2]), int(m[3]))
    except ValueError:
        return None


def inspect(path: Path) -> Media | None:
    ext = path.suffix.lower()
    if ext in VIDEO_EXT:
        kind, info = "video", {"taken_at": None, "lat": None, "lon": None, "camera": ""}
    elif ext in PHOTO_EXT:
        info = read_exif(path)
        is_shot = bool(_SCREENSHOT_NAME.search(path.name)) or (ext == ".png" and not info["camera"])
        kind = "screenshot" if is_shot else "photo"
    else:
        return None
    m = Media(path=path, kind=kind, sha=file_sha(path), lat=info["lat"], lon=info["lon"], camera=info["camera"])
    if info["taken_at"]:
        m.taken_at, m.taken_source = info["taken_at"], "exif"
    elif (d := date_from_name(path.name)):
        m.taken_at, m.taken_source = d, "filename"
    else:
        m.taken_at, m.taken_source = datetime.fromtimestamp(path.stat().st_mtime), "mtime"
    return m


def scan(root: Path, skip: Path | None = None) -> list[Media]:
    found: list[Media] = []
    skip = skip.resolve() if skip else None
    for p in sorted(root.rglob("*")):
        if not p.is_file() or any(part.startswith(".") for part in p.relative_to(root).parts):
            continue
        if skip and skip in p.resolve().parents:
            continue
        if (m := inspect(p)):
            found.append(m)
    return found
