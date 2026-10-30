from __future__ import annotations

import argparse
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from pathlib import Path

from . import media, organize, trips as trips_mod
from .index import Index
from .tagger import DEFAULT_MODEL, ClaudeTagger, Tags


def _tag_all(items, index: Index, model: str, workers: int, assume_yes: bool, tagger=None) -> dict[str, Tags]:
    """Tag photos and screenshots. Cached results (by file content hash) are free."""
    results: dict[str, Tags] = {}
    todo: dict[str, Path] = {}
    for m in items:
        if m.kind == "video" or m.sha in results or m.sha in todo:
            continue
        hit = index.cached(m.sha, model)
        if hit:
            results[m.sha] = Tags.from_json(hit)
        else:
            todo[m.sha] = m.path
    print(f"AI tagging: {len(results)} cached, {len(todo)} to send to the Anthropic API ({model}).")
    if not todo:
        return results
    if not assume_yes and input("These images (downscaled to 1024 px) will leave this computer. Continue? [y/N] ").lower() != "y":
        print("Skipped AI tagging.")
        return results
    tagger = tagger or ClaudeTagger(model)

    def work(item):
        sha, path = item
        return sha, tagger.tag(path)

    with ThreadPoolExecutor(max_workers=workers) as pool:
        for i, (sha, tags) in enumerate(pool.map(work, todo.items()), 1):
            if tags:
                results[sha] = tags
                index.cache(sha, model, asdict(tags))
            if i % 25 == 0 or i == len(todo):
                print(f"  tagged {i}/{len(todo)}", end="\r")
    u = tagger.usage
    print(f"\nTagged {u.calls} images. Tokens used: {u.input_tokens:,} in / {u.output_tokens:,} out. Failures: {len(u.failures)}")
    for f in u.failures[:10]:
        print("  -", f)
    return results


def cmd_sort(a) -> int:
    src, dest = Path(a.source).resolve(), Path(a.dest).resolve()
    if not src.is_dir():
        print(f"Not a folder: {src}")
        return 2
    items = media.scan(src, skip=dest)
    if not items:
        print("No photos or videos found.")
        return 1
    index = Index(dest / ".photosort" / "index.db")
    tags = _tag_all(items, index, a.model, a.workers, a.yes) if a.ai else {}

    home = tuple(float(x) for x in a.home.split(",")) if a.home else trips_mod.find_home(items)
    found = trips_mod.build_trips(items, home, a.trip_km, a.gap_hours, a.min_items)
    if found:
        trips_mod.name_trips(found)
        trips_mod.apply_overrides(found, a.trip_name)
    actions = organize.plan(
        items, found, dest, {s: t.caption for s, t in tags.items()},
        mode="move" if a.move else "copy", rename=a.rename,
    )

    print(f"\nFound {len(items)} files. Home: {home or 'unknown (no GPS data)'}. Trips: {len(found)}")
    for t in found:
        print(f"  {t.folder}  ({t.start:%Y-%m-%d} to {t.end:%Y-%m-%d}, {len(t.items)} files, name from {t.name_source})")
    print("Dates from:", dict(Counter(m.taken_source for m in items)))
    print("Destinations:", dict(Counter(act.dst.relative_to(dest).parts[0] for act in actions)))

    if not a.apply:
        print(f"\nDRY RUN. Nothing was {'moved' if a.move else 'copied'}. Re-run with --apply to do it.")
        return 0
    manifest = organize.apply(actions, dest)
    for act in actions:
        m = act.media
        t = tags.get(m.sha)
        index.upsert(str(act.dst), {
            "sha": m.sha, "kind": m.kind, "taken_at": m.taken_at, "taken_source": m.taken_source,
            "lat": m.lat, "lon": m.lon, "camera": m.camera, "trip": act.trip,
            **(asdict(t) if t else {}),
        })
    print(f"\nDone. Undo with: photosort undo {manifest}")
    return 0


def cmd_search(a) -> int:
    index = Index(Path(a.library).resolve() / ".photosort" / "index.db")
    rows = index.search(" ".join(a.query), a.year, a.month, a.trip, a.kind, a.limit)
    for r in rows:
        print(f"{(r['taken_at'] or 'undated')[:10]}  {r['path']}\n    {r['caption'] or '(no AI caption)'}")
    print(f"{len(rows)} result(s).")
    return 0


def cmd_undo(a) -> int:
    done, problems = organize.undo(Path(a.manifest))
    print(f"Reverted {done} file(s).")
    for p in problems:
        print("  !", p)
    return 1 if problems else 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="photosort", description="Sort photos into trips, years and months, and tag them for search.")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("sort", help="plan (default) or apply a sort")
    s.add_argument("source")
    s.add_argument("--dest", required=True, help="library folder to create")
    s.add_argument("--apply", action="store_true", help="actually copy/move files (default is a dry run)")
    s.add_argument("--move", action="store_true", help="move instead of copy")
    s.add_argument("--rename", action="store_true", help="rename files to DATE_caption.ext (needs --ai for captions)")
    s.add_argument("--ai", action="store_true", help="tag images with Claude (sends downscaled images to the API)")
    s.add_argument("--yes", action="store_true", help="skip the AI confirmation prompt")
    s.add_argument("--model", default=DEFAULT_MODEL)
    s.add_argument("--workers", type=int, default=8)
    s.add_argument("--home", help="LAT,LON of home, if auto-detection is wrong")
    s.add_argument("--trip-km", type=float, default=80.0)
    s.add_argument("--gap-hours", type=float, default=48.0)
    s.add_argument("--min-items", type=int, default=5)
    s.add_argument("--trip-name", action="append", default=[], metavar="START_DATE=NAME",
                   help="override a trip's name, e.g. 2024-06-10=Paris (repeatable). Auto names are the nearest small town and can be off.")
    s.set_defaults(fn=cmd_sort)

    q = sub.add_parser("search", help="search a sorted library")
    q.add_argument("library")
    q.add_argument("query", nargs="*")
    q.add_argument("--year", type=int)
    q.add_argument("--month", type=int)
    q.add_argument("--trip")
    q.add_argument("--kind", choices=["photo", "screenshot", "video"])
    q.add_argument("--limit", type=int, default=50)
    q.set_defaults(fn=cmd_search)

    u = sub.add_parser("undo", help="reverse a sort using its manifest")
    u.add_argument("manifest")
    u.set_defaults(fn=cmd_undo)

    a = p.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
