"""SQLite index with full-text search over captions, tags and visible text."""
from __future__ import annotations

import json
import re
import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS files (
  path TEXT PRIMARY KEY, sha TEXT, kind TEXT, taken_at TEXT, taken_source TEXT,
  year INTEGER, month INTEGER, lat REAL, lon REAL, camera TEXT, trip TEXT,
  caption TEXT, tags TEXT, scene TEXT, text_in_image TEXT, contains_people INTEGER
);
CREATE INDEX IF NOT EXISTS files_sha ON files(sha);
CREATE TABLE IF NOT EXISTS ai_cache (sha TEXT, model TEXT, result TEXT, PRIMARY KEY (sha, model));
CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(path UNINDEXED, caption, tags, scene, text_in_image, trip);
"""


class Index:
    def __init__(self, db_path: Path):
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(db_path)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)

    def cached(self, sha: str, model: str) -> dict | None:
        row = self.db.execute("SELECT result FROM ai_cache WHERE sha=? AND model=?", (sha, model)).fetchone()
        return json.loads(row["result"]) if row else None

    def cache(self, sha: str, model: str, result: dict) -> None:
        self.db.execute("INSERT OR REPLACE INTO ai_cache VALUES (?,?,?)", (sha, model, json.dumps(result)))
        self.db.commit()

    def upsert(self, path: str, rec: dict) -> None:
        tags = " ".join(rec.get("tags") or [])
        t = rec.get("taken_at")
        self.db.execute("DELETE FROM files_fts WHERE path=?", (path,))
        self.db.execute(
            "INSERT OR REPLACE INTO files VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                path, rec["sha"], rec["kind"], t.isoformat() if t else None, rec["taken_source"],
                t.year if t else None, t.month if t else None, rec.get("lat"), rec.get("lon"),
                rec.get("camera", ""), rec.get("trip", ""), rec.get("caption", ""), tags,
                rec.get("scene", ""), rec.get("text_in_image", ""), int(bool(rec.get("contains_people"))),
            ),
        )
        self.db.execute(
            "INSERT INTO files_fts VALUES (?,?,?,?,?,?)",
            (path, rec.get("caption", ""), tags, rec.get("scene", ""), rec.get("text_in_image", ""), rec.get("trip", "")),
        )
        self.db.commit()

    def search(self, query: str = "", year=None, month=None, trip=None, kind=None, limit=50) -> list[sqlite3.Row]:
        where, args = [], []
        sql = "SELECT f.* FROM files f"
        words = re.findall(r"\w+", query)
        if words:
            sql += " JOIN files_fts ON files_fts.path = f.path"
            where.append("files_fts MATCH ?")
            args.append(" ".join(f'"{w}"*' for w in words))  # AND of prefix terms; quoting avoids FTS syntax errors
        for col, val in (("year", year), ("month", month), ("kind", kind)):
            if val is not None:
                where.append(f"f.{col} = ?")
                args.append(val)
        if trip:
            where.append("f.trip LIKE ?")
            args.append(f"%{trip}%")
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY f.taken_at DESC LIMIT ?"
        return self.db.execute(sql, (*args, limit)).fetchall()
