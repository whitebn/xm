// Pure pixel algorithms for the coloring book. No DOM access in this file,
// so it can be unit tested in Node (see ../test/fill.test.mjs).

// A pixel darker than this (0 = black, 255 = white) counts as part of a line.
export const WALL_LUM = 200;
// How many pixels to thicken the walls by before filling. This seals tiny gaps
// in the drawing so a fill does not leak out of a shape that is almost closed.
export const SEAL_RADIUS = 1;
// A pixel darker than this is the solid core of a line. Color is painted right up to the core, never across it.
export const CORE_LUM = 120;
// How far (pixels) color may creep into the soft edge of a line to reach its core.
export const FRINGE_STEPS = 7;
// Kept for buildFillBitmap's optional unconstrained growth. Fills now reach the line through growFringe() instead.
export const GROW = 0;

/** Grow a 0/1 mask by one pixel in all 8 directions (a 3x3 square). */
export function dilateSquare(src, w, h) {
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (src[row + x] || (x > 0 && src[row + x - 1]) || (x < w - 1 && src[row + x + 1])) tmp[row + x] = 1;
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (tmp[row + x] || (y > 0 && tmp[row - w + x]) || (y < h - 1 && tmp[row + w + x])) out[row + x] = 1;
    }
  }
  return out;
}

/**
 * Turn an RGBA render of a page (black art on white) into:
 *   alpha - per-pixel opacity of the black line layer (crisp lines, clean white)
 *   wall  - 1 where a fill must stop (line pixels, slightly thickened)
 *   core  - 1 on the solid middle of the lines (color is painted up to here)
 */
export function analyzeLineArt(rgba, w, h) {
  const n = w * h;
  const alpha = new Uint8ClampedArray(n);
  let wall = new Uint8Array(n);
  const core = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const lum = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
    // lum <= 90 -> fully black, lum >= 235 -> fully transparent
    alpha[i] = ((235 - lum) * 255) / 145;
    if (lum < WALL_LUM) wall[i] = 1;
    if (lum < CORE_LUM) core[i] = 1;
  }
  for (let r = 0; r < SEAL_RADIUS; r++) wall = dilateSquare(wall, w, h);
  return { alpha, wall, core };
}

/** True when (x, y) is inside the image and not on a wall. */
export function isOpen(wall, w, h, x, y) {
  return x >= 0 && y >= 0 && x < w && y < h && wall[y * w + x] === 0;
}

/**
 * Toddlers tap on the line or just next to it. If the tapped pixel is a wall,
 * find the closest open pixel within maxR pixels. Returns [x, y] or null.
 */
export function nearestOpen(wall, w, h, x, y, maxR) {
  x = Math.round(x);
  y = Math.round(y);
  if (isOpen(wall, w, h, x, y)) return [x, y];
  for (let r = 1; r <= maxR; r++) {
    let best = null;
    let bestD = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      const edgeRow = dy === -r || dy === r;
      const step = edgeRow ? 1 : 2 * r;
      for (let dx = -r; dx <= r; dx += step) {
        if (isOpen(wall, w, h, x + dx, y + dy)) {
          const d = dx * dx + dy * dy;
          if (d < bestD) {
            bestD = d;
            best = [x + dx, y + dy];
          }
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/**
 * Scanline flood fill over open pixels, starting at (sx, sy).
 * Returns { region (w*h 0/1 mask), minX, minY, maxX, maxY, count } or null.
 */
export function floodRegion(wall, w, h, sx, sy) {
  if (!isOpen(wall, w, h, sx, sy)) return null;
  const region = new Uint8Array(w * h);
  const stack = [sx, sy];
  let minX = sx, maxX = sx, minY = sy, maxY = sy, count = 0;
  while (stack.length) {
    const y = stack.pop();
    let x = stack.pop();
    const row = y * w;
    if (wall[row + x] || region[row + x]) continue;
    while (x > 0 && !wall[row + x - 1] && !region[row + x - 1]) x--;
    const left = x;
    let up = false;
    let down = false;
    while (x < w && !wall[row + x] && !region[row + x]) {
      region[row + x] = 1;
      count++;
      if (y > 0) {
        const i = row - w + x;
        const open = !wall[i] && !region[i];
        if (open && !up) { stack.push(x, y - 1); up = true; } else if (!open) up = false;
      }
      if (y < h - 1) {
        const i = row + w + x;
        const open = !wall[i] && !region[i];
        if (open && !down) { stack.push(x, y + 1); down = true; } else if (!open) down = false;
      }
      x++;
    }
    if (left < minX) minX = left;
    if (x - 1 > maxX) maxX = x - 1;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { region, minX, minY, maxX, maxY, count };
}

/**
 * Build an RGBA bitmap (for putImageData) of the filled region, grown by `grow`
 * pixels so it tucks under the line art. Returns { x, y, w, h, data }.
 * `rgb` is [r, g, b]; every covered pixel is opaque.
 */
export function buildFillBitmap(res, w, h, rgb, grow = GROW) {
  const x0 = Math.max(0, res.minX - grow);
  const y0 = Math.max(0, res.minY - grow);
  const x1 = Math.min(w - 1, res.maxX + grow);
  const y1 = Math.min(h - 1, res.maxY + grow);
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  let mask = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) {
    const src = (y + y0) * w + x0;
    const dst = y * bw;
    for (let x = 0; x < bw; x++) mask[dst + x] = res.region[src + x];
  }
  for (let i = 0; i < grow; i++) mask = dilateSquare(mask, bw, bh);
  const data = new Uint8ClampedArray(bw * bh * 4);
  for (let i = 0, j = 0; i < mask.length; i++, j += 4) {
    if (mask[i]) {
      data[j] = rgb[0];
      data[j + 1] = rgb[1];
      data[j + 2] = rgb[2];
      data[j + 3] = 255;
    }
  }
  return { x: x0, y: y0, w: bw, h: bh, data };
}

// ---------------------------------------------------------------- gap-aware fill
//
// Line art often has small gaps where a shape is "almost" closed. A plain flood
// fill leaks through the gap and floods the whole page. To avoid that, when a
// fill comes out huge we retry with thicker walls (which close the gaps), and
// keep that result if it is much smaller. The color is then grown back toward
// the real lines so it still reaches them.

/** A fill that covers more than this share of the page is checked for leaks. */
export const LEAK_FRACTION = 0.04;
/** Extra pixels to thicken walls by when closing gaps (a gap up to ~2x this plus the base seal is closed). */
export const SEAL_STEPS = [3, 5, 8];

/** Grow a 0/1 mask by k pixels (square window). Takes O(pixels) no matter how big k is. */
export function dilateBox(src, w, h, k) {
  if (k <= 0) return Uint8Array.from(src);
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let cnt = 0;
    for (let x = 0; x <= Math.min(k, w - 1); x++) cnt += src[row + x];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = cnt > 0 ? 1 : 0;
      const add = x + k + 1;
      const rem = x - k;
      if (add < w) cnt += src[row + add];
      if (rem >= 0) cnt -= src[row + rem];
    }
  }
  const out = new Uint8Array(w * h);
  const col = new Int32Array(w);
  for (let y = 0; y <= Math.min(k, h - 1); y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) col[x] += tmp[row + x];
  }
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) out[row + x] = col[x] > 0 ? 1 : 0;
    const add = y + k + 1;
    const rem = y - k;
    if (add < h) { const r = add * w; for (let x = 0; x < w; x++) col[x] += tmp[r + x]; }
    if (rem >= 0) { const r = rem * w; for (let x = 0; x < w; x++) col[x] -= tmp[r + x]; }
  }
  return out;
}

/** The page's walls at several thicknesses. Thicker versions are made on demand and remembered. */
export class WallSet {
  constructor(base, w, h, core = null) {
    this.base = base;
    this.core = core;
    this.w = w;
    this.h = h;
    this.cache = new Map();
  }

  get(extra) {
    if (!extra) return this.base;
    let m = this.cache.get(extra);
    if (!m) {
      m = dilateBox(this.base, this.w, this.h, extra);
      this.cache.set(extra, m);
    }
    return m;
  }
}

/** Grow a flood result by `steps` pixels, but only through pixels that are open in `wall`. */
export function regrow(res, wall, w, h, steps) {
  const { region } = res;
  for (let s = 0; s < steps; s++) {
    const x0 = Math.max(0, res.minX - 1);
    const x1 = Math.min(w - 1, res.maxX + 1);
    const y0 = Math.max(0, res.minY - 1);
    const y1 = Math.min(h - 1, res.maxY + 1);
    const add = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x;
        if (region[i] || wall[i]) continue;
        if ((x > 0 && region[i - 1]) || (x < w - 1 && region[i + 1]) || (y > 0 && region[i - w]) || (y < h - 1 && region[i + w])) add.push(i);
      }
    }
    if (!add.length) break;
    for (const i of add) {
      region[i] = 1;
      const x = i % w;
      const y = (i / w) | 0;
      if (x < res.minX) res.minX = x;
      if (x > res.maxX) res.maxX = x;
      if (y < res.minY) res.minY = y;
      if (y > res.maxY) res.maxY = y;
    }
    res.count += add.length;
  }
  return res;
}

/**
 * Line edges are soft: between the white page and the solid black core there are a few pixels of gray.
 * The flood fill stops at the gray (so a fill never leaks through a faint line), which would leave a white
 * halo beside every line. This grows the region through that soft edge until it meets the solid core.
 */
export function growFringe(res, core, w, h, steps = FRINGE_STEPS) {
  const { region } = res;
  let frontier = [];
  for (let y = res.minY; y <= res.maxY; y++) {
    for (let x = res.minX; x <= res.maxX; x++) {
      const i = y * w + x;
      if (!region[i]) continue;
      if ((x > 0 && !region[i - 1] && !core[i - 1]) || (x < w - 1 && !region[i + 1] && !core[i + 1])
        || (y > 0 && !region[i - w] && !core[i - w]) || (y < h - 1 && !region[i + w] && !core[i + w])) frontier.push(i);
    }
  }
  for (let s = 0; s < steps && frontier.length; s++) {
    const next = [];
    for (const i of frontier) {
      const x = i % w;
      const y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w || (!dx && !dy)) continue;
          const n = ny * w + nx;
          if (region[n] || core[n]) continue;
          region[n] = 1;
          next.push(n);
          res.count++;
          if (nx < res.minX) res.minX = nx;
          if (nx > res.maxX) res.maxX = nx;
          if (ny < res.minY) res.minY = ny;
          if (ny > res.maxY) res.maxY = ny;
        }
      }
    }
    frontier = next;
  }
  return res;
}

/** True when the region reaches the edge of the page. */
const touchesEdge = (r, w, h) => r.minX === 0 || r.minY === 0 || r.maxX === w - 1 || r.maxY === h - 1;

/**
 * Split a leaky region between two seeds. Every pixel of `region` goes to whichever seed is
 * nearer *by walking through the region*, so the split lands in the middle of the gap.
 * Returns the pixels that belong to the first seed (`mine`).
 */
function splitRegion(region, mine, theirs, w, h) {
  const label = new Uint8Array(w * h);
  const queue = new Int32Array(region.count);
  let head = 0;
  let tail = 0;
  const seed = (src, id) => {
    for (let y = src.minY; y <= src.maxY; y++) {
      for (let x = src.minX; x <= src.maxX; x++) {
        const i = y * w + x;
        if (src.region[i] && region.region[i] && !label[i]) { label[i] = id; queue[tail++] = i; }
      }
    }
  };
  seed(mine, 1);
  seed(theirs, 2);
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    const id = label[i];
    const next = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < w * (h - 1) ? i + w : -1];
    for (const n of next) {
      if (n >= 0 && region.region[n] && !label[n]) { label[n] = id; queue[tail++] = n; }
    }
  }
  const out = new Uint8Array(w * h);
  let count = 0, minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = region.minY; y <= region.maxY; y++) {
    for (let x = region.minX; x <= region.maxX; x++) {
      const i = y * w + x;
      if (label[i] === 1) {
        out[i] = 1;
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { region: out, minX, minY, maxX, maxY, count };
}

/**
 * Find the region to fill for a tap at (x, y).
 *
 * Normally this is an exact flood fill: every pixel of the shape up to the lines.
 *
 * The one exception is a leak. If the exact fill reaches the edge of the page and covers a lot of it,
 * the tap may have been inside a shape with a gap, and the fill escaped through the gap to color the whole
 * background. We check by closing gaps (making the lines thicker): if the tap's region is then fully enclosed
 * (no longer touching the page edge), it was a leak. In that case the leaky region is split between the shape
 * and the outside, right at the gap, so the shape is still filled completely (no leftover slivers).
 *
 * A region that does not reach the page edge (a face, an eye) is never touched by this, so it always fills
 * exactly. Pass `{ closeGaps: false }` to switch the leak check off.
 *
 * Returns { region, minX, minY, maxX, maxY, count, sealed } or null. `sealed` is the gap size that was
 * closed, or 0 for an exact fill.
 */
export function smartRegion(walls, x, y, snap, { closeGaps = true } = {}) {
  const { w, h, base } = walls;
  const spot = nearestOpen(base, w, h, x, y, snap);
  if (!spot) return null;
  const first = floodRegion(base, w, h, spot[0], spot[1]);
  if (!first) return null;
  first.sealed = 0;
  const done = (r) => (walls.core ? growFringe(r, walls.core, w, h) : r);
  if (!closeGaps || first.count <= LEAK_FRACTION * w * h || !touchesEdge(first, w, h)) return done(first);

  for (const r of SEAL_STEPS) {
    const thick = walls.get(r);
    const seed = nearestOpen(thick, w, h, spot[0], spot[1], r + 2);
    if (!seed) continue;
    const core = floodRegion(thick, w, h, seed[0], seed[1]);
    if (!core) continue;
    if (touchesEdge(core, w, h)) continue; // still reaches the edge: this is the real background, not a leak

    // Leak confirmed. Find the outside: an open pixel on the page edge that the leaky fill reached.
    const outside = findEdgeSeed(first.region, core.region, thick, w, h);
    const bg = outside && floodRegion(thick, w, h, outside[0], outside[1]);
    if (!bg) { regrow(core, base, w, h, r); core.sealed = r; return done(core); }
    const shape = splitRegion(first, core, bg, w, h);
    shape.sealed = r;
    return done(shape);
  }
  return done(first);
}

function findEdgeSeed(region, core, open, w, h) {
  const ok = (x, y) => region[y * w + x] && !core[y * w + x] && !open[y * w + x];
  for (let x = 0; x < w; x++) { if (ok(x, 0)) return [x, 0]; if (ok(x, h - 1)) return [x, h - 1]; }
  for (let y = 0; y < h; y++) { if (ok(0, y)) return [0, y]; if (ok(w - 1, y)) return [w - 1, y]; }
  return null;
}
