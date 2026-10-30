"""Local web gallery over a sorted library. Serves on 127.0.0.1 only, read-only, no login.

Only files that are in the index AND inside the library folder can be fetched.
"""
from __future__ import annotations

import json
import mimetypes
import re
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from PIL import Image, ImageOps

from .index import Index

PAGE = Path(__file__).with_name("gallery.html")
THUMB_SIDE = 480
PAGE_SIZE = 96


def make_thumb(src: Path, dst: Path, side: int = THUMB_SIDE) -> None:
    with Image.open(src) as img:
        img = ImageOps.exif_transpose(img)
        if img.mode != "RGB":
            img = img.convert("RGB")
        img.thumbnail((side, side))
        dst.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=dst.parent, suffix=".tmp", delete=False) as tmp:
            img.save(tmp, "JPEG", quality=82)
        Path(tmp.name).replace(dst)  # atomic, so concurrent requests never see half a file


def _row_json(r) -> dict:
    return {
        "id": r["id"], "name": Path(r["path"]).name, "kind": r["kind"], "taken_at": r["taken_at"],
        "trip": r["trip"], "caption": r["caption"], "tags": r["tags"].split() if r["tags"] else [],
        "scene": r["scene"], "text": r["text_in_image"], "camera": r["camera"],
        "lat": r["lat"], "lon": r["lon"], "date_source": r["taken_source"],
    }


def _int(qs: dict, key: str):
    v = qs.get(key, [""])[0]
    return int(v) if v.isdigit() else None


def make_handler(library: Path):
    library = library.resolve()
    db_path = library / ".photosort" / "index.db"
    thumb_dir = library / ".photosort" / "thumbs"

    class Handler(BaseHTTPRequestHandler):
        server_version = "photosort"

        def log_message(self, *args):  # quiet
            pass

        def _send(self, code: int, body: bytes, ctype: str, cache: str = "no-store") -> None:
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", cache)
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(body)

        def _json(self, obj) -> None:
            self._send(200, json.dumps(obj).encode(), "application/json")

        def _file_for(self, idx: Index, raw_id: str) -> tuple[dict, Path] | None:
            row = idx.get(int(raw_id))
            if row is None:
                return None
            p = Path(row["path"]).resolve()
            if library not in p.parents or not p.is_file():
                return None
            return dict(row), p

        def do_GET(self):
            url = urlparse(self.path)
            qs = parse_qs(url.query)
            idx = Index(db_path)
            try:
                if url.path == "/":
                    return self._send(200, PAGE.read_bytes(), "text/html; charset=utf-8")
                if url.path == "/api/facets":
                    return self._json(idx.facets())
                if url.path == "/api/search":
                    rows = idx.search(
                        qs.get("q", [""])[0], _int(qs, "year"), _int(qs, "month"),
                        qs.get("trip", [""])[0] or None, qs.get("kind", [""])[0] or None,
                        limit=PAGE_SIZE + 1, offset=_int(qs, "offset") or 0,
                    )
                    return self._json({"results": [_row_json(r) for r in rows[:PAGE_SIZE]], "has_more": len(rows) > PAGE_SIZE})
                m = re.fullmatch(r"/(thumb|file)/(\d+)", url.path)
                if m:
                    found = self._file_for(idx, m[2])
                    if found is None:
                        return self._send(404, b"not found", "text/plain")
                    row, path = found
                    if m[1] == "thumb":
                        if row["kind"] == "video":
                            return self._send(404, b"no thumbnail", "text/plain")
                        cached = thumb_dir / f"{row['sha']}.jpg"
                        if not cached.exists():
                            try:
                                make_thumb(path, cached)
                            except Exception:
                                return self._send(404, b"unreadable image", "text/plain")
                        return self._send(200, cached.read_bytes(), "image/jpeg", "public, max-age=3600")
                    ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
                    return self._send(200, path.read_bytes(), ctype, "public, max-age=3600")
                self._send(404, b"not found", "text/plain")
            except (ValueError, BrokenPipeError):
                pass
            finally:
                idx.close()

    return Handler


def serve(library: Path, port: int = 8765) -> ThreadingHTTPServer:
    if not (library / ".photosort" / "index.db").exists():
        raise SystemExit(f"No index at {library}/.photosort/index.db. Run `photosort sort ... --apply` first.")
    srv = ThreadingHTTPServer(("127.0.0.1", port), make_handler(library))
    srv.daemon_threads = True
    return srv
