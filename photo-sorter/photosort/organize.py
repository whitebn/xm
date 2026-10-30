"""Plan, apply and undo the folder layout. Nothing moves unless apply() is called."""
from __future__ import annotations

import json
import re
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from .media import Media, file_sha
from .trips import Trip


@dataclass
class Action:
    src: Path
    dst: Path
    mode: str  # copy | move
    media: Media
    trip: str = ""
    reason: str = ""


def slug(text: str, max_len: int = 40) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:max_len].rstrip("-")


def _unique(dst: Path, taken: set[Path]) -> Path:
    cand, n = dst, 1
    while cand in taken or cand.exists():
        cand = dst.with_name(f"{dst.stem}-{n}{dst.suffix}")
        n += 1
    taken.add(cand)
    return cand


def _filename(m: Media, caption: str | None, rename: bool) -> str:
    if not rename:
        return m.path.name
    stamp = m.taken_at.strftime("%Y-%m-%d_%H%M%S") if m.taken_at else "undated"
    tail = slug(caption) if caption else slug(m.path.stem)
    return f"{stamp}_{tail}{m.path.suffix.lower()}" if tail else f"{stamp}{m.path.suffix.lower()}"


def plan(
    items: list[Media],
    trips: list[Trip],
    dest: Path,
    captions: dict[str, str] | None = None,
    mode: str = "copy",
    rename: bool = False,
) -> list[Action]:
    captions = captions or {}
    trip_of = {id(m): t for t in trips for m in t.items}
    taken: set[Path] = set()
    seen_sha: set[str] = set()
    actions: list[Action] = []
    for m in sorted(items, key=lambda x: (x.taken_at or datetime.max, str(x.path))):
        trip = trip_of.get(id(m))
        if m.sha in seen_sha:
            folder, reason = dest / "Duplicates", "exact duplicate"
        elif m.kind == "screenshot":
            y = f"{m.taken_at:%Y}" if m.taken_at else "Unknown date"
            folder, reason = dest / "Screenshots" / y, "screenshot"
        elif trip is not None:
            folder, reason = dest / "Trips" / trip.folder, "trip"
        else:
            top = "Videos" if m.kind == "video" else "Photos"
            if m.taken_at:
                folder = dest / top / f"{m.taken_at:%Y}" / f"{m.taken_at:%Y-%m}"
            else:
                folder = dest / top / "Unknown date"
            reason = f"date from {m.taken_source}"
        seen_sha.add(m.sha)
        dst = _unique(folder / _filename(m, captions.get(m.sha), rename), taken)
        actions.append(Action(m.path, dst, mode, m, trip.folder if trip else "", reason))
    return actions


def apply(actions: list[Action], dest: Path) -> Path:
    log = []
    for a in actions:
        a.dst.parent.mkdir(parents=True, exist_ok=True)
        if a.mode == "move":
            shutil.move(str(a.src), str(a.dst))
        else:
            shutil.copy2(a.src, a.dst)
        log.append({"src": str(a.src), "dst": str(a.dst), "mode": a.mode, "sha": a.media.sha})
    mdir = dest / ".photosort"
    mdir.mkdir(parents=True, exist_ok=True)
    manifest = mdir / f"manifest-{datetime.now():%Y%m%d-%H%M%S}.json"
    manifest.write_text(json.dumps(log, indent=1))
    return manifest


def undo(manifest: Path) -> tuple[int, list[str]]:
    """Reverse a run. Moves go back; copies are deleted only if their content is unchanged."""
    done, problems = 0, []
    for e in reversed(json.loads(manifest.read_text())):
        dst, src = Path(e["dst"]), Path(e["src"])
        if not dst.exists():
            problems.append(f"missing: {dst}")
        elif e["mode"] == "move":
            if src.exists():
                problems.append(f"original location occupied, left in place: {dst}")
                continue
            src.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(dst), str(src))
            done += 1
        elif file_sha(dst) != e["sha"]:
            problems.append(f"changed since copy, not deleted: {dst}")
        else:
            dst.unlink()
            done += 1
    return done, problems
