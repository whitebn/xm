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

test('color is painted right up to the line, never onto it', () => {
  const w = 100, h = 100;
  const rgba = makeImage(w, h, (s) => rect(s, 20, 20, 80, 80));
  const { wall, core } = analyzeLineArt(rgba, w, h);
  const res = smartRegion(new WallSet(wall, w, h, core), 50, 50, 10);
  const bmp = buildFillBitmap(res, w, h, [255, 0, 0]);
  const at = (x, y) => bmp.data[((y - bmp.y) * bmp.w + (x - bmp.x)) * 4 + 3];
  assert.equal(at(50, 50), 255);
  assert.equal(at(23, 50), 255, 'the pixel right beside the line is colored (no white halo)');
  assert.equal(bmp.x, 23, 'and the color starts exactly where the 3px line (x = 20..22) ends, so the line is not painted over');
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

// ---- gap-aware fill
import { WallSet, smartRegion, dilateBox } from '../js/fill.js';

test('dilateBox matches repeated dilateSquare', () => {
  const w = 40, h = 30;
  const m = new Uint8Array(w * h);
  m[15 * w + 20] = 1; m[3 * w + 3] = 1;
  let a = m;
  for (let i = 0; i < 4; i++) a = dilateSquare(a, w, h);
  const b = dilateBox(m, w, h, 4);
  assert.deepEqual(Array.from(a), Array.from(b));
});

test('dilateBox on a full page is fast', () => {
  const w = 1800, h = 1400;
  const m = new Uint8Array(w * h); m[700 * w + 900] = 1;
  const t = performance.now();
  dilateBox(m, w, h, 8);
  const ms = performance.now() - t;
  console.log(`      dilateBox full page: ${ms.toFixed(0)} ms`);
  assert.ok(ms < 1500);
});

// ---- exact by default, leak guard only for fills that escape to the page edge
function figure(draw, w = 300, h = 300) {
  const rgba = makeImage(w, h, draw);
  const { wall, core } = analyzeLineArt(rgba, w, h);
  return { w, h, walls: new WallSet(wall, w, h, core) };
}
const vline = (set, x, y0, y1, t = 4) => { for (let y = y0; y <= y1; y++) for (let k = 0; k < t; k++) set(x + k, y); };

test('a big shape that does not touch the page edge fills EXACTLY, narrow passages and all (the "face" case)', () => {
  // a big box with an inside wall that leaves a narrow 12px passage between two chambers
  const { w, walls } = figure((s) => { rect(s, 40, 40, 260, 260, 4); vline(s, 148, 44, 118); vline(s, 148, 132, 256); });
  const left = smartRegion(walls, 90, 150, 10);
  assert.equal(left.sealed, 0, 'no gap closing was used');
  assert.equal(left.region[150 * w + 210], 1, 'the other chamber is filled too, through the passage');
  assert.equal(left.region[125 * w + 150], 1, 'and so is the passage itself, with no white sliver left behind');
});

test('a shape with a gap that leaks to the page edge is contained, and filled completely', () => {
  // a box with a 10px gap in its top edge, and a small alcove walled off inside it
  const { w, walls } = figure((s) => {
    rect(s, 60, 60, 240, 240, 4);
    vline(s, 120, 64, 110, 3); for (let x = 120; x < 140; x++) { s(x, 110); s(x, 111); }   // an alcove at the top left inside the box
  });
  // punch the gap
  for (let y = 58; y < 66; y++) for (let x = 190; x < 200; x++) walls.base[y * w + x] = 0;
  const gap = smartRegion(walls, 150, 150, 10);
  assert.ok(gap.sealed > 0, 'the leak was detected');
  assert.equal(gap.region[10 * w + 10], 0, 'the page outside is NOT filled');
  assert.equal(gap.region[150 * w + 150], 1, 'inside is filled');
});

test('tapping the real background fills the background', () => {
  const { w, walls } = figure((s) => rect(s, 60, 60, 240, 240, 4));
  const bg = smartRegion(walls, 10, 10, 10);
  assert.equal(bg.sealed, 0);
  assert.equal(bg.region[10 * w + 10], 1);
  assert.equal(bg.region[150 * w + 150], 0);
});

test('with gap closing switched off, a leaky shape floods like a plain fill', () => {
  const { w, walls } = figure((s) => rect(s, 60, 60, 240, 240, 4));
  for (let y = 58; y < 66; y++) for (let x = 190; x < 200; x++) walls.base[y * w + x] = 0;
  const off = smartRegion(walls, 150, 150, 10, { closeGaps: false });
  assert.equal(off.region[10 * w + 10], 1, 'it leaks, as it did before gap closing existed');
  const on = smartRegion(walls, 150, 150, 10, { closeGaps: true });
  assert.equal(on.region[10 * w + 10], 0, 'and with gap closing on it does not');
});

test('a gap too big to close still fills without crashing', () => {
  const { w, walls } = figure((s) => rect(s, 60, 60, 240, 240, 4));
  for (let y = 58; y < 66; y++) for (let x = 150; x < 190; x++) walls.base[y * w + x] = 0;
  const r = smartRegion(walls, 150, 150, 10);
  assert.ok(r && r.count > 0);
});

test('growFringe stops at the solid line core', () => {
  const w = 60, h = 20;
  const rgba = new Uint8ClampedArray(w * h * 4).fill(255);
  // a soft-edged vertical line: gray fringe either side of a black core at x = 30..33
  for (let y = 0; y < h; y++) for (let x = 24; x <= 39; x++) {
    const d = x < 30 ? 30 - x : x > 33 ? x - 33 : 0;
    const v = d === 0 ? 0 : Math.min(255, 60 + d * 30);
    const j = (y * w + x) * 4; rgba[j] = rgba[j + 1] = rgba[j + 2] = v;
  }
  const { wall, core } = analyzeLineArt(rgba, w, h);
  const walls = new WallSet(wall, w, h, core);
  const left = smartRegion(walls, 5, 10, 5);
  // the gradient makes x = 29..34 dark enough to count as the line core (x = 30..33 is black)
  assert.equal(left.region[10 * w + 28], 1, 'reaches the soft edge right beside the core');
  assert.equal(left.region[10 * w + 29], 0, 'does not paint the core');
  assert.equal(left.region[10 * w + 40], 0, 'and does not cross it');
  const farSide = smartRegion(walls, 50, 10, 5);
  assert.equal(farSide.region[10 * w + 35], 1, 'the other side reaches its soft edge too');
});
