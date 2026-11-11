// Patterns for the Fill tool. Each one is drawn as a small repeating tile in the current color.
// To add a pattern: add [id, label] to PATTERNS and a case to makeTile().

import { drawStamp, hexToRgb } from './brushes.js';

const SIZE = 96; // tile size in canvas pixels. Every pattern repeats evenly inside it.

export const PATTERNS = [
  ['dots', 'Dots'], ['bigdots', 'Polka dots'], ['stripes', 'Stripes'], ['diagonal', 'Diagonal'],
  ['checks', 'Checks'], ['hearts', 'Hearts'], ['stars', 'Stars'], ['waves', 'Waves'],
  ['zigzag', 'Zigzag'], ['confetti', 'Confetti'], ['rainbow', 'Rainbow'], ['glitter', 'Glitter'],
];

const mix = (rgb, to, t) => rgb.map((v, i) => Math.round(v + (to[i] - v) * t));
const css = (rgb) => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
const luminance = (rgb) => 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];

// A small random number generator with a fixed seed, so confetti and glitter look the same every time.
function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}

const cache = new Map();

/** A SIZE x SIZE canvas holding the pattern `id` on a background of `baseHex`. */
export function makeTile(id, baseHex) {
  const key = `${id}|${baseHex}`;
  if (cache.has(key)) return cache.get(key);
  if (cache.size > 60) cache.clear();

  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const x = c.getContext('2d');
  const base = hexToRgb(baseHex);
  // marks are darker on a light background and lighter on a dark one, so they always show
  const markRgb = luminance(base) > 150 ? mix(base, [0, 0, 0], 0.3) : mix(base, [255, 255, 255], 0.6);
  const mark = css(markRgb);
  const markHex = '#' + markRgb.map((v) => v.toString(16).padStart(2, '0')).join('');
  x.fillStyle = baseHex;
  x.fillRect(0, 0, SIZE, SIZE);
  x.fillStyle = x.strokeStyle = mark;
  x.lineCap = x.lineJoin = 'round';

  // A mark that crosses the edge of the tile must continue on the opposite edge, or the repeated tile shows seams.
  const wrap = (draw) => {
    for (const ox of [-SIZE, 0, SIZE]) {
      for (const oy of [-SIZE, 0, SIZE]) {
        x.save();
        x.translate(ox, oy);
        draw();
        x.restore();
      }
    }
  };
  const grid = (step, draw, offsetRows = true) => {
    for (let row = 0; row * step < SIZE; row++) {
      for (let col = 0; col * step < SIZE; col++) {
        const px = col * step + step / 2 + (offsetRows && row % 2 ? step / 2 : 0);
        const py = row * step + step / 2;
        wrap(() => draw(px, py));
      }
    }
  };

  if (id === 'dots') grid(24, (px, py) => { x.beginPath(); x.arc(px, py, 4, 0, Math.PI * 2); x.fill(); });
  else if (id === 'bigdots') grid(48, (px, py) => { x.beginPath(); x.arc(px, py, 11, 0, Math.PI * 2); x.fill(); });
  else if (id === 'stripes') { for (let y = 0; y < SIZE; y += 24) x.fillRect(0, y, SIZE, 12); }
  else if (id === 'diagonal') {
    x.lineWidth = 9;
    // run each stripe past the edges of the tile so it meets the next tile with no notch
    for (let i = -SIZE; i < SIZE * 2; i += 24) { x.beginPath(); x.moveTo(i - 12, -12); x.lineTo(i + SIZE + 12, SIZE + 12); x.stroke(); }
  } else if (id === 'checks') {
    for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) if ((r + q) % 2) x.fillRect(q * 24, r * 24, 24, 24);
  } else if (id === 'hearts') grid(32, (px, py) => drawStamp(x, 'heart', px, py, 9, markHex, 0, true), true);
  else if (id === 'stars') grid(32, (px, py) => drawStamp(x, 'star', px, py, 9, markHex, 0, true), true);
  else if (id === 'waves') {
    x.lineWidth = 5;
    for (let y = 12; y < SIZE; y += 24) {
      x.beginPath();
      for (let px = 0; px <= SIZE; px += 4) { const py = y + Math.sin((px / SIZE) * Math.PI * 6) * 5; px ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.stroke();
    }
  } else if (id === 'zigzag') {
    x.lineWidth = 5;
    for (let y = 12; y < SIZE; y += 24) {
      x.beginPath();
      for (let px = 0; px <= SIZE; px += 16) { const py = y + ((px / 16) % 2 ? 6 : -6); px ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.stroke();
    }
  } else if (id === 'confetti') {
    const rand = rng(7);
    const colors = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#fb8c00', '#ffffff'];
    for (let i = 0; i < 16; i++) {
      x.fillStyle = colors[(rand() * colors.length) | 0];
      const cx = rand() * SIZE;
      const cy = rand() * SIZE;
      const angle = rand() * Math.PI;
      const square = rand() < 0.5;
      wrap(() => {
        x.translate(cx, cy);
        x.rotate(angle);
        if (square) x.fillRect(-5, -2.5, 10, 5);
        else { x.beginPath(); x.arc(0, 0, 3.5, 0, Math.PI * 2); x.fill(); }
      });
    }
  } else if (id === 'rainbow') {
    const bands = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'];
    bands.forEach((col, i) => { x.fillStyle = col; x.fillRect(0, i * (SIZE / 6), SIZE, SIZE / 6 + 1); });
  } else if (id === 'glitter') {
    const rand = rng(11);
    const light = css(mix(base, [255, 255, 255], 0.6));
    const dark = css(mix(base, [0, 0, 0], 0.3));
    for (let i = 0; i < 300; i++) {
      const t = rand();
      x.fillStyle = t < 0.4 ? '#ffffff' : t < 0.65 ? light : t < 0.85 ? '#ffe082' : dark;
      const cx = rand() * SIZE;
      const cy = rand() * SIZE;
      const r = 0.7 + rand() * 1.5;
      wrap(() => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); });
    }
    for (let i = 0; i < 5; i++) {
      const cx = rand() * SIZE;
      const cy = rand() * SIZE;
      wrap(() => drawStamp(x, 'star', cx, cy, 4, '#ffffff', 0, true));
    }
  }
  cache.set(key, c);
  return c;
}

const urlCache = new Map();

/** A data URL of the tile, for showing the pattern on a swatch. */
export function tileUrl(id, baseHex) {
  const key = `${id}|${baseHex}`;
  if (!urlCache.has(key)) {
    if (urlCache.size > 60) urlCache.clear();
    urlCache.set(key, makeTile(id, baseHex).toDataURL());
  }
  return urlCache.get(key);
}
