# photosort

Sort a messy folder of photos into trips, years and months. Tag every image with AI so you can search it later ("red door", "pasta", "passport").

Inspired by the "Sort my footage" product page from Yanny Studio. I only had a screenshot of that page, so this is a from-scratch build of the idea. It is not a copy of how their product works internally.

## What it does

```
photosort sort ~/Downloads/camera-dump --dest ~/Pictures/Library            # dry run, changes nothing
photosort sort ~/Downloads/camera-dump --dest ~/Pictures/Library --apply    # copies files
photosort sort ... --ai --apply                                             # also tags with Claude
photosort search ~/Pictures/Library sunset beach --year 2024
photosort undo ~/Pictures/Library/.photosort/manifest-YYYYMMDD-HHMMSS.json
```

Resulting layout:

```
Library/
  Trips/2024-06 Paris/        photos and videos from a trip
  Photos/2024/2024-03/        everyday photos by year and month
  Videos/2024/2024-03/
  Screenshots/2024/
  Duplicates/                 exact byte-for-byte copies, never deleted
  Unknown date/
  .photosort/index.db         search index
```

## Install

```
pip install -e .            # core, needs only Pillow
pip install -e '.[ai,places,heic]'
```

- `ai` adds the Anthropic SDK for tagging. Set `ANTHROPIC_API_KEY`.
- `places` adds offline place names for trips (reverse_geocoder).
- `heic` lets Pillow read iPhone HEIC files (pillow-heif).

## How each piece works

**Dates.** EXIF capture date first, then a date in the filename (`IMG_20240305_...`), then file modified time. The summary shows how many files fell into each bucket. Modified time is unreliable after a copy, so those files are never used to detect trips.

**Trips.** Needs GPS in the photos. Home is the area with the most distinct photo days. A trip is a run of photos more than 80 km from home, with gaps under 48 hours and at least 5 files. Photos without GPS and videos join a trip if their time falls inside it. No GPS data means no trips, only year/month folders. Tune with `--home LAT,LON`, `--trip-km`, `--gap-hours`, `--min-items`.

**Trip names.** Nearest small town from an offline GeoNames list. This is often a suburb, not the city you'd say. A test run put central Paris coordinates under "Levallois-Perret". Fix it with `--trip-name 2024-06-10=Paris`. The dry run prints each trip's start date for this.

**AI tags.** Each image is downscaled to 1024 px and sent to Claude (`claude-haiku-5-5` by default, change with `--model`). You get a caption, 5 to 12 keywords, a scene category, any readable text, and a people flag, returned as schema-validated JSON. Results are cached by file hash, so re-runs are free. Search covers all of those fields plus the trip name.

**Safety.** Dry run by default. Copy by default. `--move` is opt-in. Every apply writes a manifest. `undo` puts moved files back and deletes copies only if they are unchanged.

## Privacy, and a real difference from the product that inspired this

The product page says photos never leave your computer because it runs inside your own Claude on your Mac. This tool does not work that way. With `--ai`, downscaled copies of your images are sent to the Anthropic API. It asks you to confirm first. Without `--ai`, nothing leaves your machine, and you still get date, trip and duplicate sorting. A fully local tagger (for example a CLIP model) could replace `tagger.py`, at the cost of less detailed captions.

## What is and is not verified

Verified by the 20 tests in `tests/` and an end-to-end run on synthetic images:
EXIF and GPS parsing (including west/south signs), filename dates, home and trip detection, no-GPS fallback, layout, duplicates, filename collisions, copy and move, undo (including refusing to delete an edited copy), full-text search, and the offline place lookup.

Not verified:
- **Live Claude calls.** There was no API key in the build environment. The request shape was checked against the installed SDK types (`anthropic` 2.3.0) and a fake client, but never sent. Run it on 10 photos first.
- **Tag quality and cost.** The fake client reports made-up token counts. The real tool prints actual token totals after each run. Check those before tagging a big library.
- **HEIC, RAW, very large libraries.** Untested. The scan hashes every file and is single-threaded.
- **Video tagging.** Not supported. Videos are sorted by date and trip only, and their dates usually come from file modified time.

## Ideas for next steps

- Batch API for bulk tagging at lower cost.
- Local-only tagger.
- A small web gallery over `index.db`.
- Video dates from `ffprobe`, and tags from a few extracted frames.
