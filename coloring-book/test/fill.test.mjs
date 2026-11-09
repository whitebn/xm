// Run with: node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLineArt, floodRegion, nearestOpen, buildFillBitmap, dilateSquare } from '../js/fill.js';

// Make a white RGBA image and let the caller draw black pixels.
function makeImage(w, h, draw) {
  const rgba = new Uint8ClampedArray(w * h * 4).fill(255);
  const set = (x, y) => { const j = (y * w + x) * 4; rgba[j] = rgba[j + 1] = rgba[j + 2] = 0; };
  draw(set);
  return rgba;
}
function rect(set, x0, y0, x1, y1, t = 3) {
  for (let x = x0; x <= x1; x++) for (let k = 0; k < t; k++) { set(x, y0 + k); set(x, y1 - k); }
  for (let y = y0; y <= y1; y++) for (let k = 0; k < t; k++) { set(x0 + k, y); set(x1 - k, y); }
}

test('fill stays inside a closed box and leaves the outside alone', () => {
  const w = 100, h = 100;
  const rgba = makeImage(w, h, (s) => rect(s, 20, 20, 80, 80));
  const { wall } = analyzeLineArt(rgba, w, h);
  const inside = floodRegion(wall, w, h, 50, 50);
  assert.ok(inside);
  assert.equal(inside.region[50 * w + 50], 1);
  assert.equal(inside.region[5 * w + 5], 0, 'outside is not filled');
  assert.equal(inside.region[20 * w + 50], 0, 'the line is not filled');
  const outside = floodRegion(wall, w, h, 5, 5);
  assert.equal(outside.region[50 * w + 50], 0, 'outer fill does not leak in');
});

test('a 2px gap in the line is sealed and does not leak', () => {
  const w = 100, h = 100;
  const rgba = makeImage(w, h, (s) => rect(s, 20, 20, 80, 80));
  // punch a 2px gap in the top edge
  for (let y = 20; y < 23; y++) for (let x = 50; x <= 51; x++) { const j = (y * w + x) * 4; rgba[j] = rgba[j + 1] = rgba[j + 2] = 255; }
  const { wall } = analyzeLineArt(rgba, w, h);
  const inside = floodRegion(wall, w, h, 50, 50);
  assert.equal(inside.region[5 * w + 5], 0, 'did not leak through the gap');
});

test('tapping on the line snaps to the nearest open pixel', () => {
  const w = 100, h = 100;
  const rgba = makeImage(w, h, (s) => rect(s, 20, 20, 80, 80));
  const { wall } = analyzeLineArt(rgba, w, h);
  const p = nearestOpen(wall, w, h, 21, 50, 12);
  assert.ok(p, 'found something');
  assert.ok(wall[p[1] * w + p[0]] === 0);
  assert.equal(nearestOpen(wall, w, h, 21, 50, 0), null, 'radius 0 means no snapping');
});

test('fill bitmap grows under the line but not across it', () => {
  const w = 100, h = 100;
  const rgba = makeImage(w, h, (s) => rect(s, 20, 20, 80, 80));
  const { wall } = analyzeLineArt(rgba, w, h);
  const res = floodRegion(wall, w, h, 50, 50);
  const bmp = buildFillBitmap(res, w, h, [255, 0, 0]);
  const at = (x, y) => bmp.data[((y - bmp.y) * bmp.w + (x - bmp.x)) * 4 + 3];
  assert.equal(at(50, 50), 255);
  assert.equal(at(21, 50), 255, 'color reaches under the inside of the line');
  assert.ok(bmp.x > 5 && bmp.x + bmp.w < 95, 'bitmap does not reach outside the box');
});

test('dilateSquare grows a single pixel to 3x3', () => {
  const m = new Uint8Array(25); m[12] = 1;
  const d = dilateSquare(m, 5, 5);
  assert.equal(d.reduce((a, b) => a + b, 0), 9);
});

test('a big region fills quickly', () => {
  const w = 1800, h = 1400;
  const rgba = new Uint8ClampedArray(w * h * 4).fill(255);
  const { wall } = analyzeLineArt(rgba, w, h);
  const t = performance.now();
  const r = floodRegion(wall, w, h, 10, 10);
  const ms = performance.now() - t;
  assert.equal(r.count, w * h);
  console.log(`      full-page flood fill: ${ms.toFixed(0)} ms`);
  assert.ok(ms < 2000);
});
