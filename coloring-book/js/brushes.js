// Tools and brush engines.
//
// To add a new brush: add an entry to TOOLS (and an icon symbol in index.html),
// and if it needs its own look, handle its `id` in dot() and seg() below.
// app.js does not need to change for a simple new brush.
//
// How painting works: a stroke is drawn on a temporary "wet" canvas, and when the
// finger lifts the wet canvas is blended into the page's color layer using
// `commit`. `wet` is how the wet canvas is shown while you draw, so what you see
// during the stroke matches what you get afterwards.

const SOLID = { wet: { opacity: 1, blend: 'normal' }, commit: { alpha: 1, op: 'source-over' } };

export const TOOLS = {
  fill: { id: 'fill', label: 'Fill', icon: 'i-fill' },
  brush: {
    id: 'brush', label: 'Highlighter', icon: 'i-highlighter', kind: 'paint', sizes: [16, 38, 74],
    wet: { opacity: 0.62, blend: 'multiply' }, commit: { alpha: 0.62, op: 'multiply' },
  },
  marker: { id: 'marker', label: 'Marker', icon: 'i-marker', kind: 'paint', sizes: [10, 22, 44], ...SOLID },
  pencil: { id: 'pencil', label: 'Pencil', icon: 'i-pencil', kind: 'paint', sizes: [3, 6, 12], ...SOLID },
  paintbrush: { id: 'paintbrush', label: 'Brush', icon: 'i-brush', kind: 'paint', sizes: [14, 30, 60], ...SOLID },
  crayon: { id: 'crayon', label: 'Crayon', icon: 'i-crayon', kind: 'paint', sizes: [14, 28, 52], ...SOLID },
  spray: { id: 'spray', label: 'Spray', icon: 'i-spray', kind: 'paint', sizes: [34, 64, 110], ...SOLID },
  roller: {
    id: 'roller', label: 'Roller', icon: 'i-roller', kind: 'paint', sizes: [26, 48, 84],
    wet: { opacity: 0.93, blend: 'normal' }, commit: { alpha: 0.93, op: 'source-over' },
  },
  glitter: { id: 'glitter', label: 'Glitter', icon: 'i-glitter', kind: 'paint', sizes: [14, 28, 50], ...SOLID },
  sparkle: { id: 'sparkle', label: 'Sparkle', icon: 'i-sparkle', kind: 'paint', sizes: [34, 60, 100], ...SOLID },
  stamp: { id: 'stamp', label: 'Stamp', icon: 'i-stamp', kind: 'paint', sizes: [36, 64, 110], ...SOLID },
  eraser: { id: 'eraser', label: 'Erase', icon: 'i-eraser', kind: 'erase', sizes: [28, 60, 110] },
  dropper: { id: 'dropper', label: 'Pick', icon: 'i-dropper', kind: 'pick' },
};

/** The brushes shown on the brush shelf, in order. */
export const BRUSHES = ['brush', 'marker', 'pencil', 'paintbrush', 'crayon', 'spray', 'roller', 'glitter', 'sparkle'];
/** The shapes shown on the stamp shelf: [id, label]. */
export const STAMP_SHAPES = [['star', 'Star'], ['heart', 'Heart'], ['flower', 'Flower'], ['smiley', 'Smiley'], ['paw', 'Paw'], ['cloud', 'Cloud']];

/** The brush size in CSS px for a slider position t between 0 and 1. */
export function sizeFor(spec, t) {
  const [small, , big] = spec.sizes;
  return small + (big - small) * t;
}

/** How far from a stroke point (in canvas pixels) a tool can mark. Used for dirty rectangles. */
export function reach(spec, width) {
  return (['roller', 'stamp', 'paintbrush', 'glitter'].includes(spec.id) ? width * 0.75 : width / 2) + 2;
}

// ---------------------------------------------------------------- color helpers

export const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const rgba = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
const mix = (rgb, to, t) => rgb.map((v, i) => Math.round(v + (to[i] - v) * t));

// ---------------------------------------------------------------- setup

const tileCache = new Map();

// A square of grainy "paper tooth" in the given color. Crayon and pencil stroke with this as a
// pattern, so the grain stays put on the page and overlapping strokes line up.
// `cell` is the size of one speck, `holes` how much of the paper shows through.
function grainTile(rgb, cell, holes) {
  const key = `${rgb.join(',')}|${cell}|${holes}`;
  if (tileCache.has(key)) return tileCache.get(key);
  if (tileCache.size > 16) tileCache.clear();
  const size = 128;
  const cells = Math.ceil(size / cell) + 1;
  const noise = Float32Array.from({ length: cells * cells }, Math.random);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const img = x.createImageData(size, size);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const n = noise[((py / cell) | 0) * cells + ((px / cell) | 0)];
      const j = (py * size + px) * 4;
      img.data[j] = rgb[0];
      img.data[j + 1] = rgb[1];
      img.data[j + 2] = rgb[2];
      img.data[j + 3] = n < holes ? 0 : 255 * (0.55 + 0.45 * n);
    }
  }
  x.putImageData(img, 0, 0);
  tileCache.set(key, c);
  return c;
}

/** Set up a stroke. `st` has: ctx, spec, width (canvas px), k (canvas px per CSS px), color (hex). */
export function prepare(st) {
  const { ctx, spec } = st;
  st.rgb = hexToRgb(st.color);
  st.carry = 0;
  st.dir = null;
  st.prevL = null;
  st.prevR = null;
  st.bw = 0; // the paintbrush's current width
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = st.width;
  ctx.fillStyle = ctx.strokeStyle = st.color;
  if (spec.id === 'crayon') ctx.fillStyle = ctx.strokeStyle = ctx.createPattern(grainTile(st.rgb, 4, 0.2), 'repeat');
  if (spec.id === 'pencil') ctx.fillStyle = ctx.strokeStyle = ctx.createPattern(grainTile(st.rgb, 2, 0.34), 'repeat');
  if (spec.id === 'spray') st.sprayColor = rgba(st.rgb, 0.55);
  if (spec.id === 'glitter') { ctx.strokeStyle = ctx.fillStyle = rgba(st.rgb, 0.9); ctx.lineWidth = st.width * 0.45; }
}

// ---------------------------------------------------------------- drawing

const rand = Math.random;

function spray(st, x, y) {
  const { ctx, k } = st;
  const R = st.width / 2;
  const n = Math.max(8, Math.round(R * R * 0.0042));
  ctx.fillStyle = st.sprayColor;
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const r = R * rand() * (0.55 + 0.45 * rand());
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, (0.5 + rand() * 1.3) * k, 0, Math.PI * 2);
    ctx.fill();
  }
}

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const rad = i % 2 ? r * 0.3 : r;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
}

function sparkle(st, x, y) {
  const { ctx } = st;
  const R = st.width / 2;
  const px = x + (rand() - 0.5) * R * 1.3;
  const py = y + (rand() - 0.5) * R * 1.3;
  const size = R * (0.14 + rand() * 0.3);
  const t = rand();
  ctx.fillStyle = t < 0.4 ? st.color : t < 0.7 ? rgba(mix(st.rgb, [255, 255, 255], 0.45), 1) : rgba(mix(st.rgb, [0, 0, 0], 0.25), 1);
  if (rand() < 0.62) star(ctx, px, py, size);
  else { ctx.beginPath(); ctx.arc(px, py, size * 0.4, 0, Math.PI * 2); ctx.fill(); }
}

// Place stamps (spray puffs, sparkles) every `spacing` pixels along a line.
function stampAlong(st, fn, ax, ay, bx, by, spacing) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  let d = spacing - st.carry;
  while (d <= len) {
    fn(st, ax + (dx * d) / len, ay + (dy * d) / len);
    d += spacing;
  }
  st.carry = len - (d - spacing);
}

// The roller paints a flat ribbon whose edges stay square to the direction of travel.
// Each step fills the quad between the previous pair of edge points and the new pair,
// so consecutive pieces share an edge and there are no gaps on curves.
function rollerStep(st, ax, ay, bx, by) {
  const { ctx } = st;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 0.6) return;
  let ux = dx / len;
  let uy = dy / len;
  if (st.dir) { // smooth the direction so the edges do not jitter
    ux = st.dir[0] * 0.55 + ux * 0.45;
    uy = st.dir[1] * 0.55 + uy * 0.45;
    const l = Math.hypot(ux, uy) || 1;
    ux /= l;
    uy /= l;
  }
  st.dir = [ux, uy];
  const h = st.width / 2;
  const nx = -uy * h;
  const ny = ux * h;
  const L = [bx + nx, by + ny];
  const R = [bx - nx, by - ny];
  const pL = st.prevL || [ax + nx, ay + ny];
  const pR = st.prevR || [ax - nx, ay - ny];

  ctx.beginPath();
  ctx.moveTo(pL[0], pL[1]);
  ctx.lineTo(L[0], L[1]);
  ctx.lineTo(R[0], R[1]);
  ctx.lineTo(pR[0], pR[1]);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1.5 * st.k; // a hairline stroke hides the seam between neighboring quads
  ctx.stroke();

  // thin lighter and darker lines along the ribbon, like streaks of paint
  const lines = 8;
  ctx.save();
  ctx.lineCap = 'butt';
  for (let j = 0; j < lines; j++) {
    const f = (j + 0.5) / lines;
    ctx.lineWidth = Math.max(1.4 * st.k, st.width * (0.01 + 0.014 * ((j * 5) % 3)));
    ctx.strokeStyle = j % 2 ? 'rgba(255,255,255,0.24)' : 'rgba(0,0,0,0.11)';
    ctx.beginPath();
    ctx.moveTo(pL[0] + (pR[0] - pL[0]) * f, pL[1] + (pR[1] - pL[1]) * f);
    ctx.lineTo(L[0] + (R[0] - L[0]) * f, L[1] + (R[1] - L[1]) * f);
    ctx.stroke();
  }
  ctx.restore();
  st.prevL = L;
  st.prevR = R;
}

// Glitter: a thin colored line with a dusting of white, light, dark and gold specks and the odd star.
function glitterAt(st, x, y) {
  const { ctx, k } = st;
  const R = st.width / 2;
  const light = rgba(mix(st.rgb, [255, 255, 255], 0.55), 1);
  const dark = rgba(mix(st.rgb, [0, 0, 0], 0.3), 1);
  for (let i = 0, n = 2 + ((rand() * 2) | 0); i < n; i++) {
    const px = x + (rand() - 0.5) * R * 1.5;
    const py = y + (rand() - 0.5) * R * 1.5;
    const t = rand();
    ctx.fillStyle = t < 0.4 ? '#ffffff' : t < 0.65 ? light : t < 0.85 ? '#ffe082' : dark;
    if (rand() < 0.2) star(ctx, px, py, R * 0.22);
    else { ctx.beginPath(); ctx.arc(px, py, (0.7 + rand() * 1.6) * k, 0, Math.PI * 2); ctx.fill(); }
  }
}

// The paintbrush gets thinner when you move fast and fatter when you slow down, with a few bristle lines.
function brushStep(st, ax, ay, cx, cy, bx, by) {
  const { ctx } = st;
  const speed = Math.hypot(bx - ax, by - ay);
  const target = st.width * Math.max(0.45, Math.min(1.15, 1.2 - speed / (st.width * 1.1)));
  st.bw = st.bw ? st.bw * 0.7 + target * 0.3 : target;
  ctx.lineWidth = st.bw;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo(cx, cy, bx, by);
  ctx.stroke();
  if (speed < 0.6) return;
  const nx = -(by - ay) / speed;
  const ny = (bx - ax) / speed;
  ctx.save();
  ctx.lineCap = 'butt';
  for (const j of [-1, 0, 1]) {
    const off = j * st.bw * 0.22;
    ctx.lineWidth = Math.max(1.2 * st.k, st.bw * 0.035);
    ctx.strokeStyle = j === 0 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.moveTo(ax + nx * off, ay + ny * off);
    ctx.lineTo(bx + nx * off, by + ny * off);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- stamps

/**
 * Draw one stamp shape centered on (x, y) with radius r. `flat` skips the dark outline
 * (used when the shape is a mark inside a pattern).
 */
export function drawStamp(ctx, shape, x, y, r, color, rot = 0, flat = false) {
  const rgb = hexToRgb(color);
  const dark = rgba(mix(rgb, [0, 0, 0], 0.4), 1);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.lineJoin = ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.5, r * 0.09);
  ctx.strokeStyle = dark;
  ctx.fillStyle = color;
  const paint = (strokeToo = true) => { ctx.fill(); if (strokeToo && !flat) ctx.stroke(); };
  if (shape === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 ? r * 0.45 : r;
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    paint();
  } else if (shape === 'heart') {
    ctx.beginPath();
    ctx.moveTo(0, r * 0.85);
    ctx.bezierCurveTo(-r * 1.3, r * 0.1, -r * 0.9, -r * 0.95, 0, -r * 0.35);
    ctx.bezierCurveTo(r * 0.9, -r * 0.95, r * 1.3, r * 0.1, 0, r * 0.85);
    ctx.closePath();
    paint();
  } else if (shape === 'flower') {
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58, r * 0.38, 0, Math.PI * 2);
      paint();
    }
    ctx.fillStyle = rgba(mix(rgb, [255, 255, 255], 0.75), 1);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
    paint();
  } else if (shape === 'smiley') {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
    paint();
    ctx.fillStyle = dark;
    for (const ex of [-0.32, 0.32]) { ctx.beginPath(); ctx.arc(ex * r, -0.2 * r, r * 0.11, 0, Math.PI * 2); ctx.fill(); }
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.beginPath();
    ctx.arc(0, 0.05 * r, r * 0.5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (shape === 'paw') {
    ctx.beginPath();
    ctx.ellipse(0, r * 0.3, r * 0.55, r * 0.45, 0, 0, Math.PI * 2);
    paint();
    for (const [tx, ty] of [[-0.62, -0.15], [-0.22, -0.55], [0.22, -0.55], [0.62, -0.15]]) {
      ctx.beginPath();
      ctx.arc(tx * r, ty * r, r * 0.2, 0, Math.PI * 2);
      paint();
    }
  } else if (shape === 'cloud') {
    const circles = [[-0.45, 0.1, 0.4], [0, -0.15, 0.5], [0.45, 0.1, 0.4], [0, 0.2, 0.42]];
    if (!flat) {
      ctx.save();
      ctx.lineWidth = ctx.lineWidth * 2;
      for (const [cx, cy, cr] of circles) { ctx.beginPath(); ctx.arc(cx * r, cy * r, cr * r, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    }
    for (const [cx, cy, cr] of circles) { ctx.beginPath(); ctx.arc(cx * r, cy * r, cr * r, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

function stampOne(st, x, y) {
  drawStamp(st.ctx, st.shape || 'star', x, y, st.width / 2, st.color, (rand() - 0.5) * 0.7);
}

/** The very first touch of a stroke. */
export function dot(st, x, y) {
  const { ctx, spec } = st;
  if (spec.id === 'spray') return spray(st, x, y);
  if (spec.id === 'sparkle') return sparkle(st, x, y);
  if (spec.id === 'roller') return; // the ribbon starts with the first movement (see finish)
  if (spec.id === 'stamp') return stampOne(st, x, y);
  if (spec.id === 'glitter') {
    ctx.beginPath();
    ctx.arc(x, y, st.width * 0.22, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 4; i++) glitterAt(st, x, y);
    return;
  }
  if (spec.id === 'paintbrush') {
    ctx.beginPath();
    ctx.arc(x, y, st.width * 0.4, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.arc(x, y, st.width / 2, 0, Math.PI * 2);
  ctx.fill();
}

/** One smoothed piece of a stroke: from (ax, ay) curving via (cx, cy) to (bx, by). */
export function seg(st, ax, ay, cx, cy, bx, by) {
  const { ctx, spec } = st;
  if (spec.id === 'spray') return stampAlong(st, spray, ax, ay, bx, by, Math.max(2 * st.k, st.width * 0.1));
  if (spec.id === 'sparkle') return stampAlong(st, sparkle, ax, ay, bx, by, Math.max(4 * st.k, st.width * 0.32));
  if (spec.id === 'roller') return rollerStep(st, ax, ay, bx, by);
  if (spec.id === 'stamp') return stampAlong(st, stampOne, ax, ay, bx, by, Math.max(8 * st.k, st.width * 1.15));
  if (spec.id === 'paintbrush') return brushStep(st, ax, ay, cx, cy, bx, by);
  if (spec.id === 'glitter') {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(cx, cy, bx, by);
    ctx.stroke();
    return stampAlong(st, glitterAt, ax, ay, bx, by, Math.max(3 * st.k, st.width * 0.16));
  }
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo(cx, cy, bx, by);
  ctx.stroke();
}

/** Called repeatedly while the finger is held still. Only the spray can keeps going. */
export function hold(st, x, y) {
  if (st.spec.id === 'spray') spray(st, x, y);
}

/** True for tools that keep spraying while held still. */
export const holdsPaint = (spec) => spec.id === 'spray';

/** Called when the finger lifts. A roller that never moved leaves a small flat dab so a tap still shows. */
export function finish(st) {
  if (st.spec.id === 'roller' && !st.prevL && st.last) {
    const [x, y] = st.last;
    st.ctx.fillRect(x - st.width / 2, y - st.width * 0.18, st.width, st.width * 0.36);
  }
}
