import json
import os
import random
import shutil
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

from PIL import ExifTags, Image

from photosort import media, organize, trips
from photosort.index import Index
from photosort.tagger import ClaudeTagger, Tags


def dms(v):
    v = abs(v)
    d = int(v)
    m = int((v - d) * 60)
    return (d, m, round(((v - d) * 60 - m) * 60, 2))


def make_jpg(path: Path, when: datetime | None, lat=None, lon=None, seed=0):
    rnd = random.Random(seed)
    img = Image.new("RGB", (64, 48), (rnd.randrange(256), rnd.randrange(256), rnd.randrange(256)))
    exif = Image.Exif()
    if when:
        exif.get_ifd(ExifTags.IFD.Exif)[ExifTags.Base.DateTimeOriginal] = when.strftime("%Y:%m:%d %H:%M:%S")
        exif[ExifTags.Base.Make], exif[ExifTags.Base.Model] = "Test", "Cam"
    if lat is not None:
        g = exif.get_ifd(ExifTags.IFD.GPSInfo)
        g[ExifTags.GPS.GPSLatitudeRef] = "N" if lat >= 0 else "S"
        g[ExifTags.GPS.GPSLatitude] = dms(lat)
        g[ExifTags.GPS.GPSLongitudeRef] = "E" if lon >= 0 else "W"
        g[ExifTags.GPS.GPSLongitude] = dms(lon)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "JPEG", exif=exif)


SEATTLE, LISBON = (47.61, -122.33), (38.72, -9.14)


class Fixture(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.src, self.dest = self.tmp / "src", self.tmp / "lib"
        s = 0
        for day in range(1, 8):  # home life, one photo a day in March 2024
            s += 1
            make_jpg(self.src / f"home{day}.jpg", datetime(2024, 3, day, 18), *SEATTLE, seed=s)
        shutil.copy(self.src / "home1.jpg", self.src / "home1_copy.jpg")  # exact duplicate
        for i in range(6):  # Lisbon trip, June 2024
            s += 1
            make_jpg(self.src / f"trip{i}.jpg", datetime(2024, 6, 10 + i // 2, 9 + i), LISBON[0] + i * 0.001, LISBON[1], seed=s)
        make_jpg(self.src / "nogps.jpg", datetime(2024, 6, 11, 20), seed=99)  # no GPS, inside trip window
        (self.src / "clip.mp4").write_bytes(b"not really a video")
        os.utime(self.src / "clip.mp4", (datetime(2024, 6, 11, 12).timestamp(),) * 2)
        Image.new("RGB", (20, 20), "white").save(self.src / "Screenshot 2024-05-01 at 10.00.00.png")
        make_jpg(self.src / "IMG_20230704_101500.jpg", None, seed=77)  # date only in the filename
        self.items = media.scan(self.src, skip=self.dest)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)


class TestMedia(Fixture):
    def test_exif_gps_and_date(self):
        m = next(i for i in self.items if i.path.name == "trip0.jpg")
        self.assertEqual(m.taken_source, "exif")
        self.assertEqual(m.taken_at, datetime(2024, 6, 10, 9))
        self.assertAlmostEqual(m.lat, 38.72, places=2)
        self.assertAlmostEqual(m.lon, -9.14, places=2)

    def test_western_hemisphere_is_negative(self):
        m = next(i for i in self.items if i.path.name == "home1.jpg")
        self.assertLess(m.lon, 0)

    def test_filename_date_fallback(self):
        m = next(i for i in self.items if i.path.name.startswith("IMG_2023"))
        self.assertEqual((m.taken_source, m.taken_at), ("filename", datetime(2023, 7, 4)))

    def test_kinds(self):
        kinds = {i.path.name: i.kind for i in self.items}
        self.assertEqual(kinds["clip.mp4"], "video")
        self.assertEqual(kinds["Screenshot 2024-05-01 at 10.00.00.png"], "screenshot")
        self.assertEqual(kinds["trip0.jpg"], "photo")


class TestTrips(Fixture):
    def test_home_detected_as_seattle(self):
        h = trips.find_home(self.items)
        self.assertLess(trips.haversine_km(h, SEATTLE), 5)

    def test_one_trip_with_nogps_and_video_attached(self):
        found = trips.build_trips(self.items, trips.find_home(self.items))
        self.assertEqual(len(found), 1)
        names = {m.path.name for m in found[0].items}
        self.assertIn("nogps.jpg", names)
        self.assertIn("clip.mp4", names)
        self.assertEqual(len(names), 8)

    def test_no_gps_means_no_trips(self):
        for m in self.items:
            m.lat = m.lon = None
        self.assertEqual(trips.build_trips(self.items, trips.find_home(self.items)), [])

    def test_trip_naming_uses_injected_geocoder(self):
        found = trips.build_trips(self.items, trips.find_home(self.items))
        trips.name_trips(found, geocode=lambda pts: [{"name": "Lisbon", "cc": "PT"}] * len(pts))
        self.assertEqual(found[0].folder, "2024-06 Lisbon PT")


    def test_name_override(self):
        found = trips.build_trips(self.items, trips.find_home(self.items))
        trips.name_trips(found, geocode=lambda pts: [{"name": "Vanves", "cc": "FR"}] * len(pts))
        trips.apply_overrides(found, ["2024-06-10=Paris"])
        self.assertEqual((found[0].folder, found[0].name_source), ("2024-06 Paris", "you"))
        with self.assertRaises(ValueError):
            trips.apply_overrides(found, ["2020-01-01=Nowhere"])


class TestOrganize(Fixture):
    def _plan(self, **kw):
        found = trips.build_trips(self.items, trips.find_home(self.items))
        trips.name_trips(found, geocode=lambda pts: [{"name": "Lisbon", "cc": "PT"}] * len(pts))
        return organize.plan(self.items, found, self.dest, **kw)

    def test_layout(self):
        rel = {a.src.name: a.dst.relative_to(self.dest).as_posix() for a in self._plan()}
        self.assertEqual(rel["trip0.jpg"], "Trips/2024-06 Lisbon PT/trip0.jpg")
        self.assertEqual(rel["home3.jpg"], "Photos/2024/2024-03/home3.jpg")
        self.assertEqual(rel["clip.mp4"], "Trips/2024-06 Lisbon PT/clip.mp4")
        self.assertTrue(rel["Screenshot 2024-05-01 at 10.00.00.png"].startswith("Screenshots/2024/"))
        self.assertEqual(rel["IMG_20230704_101500.jpg"], "Photos/2023/2023-07/IMG_20230704_101500.jpg")

    def test_duplicate_goes_to_duplicates_not_deleted(self):
        rel = [a.dst.relative_to(self.dest).as_posix() for a in self._plan() if a.reason == "exact duplicate"]
        self.assertEqual(len(rel), 1)
        self.assertTrue(rel[0].startswith("Duplicates/"))

    def test_dry_run_touches_nothing(self):
        self._plan()
        self.assertFalse(any(self.dest.rglob("*.jpg")) if self.dest.exists() else False)

    def test_copy_apply_then_undo(self):
        acts = self._plan()
        manifest = organize.apply(acts, self.dest)
        self.assertTrue(all(a.dst.exists() and a.src.exists() for a in acts))
        done, problems = organize.undo(manifest)
        self.assertEqual((done, problems), (len(acts), []))
        self.assertFalse(any(a.dst.exists() for a in acts))

    def test_move_apply_then_undo_restores_originals(self):
        before = sorted(p.name for p in self.src.iterdir())
        acts = self._plan(mode="move")
        manifest = organize.apply(acts, self.dest)
        self.assertEqual(list(self.src.iterdir()), [])
        organize.undo(manifest)
        self.assertEqual(sorted(p.name for p in self.src.iterdir()), before)

    def test_undo_refuses_to_delete_edited_copy(self):
        acts = self._plan()
        manifest = organize.apply(acts, self.dest)
        acts[0].dst.write_bytes(b"edited")
        done, problems = organize.undo(manifest)
        self.assertEqual(len(problems), 1)
        self.assertTrue(acts[0].dst.exists())

    def test_rename_uses_caption(self):
        caps = {m.sha: "A red door" for m in self.items}
        names = [a.dst.name for a in self._plan(captions=caps, rename=True)]
        self.assertTrue(any(n.endswith("_a-red-door.jpg") for n in names))

    def test_same_name_in_same_folder_does_not_overwrite(self):
        make_jpg(self.src / "a" / "IMG.jpg", datetime(2022, 1, 5, 10), seed=501)
        make_jpg(self.src / "b" / "IMG.jpg", datetime(2022, 1, 20, 10), seed=502)
        self.items = media.scan(self.src, skip=self.dest)
        dsts = [a.dst for a in self._plan()]
        self.assertEqual(len(dsts), len(set(dsts)))
        jan = sorted(d.name for d in dsts if d.parent.name == "2022-01")
        self.assertEqual(jan, ["IMG-1.jpg", "IMG.jpg"])


class FakeClient:
    def __init__(self, payload, stop="end_turn"):
        self.payload, self.stop, self.requests = payload, stop, []
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, **kw):
        self.requests.append(kw)
        return SimpleNamespace(
            stop_reason=self.stop,
            usage=SimpleNamespace(input_tokens=1100, output_tokens=90),
            content=[SimpleNamespace(type="text", text=json.dumps(self.payload))],
        )


class TestTagger(Fixture):
    payload = {"caption": "A red door.", "tags": ["Door", " red "], "scene": "city", "text_in_image": "", "contains_people": False}

    def test_request_shape_and_parsing(self):
        c = FakeClient(self.payload)
        t = ClaudeTagger(client=c).tag(self.src / "trip0.jpg")
        self.assertEqual(t, Tags("A red door.", ["door", "red"], "city"))
        req = c.requests[0]
        self.assertEqual(req["model"], "claude-haiku-5-5")
        block = req["messages"][0]["content"][0]
        self.assertEqual((block["type"], block["source"]["type"], block["source"]["media_type"]), ("image", "base64", "image/jpeg"))
        self.assertEqual(req["output_config"]["format"]["type"], "json_schema")

    def test_usage_and_non_text_stop_reasons(self):
        tg = ClaudeTagger(client=FakeClient(self.payload))
        tg.tag(self.src / "trip0.jpg")
        self.assertEqual((tg.usage.calls, tg.usage.input_tokens, tg.usage.output_tokens), (1, 1100, 90))
        bad = ClaudeTagger(client=FakeClient(self.payload, stop="refusal"))
        self.assertIsNone(bad.tag(self.src / "trip0.jpg"))
        self.assertEqual(len(bad.usage.failures), 1)


class TestSearch(Fixture):
    def test_fts_filters_and_prefix(self):
        idx = Index(self.dest / ".photosort" / "index.db")
        for n, (cap, tags, when, trip) in enumerate([
            ("Sunset over a beach", ["beach", "sunset", "orange"], datetime(2024, 6, 10), "2024-06 Lisbon PT"),
            ("A plate of pasta", ["food", "pasta"], datetime(2023, 2, 1), ""),
        ]):
            idx.upsert(f"/lib/{n}.jpg", {"sha": str(n), "kind": "photo", "taken_at": when, "taken_source": "exif",
                                        "caption": cap, "tags": tags, "scene": "other", "trip": trip})
        self.assertEqual([r["path"] for r in idx.search("sunset beach")], ["/lib/0.jpg"])
        self.assertEqual(len(idx.search("past")), 1)  # prefix match
        self.assertEqual(len(idx.search("", year=2023)), 1)
        self.assertEqual(len(idx.search("beach", trip="Lisbon")), 1)
        self.assertEqual(idx.search('"; DROP TABLE files; --'), [])  # hostile input doesn't break FTS syntax
        idx.upsert("/lib/0.jpg", {"sha": "0", "kind": "photo", "taken_at": datetime(2024, 6, 10), "taken_source": "exif", "caption": "Now a mountain", "tags": ["mountain"]})
        self.assertEqual(idx.search("beach"), [])  # re-upsert replaces the FTS row


class TestGallery(Fixture):
    def setUp(self):
        super().setUp()
        import threading
        import urllib.request
        from photosort import gallery

        self.urlopen = urllib.request.urlopen
        found = trips.build_trips(self.items, trips.find_home(self.items))
        trips.name_trips(found, geocode=lambda pts: [{"name": "Lisbon", "cc": "PT"}] * len(pts))
        acts = organize.plan(self.items, found, self.dest)
        organize.apply(acts, self.dest)
        self.idx = Index(self.dest / ".photosort" / "index.db")
        for a in acts:
            m = a.media
            self.idx.upsert(str(a.dst), {"sha": m.sha, "kind": m.kind, "taken_at": m.taken_at, "taken_source": m.taken_source,
                                         "trip": a.trip, "caption": "<img src=x onerror=alert(1)> beach" if m.path.name == "trip0.jpg" else "",
                                         "tags": ["beach"] if m.path.name == "trip0.jpg" else []})
        self.srv = gallery.serve(self.dest, 0)
        self.base = f"http://127.0.0.1:{self.srv.server_address[1]}"
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def tearDown(self):
        self.srv.shutdown()
        self.srv.server_close()
        self.idx.close()
        super().tearDown()

    def get(self, path):
        import urllib.error
        try:
            with self.urlopen(self.base + path) as r:
                return r.status, r.headers.get_content_type(), r.read()
        except urllib.error.HTTPError as e:
            return e.code, "", b""

    def test_binds_to_loopback_only(self):
        self.assertEqual(self.srv.server_address[0], "127.0.0.1")

    def test_page_and_facets(self):
        self.assertEqual(self.get("/")[:2], (200, "text/html"))
        _, _, body = self.get("/api/facets")
        f = json.loads(body)
        self.assertEqual(f["total"], len(self.items))
        self.assertEqual(f["tagged"], 1)
        self.assertEqual(f["trips"][0]["value"], "2024-06 Lisbon PT")

    def test_search_thumb_and_original(self):
        _, _, body = self.get("/api/search?q=beach")
        res = json.loads(body)["results"]
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0]["caption"], "<img src=x onerror=alert(1)> beach")  # returned as data, page renders it as text
        code, ctype, data = self.get(f"/thumb/{res[0]['id']}")
        self.assertEqual((code, ctype), (200, "image/jpeg"))
        self.assertEqual(Image.open(__import__("io").BytesIO(data)).format, "JPEG")
        self.assertEqual(self.get(f"/file/{res[0]['id']}")[:2], (200, "image/jpeg"))

    def test_filters_and_paging(self):
        _, _, body = self.get("/api/search?trip=Lisbon&kind=photo")
        self.assertEqual(len(json.loads(body)["results"]), 7)
        _, _, body = self.get("/api/search?year=2024&month=6")
        self.assertTrue(all(r["trip"] for r in json.loads(body)["results"]))

    def test_cannot_serve_files_outside_library(self):
        outside = self.tmp / "secret.txt"
        outside.write_text("secret")
        self.idx.upsert(str(outside), {"sha": "x", "kind": "photo", "taken_at": None, "taken_source": "none"})
        row = self.idx.db.execute("SELECT rowid FROM files WHERE path=?", (str(outside),)).fetchone()
        self.assertEqual(self.get(f"/file/{row[0]}")[0], 404)
        self.assertEqual(self.get(f"/thumb/{row[0]}")[0], 404)

    def test_unknown_routes_and_ids(self):
        for path in ("/file/99999", "/thumb/99999", "/file/abc", "/../etc/passwd", "/nope"):
            self.assertEqual(self.get(path)[0], 404, path)

    def test_video_has_no_thumb_but_serves(self):
        _, _, body = self.get("/api/search?kind=video")
        vid = json.loads(body)["results"][0]
        self.assertEqual(self.get(f"/thumb/{vid['id']}")[0], 404)
        self.assertEqual(self.get(f"/file/{vid['id']}")[0], 200)


if __name__ == "__main__":
    unittest.main()
