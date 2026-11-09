// Pure pixel algorithms for the coloring book. No DOM access in this file,
// so it can be unit tested in Node (see ../test/fill.test.mjs).

// A pixel darker than this (0 = black, 255 = white) counts as part of a line.
export const WALL_LUM = 200;
// How many pixels to thicken the walls by before filling. This seals tiny gaps
// in the drawing so a fill does not leak out of a shape that is almost closed.
export const SEAL_RADIUS = 1;
// After a fill, the color is grown this many pixels toward the line so there is
// no white halo between the color and the line art.
export const GROW = 2;

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
 */
export function analyzeLineArt(rgba, w, h) {
  const n = w * h;
  const alpha = new Uint8ClampedArray(n);
  let wall = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const lum = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
    // lum <= 90 -> fully black, lum >= 235 -> fully transparent
    alpha[i] = ((235 - lum) * 255) / 145;
    if (lum < WALL_LUM) wall[i] = 1;
  }
  for (let r = 0; r < SEAL_RADIUS; r++) wall = dilateSquare(wall, w, h);
  return { alpha, wall };
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
