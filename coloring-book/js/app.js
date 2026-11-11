import * as store from './store.js';
import { PdfSource, SampleSource } from './sources.js';
import { analyzeLineArt, buildFillBitmap, WallSet, smartRegion } from './fill.js';
import * as Brush from './brushes.js';
import { TOOLS, BRUSHES, STAMP_SHAPES, sizeFor, drawStamp } from './brushes.js';
import { PATTERNS, makeTile, tileUrl } from './patterns.js';
import { setupColorWheel } from './colorwheel.js';

// If the page and this script ever come from different versions (an interrupted update), clear the
// saved copies and reload once so the app repairs itself. Books and colors are not touched.
const APP_VERSION = '7';
(function selfHeal() {
  const pageVersion = document.querySelector('meta[name="cb-version"]')?.content;
  if (pageVersion === APP_VERSION) return;
  try { if (sessionStorage.getItem('cb.healed')) return; sessionStorage.setItem('cb.healed', '1'); } catch { return; }
  Promise.all([
    navigator.serviceWorker?.getRegistrations().then((rs) => Promise.all(rs.map((r) => r.unregister()))),
    window.caches?.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))),
  ]).catch(() => {}).finally(() => location.reload());
})();

// ------------------------------------------------------------------ settings

const LONG_SIDE = 1800;          // pixels on the long edge of each page's canvases
const GAP = 28;                  // px between pages while swiping
const PAD = 14;                  // px of margin around the paper
const UNDO_MAX = 30;             // undo steps kept per page
const UNDO_PIXEL_BUDGET = 12e6;  // roughly 48 MB of undo images per page (iPad Safari limits canvas memory)
const SNAP_RADIUS = 18;          // CSS px: a tap this close to a line still fills the nearest shape
const SWIPE_FRACTION = 0.22;     // drag this far (of the width) to turn the page
const SWIPE_VELOCITY = 0.45;     // or flick faster than this (px per ms)
const SWIPE_START = 48;          // CSS px a finger must travel sideways before the page starts to move.
                                 // Smaller wobbles (every toddler tap has some) never move the page.
// The color sets shown by the tabs next to the size slider. The last tab holds patterns for the Fill tool.
const COLOR_SETS = [
  {
    id: 'bright', label: 'Bright colors', tab: 'conic-gradient(#e53935, #fdd835, #43a047, #1e88e5, #8e24aa, #e53935)',
    colors: [
      ['Red', '#e53935'], ['Orange', '#fb8c00'], ['Yellow', '#fdd835'], ['Light green', '#9ccc3c'],
      ['Green', '#2e9e4f'], ['Sky blue', '#4fc3f7'], ['Blue', '#1e5fd8'], ['Purple', '#8e3bb8'],
      ['Pink', '#f78fb3'], ['Peach', '#ffc99a'], ['Brown', '#8a5a3c'], ['Black', '#26232e'],
    ],
  },
  {
    id: 'pastel', label: 'Pastel colors', tab: 'linear-gradient(135deg, #ffb3ba, #ffffba, #baffc9, #bae1ff)',
    colors: [
      ['Pastel pink', '#ffb3ba'], ['Pastel peach', '#ffdfba'], ['Pastel yellow', '#ffffba'], ['Pastel mint', '#baffc9'],
      ['Pastel blue', '#bae1ff'], ['Pastel lilac', '#e0bbff'], ['Pastel rose', '#ffc8dd'], ['Pastel violet', '#cdb4db'],
      ['Pastel sky', '#a2d2ff'], ['Pastel seafoam', '#b5ead7'], ['Pastel apricot', '#ffdac1'], ['Pastel lime', '#e2f0cb'],
    ],
  },
  {
    id: 'skin', label: 'Skin and earth tones', tab: 'linear-gradient(135deg, #fde0c5, #c68642, #6b3e1f)',
    colors: [
      ['Fair', '#ffdbac'], ['Light', '#fde0c5'], ['Cream', '#f1c27d'], ['Peach skin', '#f8c9a0'],
      ['Tan', '#e0ac69'], ['Golden', '#c68642'], ['Warm brown', '#b9794f'], ['Brown skin', '#8d5524'],
      ['Deep brown', '#6b3e1f'], ['Dark brown', '#4a2c17'], ['Sand', '#e8b48a'], ['Clay', '#d29a6e'],
    ],
  },
  {
    id: 'grey', label: 'Greys and darks', tab: 'linear-gradient(135deg, #f5f5f5, #9e9e9e, #263238)',
    colors: [
      ['White', '#f5f5f5'], ['Light grey', '#d9d9d9'], ['Silver', '#bdbdbd'], ['Grey', '#9e9e9e'],
      ['Mid grey', '#757575'], ['Dark grey', '#616161'], ['Charcoal', '#424242'], ['Near black', '#212121'],
      ['Taupe', '#8d6e63'], ['Slate', '#607d8b'], ['Steel', '#455a64'], ['Midnight', '#37474f'],
    ],
  },
  { id: 'pattern', label: 'Patterns', tab: 'radial-gradient(circle, #8e3bb8 22%, transparent 24%) 0 0 / 11px 11px, #ffe58a', colors: [] },
];

const $ = (id) => document.getElementById(id);
const el = {
  library: $('library'), shelf: $('shelf'), book: $('book'), stage: $('stage'), track: $('track'),
  prev: $('prevBtn'), next: $('nextBtn'), counter: $('counter'), counterText: $('counterText'),
  undo: $('undoBtn'), palette: $('palette'), sizebox: $('sizebox'), file: $('file'),
  menu: $('menu'), pages: $('pages'), pageGrid: $('pageGrid'), confirm: $('confirm'),
  hint: $('hint'), busy: $('busy'), busyText: $('busyText'), toast: $('toast'), dropzone: $('dropzone'),
};

const S = {
  book: null,            // { id, name, kind, pageCount, lastPage }
  source: null,
  pages: [],
  cur: 0,
  slides: new Map(),
  tool: 'fill',
  color: '#e53935',      // the color in use, as #rrggbb
  fromWheel: false,      // true when it came from the color wheel or the eyedropper, not a palette swatch
  pattern: null,         // a pattern id while a pattern is chosen for Fill, otherwise null (solid color)
  palTab: 0,             // which color set is showing
  sizeT: 0.5,            // the size slider, 0 (smallest) to 1 (biggest). Each tool maps it to its own range.
  brush: 'brush',        // the brush the Brushes button is set to
  stampShape: 'star',
  prevTool: 'fill',      // what to go back to after the eyedropper picks a color
  stayInLines: false,
  closeGaps: true,       // stop a fill from leaking out of a shape that has a small gap
  sound: true,
  autoFullscreen: true,  // go full screen on the first tap, where the browser allows it
  wet: null,             // the see-through canvas used while painting a stroke
  animUntil: 0,
  saveTimer: 0,
  pending: new Map(),    // page index -> in-flight save, so a reload never reads stale colors
};

const newCanvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const toBlob = (canvas) => new Promise((res) => canvas.toBlob(res, 'image/png'));
const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const currentColor = () => S.color;

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('cb.settings') || '{}');
    if (typeof s.stayInLines === 'boolean') S.stayInLines = s.stayInLines;
    if (typeof s.closeGaps === 'boolean') S.closeGaps = s.closeGaps;
    if (typeof s.autoFullscreen === 'boolean') S.autoFullscreen = s.autoFullscreen;
    if (typeof s.sound === 'boolean') S.sound = s.sound;
  } catch { /* storage blocked: use defaults */ }
}
function saveSettings() {
  try { localStorage.setItem('cb.settings', JSON.stringify({ stayInLines: S.stayInLines, closeGaps: S.closeGaps, autoFullscreen: S.autoFullscreen, sound: S.sound })); } catch { /* ignore */ }
}

// ------------------------------------------------------------------ small UI helpers

let toastTimer = 0;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, 4200);
}

function busy(msg) {
  if (msg) el.busyText.textContent = msg;
  el.busy.hidden = !msg;
}

function confirmDialog(text, yesLabel = 'Yes') {
  return new Promise((resolve) => {
    $('confirmText').textContent = text;
    $('confirmYes').textContent = yesLabel;
    el.confirm.hidden = false;
    const done = (v) => { el.confirm.hidden = true; $('confirmYes').onclick = $('confirmNo').onclick = null; resolve(v); };
    $('confirmYes').onclick = () => done(true);
    $('confirmNo').onclick = () => done(false);
  });
}

// A button you must press and hold, so a toddler cannot leave the book by accident.
function makeHold(button, ms, onDone) {
  let timer = 0;
  const cancel = () => { clearTimeout(timer); timer = 0; button.classList.remove('holding'); };
  button.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    button.style.setProperty('--hold-ms', `${ms}ms`);
    button.classList.add('holding');
    clearTimeout(timer);
    timer = setTimeout(() => { cancel(); onDone(); }, ms);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => button.addEventListener(n, cancel));
  button.addEventListener('click', (e) => { if (e.detail === 0) onDone(); }); // keyboard users
  button.addEventListener('contextmenu', (e) => e.preventDefault());
}

let audioCtx = null;
function pop() {
  if (!S.sound) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420 + Math.random() * 120, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.09);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.17);
  } catch { /* audio is optional */ }
}

// ------------------------------------------------------------------ pages: load, save, free

// Turn saved PNG bytes into something drawImage accepts. createImageBitmap needs iPadOS 15, so fall back to an <img>.
async function decodePng(buf) {
  const blob = new Blob([buf], { type: 'image/png' });
  if (window.createImageBitmap) {
    try { return await createImageBitmap(blob); } catch { /* fall through to <img> */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Safari on iPad kills a page that holds too many big canvases, and does not free a canvas
// just because nothing points at it any more. Setting its size to 0 releases the memory right away.
const release = (canvas) => { if (canvas) canvas.width = canvas.height = 0; };

function makePage(i) {
  return { i, w: 0, h: 0, line: null, paint: null, walls: null, loading: null, dirty: false, undo: [] };
}

function loadPage(i) {
  const p = S.pages[i];
  if (p.line) return Promise.resolve(p);
  if (p.loading) return p.loading;
  const book = S.book;
  const source = S.source;
  p.loading = (async () => {
    const raw = await source.renderLine(i, LONG_SIDE);
    const { width: w, height: h } = raw;
    const img = raw.getContext('2d').getImageData(0, 0, w, h);
    const { alpha, wall, core } = analyzeLineArt(img.data, w, h);
    // Turn the render into a transparent layer of black lines.
    for (let k = 0, j = 0; k < alpha.length; k++, j += 4) {
      img.data[j] = img.data[j + 1] = img.data[j + 2] = 0;
      img.data[j + 3] = alpha[k];
    }
    const line = newCanvas(w, h);
    line.getContext('2d').putImageData(img, 0, 0);
    release(raw);

    const paint = newCanvas(w, h);
    await S.pending.get(i);
    const saved = await store.getPaint(book.id, i);
    if (saved) {
      try {
        const bmp = await decodePng(saved);
        paint.getContext('2d').drawImage(bmp, 0, 0, w, h);
        bmp.close?.();
      } catch (err) { console.warn('Could not restore colors for page', i + 1, err); }
    }
    if (S.book !== book) return p; // the book was closed while loading
    Object.assign(p, { w, h, line, paint, walls: new WallSet(wall, w, h, core) });
    return p;
  })();
  p.loading.catch(() => { p.loading = null; });
  return p.loading;
}

function freePage(p) {
  release(p.line);
  release(p.paint);
  p.undo.forEach((u) => release(u.c));
  Object.assign(p, { line: null, paint: null, walls: null, loading: null, undo: [], dirty: false });
}

// Keep memory small: only pages near the current one stay in memory.
function evict() {
  for (const p of S.pages) {
    if (p.line && Math.abs(p.i - S.cur) > 1 && !S.slides.has(p.i)) {
      if (p.dirty) savePage(p);
      freePage(p);
    }
  }
}

async function savePage(p) {
  if (!p.paint || !S.book) return;
  const bookId = S.book.id;
  p.dirty = false;
  const job = (async () => {
    const blob = await toBlob(p.paint); // the snapshot is taken immediately
    if (!blob) return;
    await store.savePaint(bookId, p.i, await blob.arrayBuffer());
  })();
  S.pending.set(p.i, job);
  await job;
  if (S.pending.get(p.i) === job) S.pending.delete(p.i);
}

function markDirty(p) {
  p.dirty = true;
  thumbs.delete(p.i);
  if (!S.saveTimer) S.saveTimer = setTimeout(flushSaves, 1500);
}

async function flushSaves() {
  clearTimeout(S.saveTimer);
  S.saveTimer = 0;
  await Promise.all(S.pages.filter((p) => p.dirty && p.paint).map(savePage));
}

function saveBookMeta() {
  if (!S.book) return;
  S.book.lastPage = S.cur;
  S.book.updated = Date.now();
  store.putBook({ ...S.book });
}

// ------------------------------------------------------------------ slides (the swipeable pages)

function fitPaper(slide) {
  const p = S.pages[slide.i];
  const aw = Math.max(50, el.stage.clientWidth - PAD * 2);
  const ah = Math.max(50, el.stage.clientHeight - PAD * 2);
  const pw = p.w || 850;
  const ph = p.h || 1100;
  const s = Math.min(aw / pw, ah / ph);
  slide.paper.style.width = `${Math.floor(pw * s)}px`;
  slide.paper.style.height = `${Math.floor(ph * s)}px`;
}

function slideOffset(i, dx = 0) {
  return `translate3d(${(i - S.cur) * (el.stage.clientWidth + GAP) + dx}px,0,0)`;
}

function createSlide(i) {
  if (S.slides.has(i)) return S.slides.get(i);
  const slideEl = document.createElement('div');
  slideEl.className = 'slide';
  const paper = document.createElement('div');
  paper.className = 'paper';
  paper.innerHTML = '<div class="loading"><div class="spinner"><i></i><i></i><i></i></div></div>';
  slideEl.append(paper);
  slideEl.style.transform = slideOffset(i);
  el.track.append(slideEl);
  const slide = { i, el: slideEl, paper };
  S.slides.set(i, slide);
  fitPaper(slide);
  loadPage(i).then((p) => {
    if (S.slides.get(i) !== slide || !p.paint) return;
    slide.paper.replaceChildren(p.paint, p.line);
    fitPaper(slide);
    evict();
  }).catch((err) => {
    console.error('Page failed to load', err);
    paper.innerHTML = '<div class="loading" style="text-align:center;padding:16px">Oops! This page would not load.</div>';
  });
  return slide;
}

function layout(dx = 0, animate = false) {
  for (const [i, s] of S.slides) {
    s.el.classList.toggle('animate', animate);
    s.el.style.transform = slideOffset(i, dx);
  }
}

function syncSlides() {
  for (let i = S.cur - 1; i <= S.cur + 1; i++) if (i >= 0 && i < S.pages.length) createSlide(i);
}

function pruneSlides() {
  for (const [i, s] of S.slides) {
    if (Math.abs(i - S.cur) > 1) { s.el.remove(); S.slides.delete(i); }
  }
}

function goTo(n, animate = true) {
  n = clamp(n, 0, S.pages.length - 1);
  if (n === S.cur) { layout(0, animate); return; }
  const prev = S.pages[S.cur];
  if (prev?.dirty) savePage(prev);
  S.cur = n;
  syncSlides();
  layout(0, animate);
  S.animUntil = animate ? performance.now() + 340 : 0;
  setTimeout(() => { pruneSlides(); evict(); }, animate ? 380 : 0);
  saveBookMeta();
  updateUI();
}

function updateUI() {
  const n = S.pages.length;
  el.counterText.textContent = `${S.cur + 1} / ${n}`;
  el.prev.disabled = S.cur <= 0;
  el.next.disabled = S.cur >= n - 1;
  const p = S.pages[S.cur];
  el.undo.disabled = !(p && p.undo.length);
  document.querySelectorAll('.tool').forEach((b) => {
    const group = b.dataset.group;
    b.setAttribute('aria-checked', String(group ? groupActive(group) : b.dataset.tool === S.tool));
    if (group === 'brush' && b.dataset.shown !== S.brush) { // the Brushes button shows whichever brush is chosen
      const t = TOOLS[S.brush];
      b.dataset.shown = S.brush;
      b.innerHTML = `<svg class="icon"><use href="#${t.icon}"/></svg><span>${t.label}</span>`;
      b.setAttribute('aria-label', `${t.label}. Tap again to choose another brush.`);
    }
  });
  const patternTab = COLOR_SETS[S.palTab].id === 'pattern';
  if (patternTab && patternPreviewColor !== S.color) renderPalette(); // pattern swatches are drawn in the current color
  document.querySelectorAll('.swatch').forEach((b) => b.setAttribute('aria-checked', String(patternTab ? b.dataset.pattern === S.pattern : !S.pattern && b.dataset.hex === S.color)));
  document.querySelectorAll('.tab').forEach((b, i) => b.setAttribute('aria-selected', String(i === S.palTab)));
  const sizable = !!TOOLS[S.tool]?.sizes;
  el.sizebox.classList.toggle('off', !sizable);
  $('sizeSlider').disabled = !sizable;
  updateSizePreview();
  const wheelBtn = $('wheelBtn');
  wheelBtn.setAttribute('aria-checked', String(S.fromWheel));
  wheelBtn.style.setProperty('--picked', S.fromWheel ? S.color : 'transparent');
  $('mLines').setAttribute('aria-checked', String(S.stayInLines));
  $('mLinesState').textContent = S.stayInLines ? 'On' : 'Off';
  $('mGaps').setAttribute('aria-checked', String(S.closeGaps));
  $('mGapsState').textContent = S.closeGaps ? 'On' : 'Off';
  $('mSound').setAttribute('aria-checked', String(S.sound));
  $('mSoundState').textContent = S.sound ? 'On' : 'Off';
}

// ------------------------------------------------------------------ undo

function pushUndo(p, x, y, w, h, source = p.paint) {
  const c = newCanvas(w, h);
  c.getContext('2d').drawImage(source, x, y, w, h, 0, 0, w, h);
  p.undo.push({ x, y, w, h, c });
  let total = p.undo.reduce((s, u) => s + u.w * u.h, 0);
  while (p.undo.length > UNDO_MAX || (total > UNDO_PIXEL_BUDGET && p.undo.length > 1)) {
    const old = p.undo.shift();
    total -= old.w * old.h;
    release(old.c);
  }
}

function undo() {
  const p = S.pages[S.cur];
  const u = p?.undo.pop();
  if (!u || !p.paint) return;
  const ctx = p.paint.getContext('2d');
  ctx.clearRect(u.x, u.y, u.w, u.h);
  ctx.drawImage(u.c, u.x, u.y);
  release(u.c);
  markDirty(p);
  updateUI();
}

// ------------------------------------------------------------------ painting tools

const fillTmp = document.createElement('canvas');

function pointOnPaper(slide, clientX, clientY) {
  const r = slide.paper.getBoundingClientRect();
  return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
}

function ripple(slide, clientX, clientY) {
  const r = slide.paper.getBoundingClientRect();
  const d = document.createElement('div');
  d.className = 'ripple';
  d.style.left = `${clientX - r.left}px`;
  d.style.top = `${clientY - r.top}px`;
  d.style.setProperty('--ripple', currentColor());
  slide.paper.append(d);
  setTimeout(() => d.remove(), 600);
}

function doFill(clientX, clientY) {
  const p = S.pages[S.cur];
  const slide = S.slides.get(S.cur);
  if (!p?.paint || !slide) return;
  const r = slide.paper.getBoundingClientRect();
  const k = p.w / r.width;
  const x = (clientX - r.left) * k;
  const y = (clientY - r.top) * k;
  const res = smartRegion(p.walls, x, y, Math.round(SNAP_RADIUS * k), { closeGaps: S.closeGaps });
  if (!res) {
    slide.paper.classList.remove('nope');
    void slide.paper.offsetWidth; // restart the little shake
    slide.paper.classList.add('nope');
    return;
  }
  const bmp = buildFillBitmap(res, p.w, p.h, hexToRgb(currentColor()));
  pushUndo(p, bmp.x, bmp.y, bmp.w, bmp.h);
  fillTmp.width = bmp.w;
  fillTmp.height = bmp.h;
  const tctx = fillTmp.getContext('2d');
  tctx.putImageData(new ImageData(bmp.data, bmp.w, bmp.h), 0, 0);
  if (S.pattern) {
    // Keep the pattern only where the solid fill is. It is anchored to the page, not to the shape,
    // so neighbouring shapes filled with the same pattern line up.
    tctx.save();
    tctx.globalCompositeOperation = 'source-in';
    tctx.translate(-bmp.x, -bmp.y);
    tctx.fillStyle = tctx.createPattern(makeTile(S.pattern, S.color), 'repeat');
    tctx.fillRect(bmp.x, bmp.y, bmp.w, bmp.h);
    tctx.restore();
  }
  p.paint.getContext('2d').drawImage(fillTmp, bmp.x, bmp.y);
  release(fillTmp);
  ripple(slide, clientX, clientY);
  pop();
  markDirty(p);
  updateUI();
}

// The eyedropper: tap a colored spot to pick up its color.
function pickColor(clientX, clientY) {
  const p = S.pages[S.cur];
  const slide = S.slides.get(S.cur);
  if (!p?.paint || !slide) return;
  const r = slide.paper.getBoundingClientRect();
  const k = p.w / r.width;
  const x = Math.round((clientX - r.left) * k);
  const y = Math.round((clientY - r.top) * k);
  if (x < 0 || y < 0 || x >= p.w || y >= p.h) return;
  const d = p.paint.getContext('2d').getImageData(x, y, 1, 1).data;
  if (d[3] < 24) { // nothing colored there
    slide.paper.classList.remove('nope');
    void slide.paper.offsetWidth;
    slide.paper.classList.add('nope');
    return;
  }
  const a = d[3] / 255; // a see-through color is shown over the white page, so pick what you can see
  S.color = '#' + [d[0], d[1], d[2]].map((v) => Math.round(v * a + 255 * (1 - a)).toString(16).padStart(2, '0')).join('');
  S.pattern = null;
  S.fromWheel = true;
  S.tool = S.prevTool && S.prevTool !== 'dropper' ? S.prevTool : 'fill';
  ripple(slide, clientX, clientY);
  pop();
  updateUI();
}

// --- strokes (every paint tool and the eraser). The look of each tool lives in brushes.js.

function ensureWet(w, h) {
  if (!S.wet) { S.wet = newCanvas(w, h); S.wet.className = 'wet'; }
  if (S.wet.width !== w || S.wet.height !== h) { S.wet.width = w; S.wet.height = h; }
  S.wet.getContext('2d').clearRect(0, 0, w, h);
  return S.wet;
}

function makeRegionMask(p, x, y, k) {
  const res = smartRegion(p.walls, x, y, Math.round(SNAP_RADIUS * k), { closeGaps: S.closeGaps });
  if (!res) return null; // started on a line with no shape nearby: paint freely
  const bmp = buildFillBitmap(res, p.w, p.h, [0, 0, 0]);
  const c = newCanvas(bmp.w, bmp.h);
  c.getContext('2d').putImageData(new ImageData(bmp.data, bmp.w, bmp.h), 0, 0);
  return { canvas: c, x: bmp.x, y: bmp.y };
}

function beginStroke(e) {
  const p = S.pages[S.cur];
  const slide = S.slides.get(S.cur);
  const rect = slide.paper.getBoundingClientRect();
  const k = p.w / rect.width;
  const spec = TOOLS[S.tool];
  const width = sizeFor(spec, S.sizeT) * k;
  const st = {
    p, slide, rect, k, spec, width, half: Brush.reach(spec, width), shape: S.stampShape,
    color: spec.kind === 'erase' ? '#000000' : currentColor(),
    last: null, mid: null, box: null, points: 0, mask: null, before: null, ctx: null, timer: 0,
  };

  if (spec.kind === 'paint') {
    const wet = ensureWet(p.w, p.h);
    wet.style.opacity = spec.wet.opacity;
    wet.style.mixBlendMode = spec.wet.blend;
    slide.paper.insertBefore(wet, p.line);
    st.ctx = wet.getContext('2d');
    if (S.stayInLines) st.mask = makeRegionMask(p, (e.clientX - rect.left) * k, (e.clientY - rect.top) * k, k);
  } else {
    st.before = newCanvas(p.w, p.h);
    st.before.getContext('2d').drawImage(p.paint, 0, 0);
    st.ctx = p.paint.getContext('2d');
    st.ctx.save();
    st.ctx.globalCompositeOperation = 'destination-out';
  }
  Brush.prepare(st);
  G.mode = 'stroke';
  G.stroke = st;
  G.strokePointer = e.pointerId;
  addPoint(e.clientX, e.clientY);
  // The spray can keeps spraying while the finger rests in one spot.
  if (Brush.holdsPaint(spec)) st.timer = setInterval(() => holdTick(st), 45);
}

function holdTick(st) {
  if (G.stroke !== st || !st.last) return;
  const [x, y] = st.last;
  Brush.hold(st, x, y);
  if (st.mask) applyMask(st, x - st.half, y - st.half, x + st.half, y + st.half);
}

function growBox(st, x0, y0, x1, y1) {
  const b = st.box;
  if (!b) { st.box = { x0, y0, x1, y1 }; return; }
  b.x0 = Math.min(b.x0, x0); b.y0 = Math.min(b.y0, y0);
  b.x1 = Math.max(b.x1, x1); b.y1 = Math.max(b.y1, y1);
}

function addPoint(clientX, clientY) {
  const st = G.stroke;
  const x = (clientX - st.rect.left) * st.k;
  const y = (clientY - st.rect.top) * st.k;
  const half = st.half;
  st.points++;
  if (!st.last) {
    Brush.dot(st, x, y);
    st.last = [x, y];
    st.mid = [x, y];
    growBox(st, x - half, y - half, x + half, y + half);
    if (st.mask) applyMask(st, x - half, y - half, x + half, y + half);
    return;
  }
  const [lx, ly] = st.last;
  const mx = (lx + x) / 2;
  const my = (ly + y) / 2;
  Brush.seg(st, st.mid[0], st.mid[1], lx, ly, mx, my);
  const x0 = Math.min(st.mid[0], lx, mx) - half;
  const y0 = Math.min(st.mid[1], ly, my) - half;
  const x1 = Math.max(st.mid[0], lx, mx) + half;
  const y1 = Math.max(st.mid[1], ly, my) + half;
  growBox(st, x0, y0, x1, y1);
  if (st.mask) applyMask(st, x0, y0, x1, y1);
  st.last = [x, y];
  st.mid = [mx, my];
}

// "Stay inside the lines" mode: erase whatever was just painted outside the shape.
function applyMask(st, x0, y0, x1, y1) {
  const ctx = st.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.rect(Math.floor(x0), Math.floor(y0), Math.ceil(x1 - x0) + 1, Math.ceil(y1 - y0) + 1);
  ctx.clip();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(st.mask.canvas, st.mask.x, st.mask.y);
  ctx.restore();
}

function strokeRect(st) {
  const p = st.p;
  const x = clamp(Math.floor(st.box.x0), 0, p.w);
  const y = clamp(Math.floor(st.box.y0), 0, p.h);
  const x1 = clamp(Math.ceil(st.box.x1), 0, p.w);
  const y1 = clamp(Math.ceil(st.box.y1), 0, p.h);
  return { x, y, w: Math.max(1, x1 - x), h: Math.max(1, y1 - y) };
}

function endStroke() {
  const st = G.stroke;
  G.stroke = null;
  if (!st) return;
  clearInterval(st.timer);
  const { p } = st;
  if (!p.paint) return; // page was freed meanwhile
  Brush.finish(st);
  const r = strokeRect(st);
  if (st.spec.kind === 'paint') {
    pushUndo(p, r.x, r.y, r.w, r.h);
    const pc = p.paint.getContext('2d');
    pc.save();
    pc.globalAlpha = st.spec.commit.alpha;
    pc.globalCompositeOperation = st.spec.commit.op;
    pc.drawImage(S.wet, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    pc.restore();
    S.wet.remove();
    release(S.wet);
  } else {
    st.ctx.restore();
    pushUndo(p, r.x, r.y, r.w, r.h, st.before);
    release(st.before);
  }
  release(st.mask?.canvas);
  markDirty(p);
  updateUI();
}

function cancelStroke() {
  const st = G.stroke;
  G.stroke = null;
  if (!st) return;
  clearInterval(st.timer);
  if (st.spec.kind === 'paint') {
    S.wet?.remove();
    release(S.wet);
  } else if (st.p.paint) {
    st.ctx.restore();
    const ctx = st.p.paint.getContext('2d');
    ctx.clearRect(0, 0, st.p.w, st.p.h);
    ctx.drawImage(st.before, 0, 0);
    release(st.before);
  }
  release(st.mask?.canvas);
}

// ------------------------------------------------------------------ gestures
//
// One finger:
//   Fill tool       tap = fill. Drag sideways = turn the page.
//   Painting tools  drag = draw. Drag starting in the margin around the paper = turn the page.
// Two fingers moving sideways together, anywhere = turn the page.
//
// Nothing ever moves the page until a finger has traveled SWIPE_START pixels sideways,
// so the wobble of a small hand tapping or scribbling cannot nudge it. A second finger
// or palm that just rests on the screen is ignored.

const G = { mode: 'none', pointers: new Map(), primary: -1, startX: 0, startY: 0, swipeX0: 0, swipeTwo: false, dx: 0, samples: [], stroke: null, strokePointer: -1 };

function swipeX() {
  if (!G.swipeTwo) return G.pointers.get(G.primary)?.x ?? G.startX;
  let sum = 0;
  for (const p of G.pointers.values()) sum += p.x;
  return sum / G.pointers.size;
}

function beginSwipe(fromX, two = false) {
  G.mode = 'swipe';
  G.swipeTwo = two;
  G.swipeX0 = fromX;
  G.dx = 0;
  G.samples = [{ x: fromX, t: performance.now() }];
}

// Two fingers both dragging the same way, clearly sideways.
function twoFingerSwipeDirection() {
  if (G.pointers.size < 2) return 0;
  const [a, b] = [...G.pointers.values()];
  const da = a.x - a.sx;
  const db = b.x - b.sx;
  const avg = (da + db) / 2;
  const dy = (a.y - a.sy + b.y - b.sy) / 2;
  const together = Math.sign(da) === Math.sign(db) && Math.min(Math.abs(da), Math.abs(db)) > SWIPE_START / 2;
  return together && Math.abs(avg) > SWIPE_START && Math.abs(avg) > 1.5 * Math.abs(dy) ? Math.sign(avg) : 0;
}

function onDown(e) {
  if (!S.book) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  // Best effort palm rejection: ignore very large touch contacts (a resting hand).
  if (e.pointerType === 'touch' && Math.max(e.width || 0, e.height || 0) > BIG_TOUCH_PX) return;
  try { el.track.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone: harmless */ }
  G.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
  if (G.pointers.size > 1) return; // extra fingers never change the mode by themselves

  G.primary = e.pointerId;
  G.startX = e.clientX;
  G.startY = e.clientY;
  const p = S.pages[S.cur];
  const slide = S.slides.get(S.cur);
  if (performance.now() < S.animUntil) { G.mode = 'ignore'; return; }
  if (!p?.paint || !slide || !pointOnPaper(slide, e.clientX, e.clientY)) { G.mode = 'pending-swipe'; return; }
  if (S.tool === 'fill' || S.tool === 'dropper') { G.mode = 'pending-fill'; return; }
  beginStroke(e);
}

function onMove(e) {
  const ptr = G.pointers.get(e.pointerId);
  if (!ptr) return;
  ptr.x = e.clientX;
  ptr.y = e.clientY;

  if (['stroke', 'pending-fill', 'pending-swipe'].includes(G.mode)) {
    const dir = twoFingerSwipeDirection();
    if (dir) {
      if (G.mode === 'stroke') cancelStroke();
      let sum = 0;
      for (const q of G.pointers.values()) sum += q.x;
      beginSwipe(sum / G.pointers.size - dir * 8, true);
    }
  }

  if (G.mode === 'stroke') {
    if (e.pointerId !== G.strokePointer) return;
    const list = e.getCoalescedEvents?.() || [];
    if (list.length) list.forEach((ev) => addPoint(ev.clientX, ev.clientY));
    else addPoint(e.clientX, e.clientY);
  } else if (G.mode === 'pending-fill' || G.mode === 'pending-swipe') {
    if (e.pointerId !== G.primary) return;
    const dx = e.clientX - G.startX;
    const dy = e.clientY - G.startY;
    if (Math.abs(dx) > SWIPE_START && Math.abs(dx) > Math.abs(dy) * 1.5) beginSwipe(e.clientX - Math.sign(dx) * 8);
    else if (Math.hypot(dx, dy) > SWIPE_START * 1.5) G.mode = 'ignore'; // a scribble or vertical drag, not a tap
  } else if (G.mode === 'swipe') {
    let dx = swipeX() - G.swipeX0;
    const last = S.pages.length - 1;
    if ((S.cur === 0 && dx > 0) || (S.cur === last && dx < 0)) dx *= 0.3; // rubber band at the ends
    G.dx = dx;
    G.samples.push({ x: swipeX(), t: performance.now() });
    if (G.samples.length > 12) G.samples.shift();
    layout(dx, false);
  }
}

function endSwipe() {
  const W = el.stage.clientWidth;
  const now = performance.now();
  const recent = G.samples.filter((s) => now - s.t < 130);
  let v = 0;
  if (recent.length > 1) {
    const a = recent[0];
    const b = recent[recent.length - 1];
    v = (b.x - a.x) / Math.max(1, b.t - a.t);
  }
  let dir = 0;
  if (G.dx < -W * SWIPE_FRACTION || (v < -SWIPE_VELOCITY && G.dx < -30)) dir = 1;
  else if (G.dx > W * SWIPE_FRACTION || (v > SWIPE_VELOCITY && G.dx > 30)) dir = -1;
  goTo(S.cur + dir, true);
}

function onUp(e) {
  if (!G.pointers.delete(e.pointerId)) return;
  if (G.mode === 'pending-fill' && e.pointerId === G.primary) {
    (S.tool === 'dropper' ? pickColor : doFill)(G.startX, G.startY);
    G.mode = 'ignore';
  } else if (G.mode === 'stroke' && e.pointerId === G.strokePointer) {
    endStroke();
    G.mode = 'ignore';
  } else if (G.mode === 'swipe') {
    endSwipe();
    G.mode = 'ignore';
  }
  if (G.pointers.size === 0) G.mode = 'none';
}

function onCancel(e) {
  if (!G.pointers.delete(e.pointerId)) return;
  if (G.mode === 'stroke') cancelStroke();
  else if (G.mode === 'swipe') goTo(S.cur, true);
  G.mode = G.pointers.size ? 'ignore' : 'none';
}

el.track.addEventListener('pointerdown', onDown);
el.track.addEventListener('pointermove', onMove);
el.track.addEventListener('pointerup', onUp);
el.track.addEventListener('pointercancel', onCancel);
el.track.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault()); // no pinch-zoom of the whole page on iOS

// ------------------------------------------------------------------ toolbar

// The row of big buttons. "Brushes" and "Stamp" each open a shelf with more to choose from.
const MAIN_TOOLS = [
  { id: 'fill', label: 'Fill', icon: 'i-fill' },
  { group: 'brush', label: 'Brushes' },
  { group: 'stamp', label: 'Stamp', icon: 'i-stamp' },
  { id: 'eraser', label: 'Erase', icon: 'i-eraser' },
  { id: 'dropper', label: 'Pick', icon: 'i-dropper' },
];

const groupActive = (group) => (group === 'brush' ? BRUSHES.includes(S.tool) : S.tool === 'stamp');

function selectTool(id) {
  if (id === 'dropper' && S.tool !== 'dropper') S.prevTool = S.tool;
  S.tool = id;
  if (BRUSHES.includes(id)) S.brush = id;
}

function buildTools() {
  MAIN_TOOLS.forEach((t) => {
    const b = document.createElement('button');
    b.className = 'tool';
    b.type = 'button';
    b.setAttribute('role', 'radio');
    if (t.group) b.dataset.group = t.group;
    else b.dataset.tool = t.id;
    b.setAttribute('aria-label', t.label);
    b.innerHTML = `<svg class="icon"><use href="#${t.icon || TOOLS[S.brush].icon}"/></svg><span>${t.label}</span>`;
    b.addEventListener('click', () => {
      if (t.group) {
        // the first tap picks the tool, tapping it again opens its shelf
        if (groupActive(t.group)) { toggleTray(t.group); return; }
        closeTray();
        selectTool(t.group === 'brush' ? S.brush : 'stamp');
      } else {
        closeTray();
        selectTool(t.id);
      }
      updateUI();
    });
    $('tools').append(b);
  });
}

// --- the shelf (brushes and stamps)
let trayGroup = null;

function closeTray() {
  $('tray').hidden = true;
  trayGroup = null;
}

function toggleTray(group) {
  if (trayGroup === group) closeTray();
  else openTray(group);
}

function openTray(group) {
  const tray = $('tray');
  tray.replaceChildren();
  trayGroup = group;
  tray.setAttribute('aria-label', group === 'brush' ? 'Choose a brush' : 'Choose a stamp');
  const items = group === 'brush'
    ? BRUSHES.map((id) => ({ key: id, label: TOOLS[id].label, icon: TOOLS[id].icon, chosen: S.brush === id }))
    : STAMP_SHAPES.map(([id, label]) => ({ key: id, label, shape: id, chosen: S.stampShape === id }));
  for (const it of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tray-item';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(it.chosen));
    b.setAttribute('aria-label', it.label);
    b.dataset.item = it.key;
    if (it.icon) {
      b.innerHTML = `<svg class="icon"><use href="#${it.icon}"/></svg><span>${it.label}</span>`;
    } else {
      const c = newCanvas(88, 88); // drawn at twice the size so it stays sharp
      drawStamp(c.getContext('2d'), it.shape, 44, 44, 34, currentColor());
      b.append(c);
      b.insertAdjacentHTML('beforeend', `<span>${it.label}</span>`);
    }
    b.addEventListener('click', () => {
      if (group === 'brush') selectTool(it.key);
      else { S.stampShape = it.key; selectTool('stamp'); }
      closeTray();
      updateUI();
    });
    tray.append(b);
  }
  tray.hidden = false;
}

// --- the size slider
function updateSizePreview() {
  const spec = TOOLS[S.tool];
  const px = spec?.sizes ? sizeFor(spec, S.sizeT) : 30;
  const d = 6 + Math.sqrt(px / 110) * 34; // a dot that grows with the brush, from 6 to 40 px
  const prev = $('sizePreview');
  prev.style.width = prev.style.height = `${d.toFixed(1)}px`;
  prev.style.background = S.tool === 'eraser' ? '#ffffff' : S.color;
}

// --- palette tabs and swatches
let patternPreviewColor = null;

function swatchButton() {
  const b = document.createElement('button');
  b.className = 'swatch';
  b.type = 'button';
  b.setAttribute('role', 'radio');
  return b;
}

// Picking a color or pattern means "I want to color now", so leave the eraser or eyedropper.
const backToColoring = () => { if (S.tool === 'eraser' || S.tool === 'dropper') selectTool('fill'); };

function renderPalette() {
  const set = COLOR_SETS[S.palTab];
  el.palette.replaceChildren();
  if (set.id === 'pattern') {
    patternPreviewColor = S.color;
    for (const [id, label] of PATTERNS) {
      const b = swatchButton();
      b.classList.add('pattern');
      b.dataset.pattern = id;
      b.setAttribute('aria-label', label);
      b.style.backgroundImage = `url(${tileUrl(id, S.color)})`;
      b.addEventListener('click', () => { S.pattern = id; backToColoring(); updateUI(); });
      el.palette.append(b);
    }
  } else {
    for (const [name, hex] of set.colors) {
      const b = swatchButton();
      b.dataset.hex = hex;
      b.style.setProperty('--c', hex);
      b.setAttribute('aria-label', name);
      b.addEventListener('click', () => { S.color = hex; S.pattern = null; S.fromWheel = false; backToColoring(); updateUI(); });
      el.palette.append(b);
    }
  }
}

function buildTabs() {
  COLOR_SETS.forEach((set, i) => {
    const b = document.createElement('button');
    b.className = 'tab';
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', set.label);
    b.style.background = set.tab;
    b.addEventListener('click', () => { S.palTab = i; renderPalette(); updateUI(); });
    $('tabs').append(b);
  });
}

function bindWheel() {
  const wheel = setupColorWheel({
    root: $('wheel'),
    canvas: $('wheelCanvas'),
    dot: $('wheelDot'),
    slider: $('wheelBright'),
    swatch: $('wheelSwatch'),
    doneButton: $('wheelDone'),
    onChange: (hex) => {
      S.color = hex;
      S.pattern = null;
      S.fromWheel = true;
      backToColoring();
      updateUI();
    },
    onDone: updateUI,
  });
  $('wheelBtn').addEventListener('click', () => wheel.open(currentColor(), S.fromWheel));
}

function buildPalette() {
  buildTabs();
  renderPalette();
  $('sizeSlider').addEventListener('input', (e) => { S.sizeT = e.target.value / 100; updateSizePreview(); });
  // a tap anywhere else puts the shelf away
  document.addEventListener('pointerdown', (e) => {
    if (!$('tray').hidden && !e.target.closest('#tray, .tool[data-group]')) closeTray();
  }, true);
  el.prev.addEventListener('click', () => goTo(S.cur - 1));
  el.next.addEventListener('click', () => goTo(S.cur + 1));
  el.undo.addEventListener('click', undo);
  el.counter.addEventListener('click', openPageGrid);
}

document.addEventListener('keydown', (e) => {
  if (!S.book || el.library.hidden === false) return;
  if (e.key === 'ArrowLeft') goTo(S.cur - 1);
  else if (e.key === 'ArrowRight') goTo(S.cur + 1);
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  else if (e.key === 'Escape') { el.menu.hidden = true; el.pages.hidden = true; }
});

// ------------------------------------------------------------------ page picker

const thumbs = new Map(); // page index -> canvas
let thumbQueue = Promise.resolve();
const THUMB_SIDE = 260;

async function makeThumb(i, book = S.book, source = S.source) {
  const base = await source.renderLine(i, THUMB_SIDE);
  const out = newCanvas(base.width, base.height);
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, out.width, out.height);
  const p = S.pages[i];
  if (p?.paint && S.book === book) {
    ctx.drawImage(p.paint, 0, 0, out.width, out.height);
  } else if (book) {
    await S.pending.get(i);
    const saved = await store.getPaint(book.id, i);
    if (saved) {
      try {
        const bmp = await decodePng(saved);
        ctx.drawImage(bmp, 0, 0, out.width, out.height);
        bmp.close?.();
      } catch { /* show the plain page */ }
    }
  }
  ctx.globalCompositeOperation = 'multiply'; // black lines stay, white background disappears
  ctx.drawImage(base, 0, 0);
  return out;
}

function getThumb(i) {
  if (thumbs.has(i)) return Promise.resolve(thumbs.get(i));
  const job = thumbQueue.then(async () => {
    if (thumbs.has(i)) return thumbs.get(i);
    const t = await makeThumb(i);
    thumbs.set(i, t);
    return t;
  });
  thumbQueue = job.catch(() => {});
  return job;
}

let thumbObserver = null;
function openPageGrid() {
  el.pageGrid.replaceChildren();
  thumbObserver?.disconnect();
  thumbObserver = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const cell = en.target;
      thumbObserver.unobserve(cell);
      const i = +cell.dataset.i;
      getThumb(i).then((t) => {
        const c = newCanvas(t.width, t.height);
        c.getContext('2d').drawImage(t, 0, 0);
        cell.prepend(c);
      }).catch(() => {});
    }
  }, { root: el.pages.querySelector('.sheet'), rootMargin: '200px' });
  for (let i = 0; i < S.pages.length; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'page-thumb' + (i === S.cur ? ' current' : '');
    b.dataset.i = i;
    b.setAttribute('aria-label', `Page ${i + 1}`);
    b.innerHTML = `<b>${i + 1}</b>`;
    b.addEventListener('click', () => { el.pages.hidden = true; goTo(i, false); });
    el.pageGrid.append(b);
    thumbObserver.observe(b);
  }
  el.pages.hidden = false;
  el.pageGrid.querySelector('.current')?.scrollIntoView({ block: 'center' });
}

// ------------------------------------------------------------------ grown-ups menu

function slug(s) { return (s || 'coloring').replace(/[^\w\-]+/g, '_').slice(0, 40); }

async function exportPage() {
  const p = S.pages[S.cur];
  if (!p?.paint) return;
  const c = newCanvas(p.w, p.h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, p.w, p.h);
  ctx.drawImage(p.paint, 0, 0);
  ctx.drawImage(p.line, 0, 0);
  const blob = await toBlob(c);
  const name = `${slug(S.book.name)}-page-${S.cur + 1}.png`;
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (err) { if (err.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast('Picture saved!');
}

// Clearing can be undone, so a slip does not lose a whole picture.
function clearPage() {
  const p = S.pages[S.cur];
  if (!p?.paint) return;
  pushUndo(p, 0, 0, p.w, p.h);
  p.paint.getContext('2d').clearRect(0, 0, p.w, p.h);
  markDirty(p);
  updateUI();
}

function bindMenu() {
  $('saveBtn').addEventListener('click', exportPage);
  makeHold($('clearBtn'), 900, clearPage);
  makeHold($('menuBtn'), 700, () => { updateUI(); el.menu.hidden = false; });
  $('mClose').addEventListener('click', () => { el.menu.hidden = true; });
  el.menu.addEventListener('pointerdown', (e) => { if (e.target === el.menu) el.menu.hidden = true; });
  $('mLibrary').addEventListener('click', () => { el.menu.hidden = true; closeBook(); });
  $('mAdd').addEventListener('click', () => { el.menu.hidden = true; el.file.click(); });
  $('mSave').addEventListener('click', async () => { el.menu.hidden = true; await exportPage(); });
  $('mClear').addEventListener('click', async () => {
    el.menu.hidden = true;
    if (await confirmDialog('Clear all the color from this page?', 'Clear it')) clearPage();
  });
  $('mLines').addEventListener('click', () => { S.stayInLines = !S.stayInLines; saveSettings(); updateUI(); });
  $('mGaps').addEventListener('click', () => { S.closeGaps = !S.closeGaps; saveSettings(); updateUI(); });
  $('mSound').addEventListener('click', () => { S.sound = !S.sound; saveSettings(); updateUI(); });
  $('mFull').addEventListener('click', () => { el.menu.hidden = true; toggleFullscreen(); });
  $('pagesClose').addEventListener('click', () => { el.pages.hidden = true; });
  el.pages.addEventListener('pointerdown', (e) => { if (e.target === el.pages) el.pages.hidden = true; });
}

// ------------------------------------------------------------------ books: library, open, import

let objectUrls = [];

async function showLibrary() {
  el.book.hidden = true;
  el.library.hidden = false;
  objectUrls.forEach(URL.revokeObjectURL);
  objectUrls = [];
  el.shelf.querySelectorAll('[data-book]').forEach((n) => n.remove());
  const books = (await store.listBooks()).filter((b) => b.kind === 'pdf');
  for (const b of books) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.book = b.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    const thumb = document.createElement('span');
    thumb.className = 'thumb';
    if (b.thumb) {
      const img = new Image();
      img.alt = '';
      const url = URL.createObjectURL(new Blob([b.thumb], { type: 'image/png' }));
      objectUrls.push(url);
      img.src = url;
      thumb.append(img);
    }
    const name = document.createElement('strong');
    name.textContent = b.name;
    const sub = document.createElement('small');
    sub.textContent = `${b.pageCount} page${b.pageCount === 1 ? '' : 's'}`;
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del hold round small';
    del.setAttribute('aria-label', `Delete ${b.name}. Press and hold.`);
    del.innerHTML = '<svg class="ring" viewBox="0 0 48 48"><circle cx="24" cy="24" r="21"/></svg><svg class="icon small"><use href="#i-trash"/></svg>';
    makeHold(del, 900, async () => {
      if (await confirmDialog(`Delete "${b.name}" and all its colors?`, 'Delete')) { await store.deleteBook(b.id); showLibrary(); }
    });
    del.addEventListener('click', (e) => e.stopPropagation());
    card.append(thumb, name, sub, del);
    const open = () => openSavedBook(b.id);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    el.shelf.append(card);
  }
}

async function openBook(book, source) {
  await flushSaves();
  teardownBook();
  S.book = book;
  S.source = source;
  S.pages = Array.from({ length: book.pageCount }, (_, i) => makePage(i));
  S.cur = clamp(book.lastPage || 0, 0, book.pageCount - 1);
  thumbs.clear();
  el.library.hidden = true;
  el.book.hidden = false;
  syncSlides();
  layout(0, false);
  updateUI();
  saveBookMeta();
  let seen = false;
  try { seen = localStorage.getItem('cb.hintSeen') === '1'; } catch { /* ignore */ }
  el.hint.hidden = seen;
}

function teardownBook() {
  S.pages.forEach((p) => { p.loading = null; freePage(p); });
  S.book = null;
  S.source = null;
  S.pages = [];
  for (const s of S.slides.values()) s.el.remove();
  S.slides.clear();
  S.wet?.remove();
}

async function closeBook() {
  await flushSaves();
  teardownBook();
  showLibrary();
}

async function openSavedBook(id) {
  busy('Opening your book…');
  try {
    const meta = await store.getBook(id);
    if (!meta) throw new Error('missing');
    const buf = await store.getFile(id);
    if (!buf) throw new Error('missing file');
    await openBook(meta, await PdfSource.open(buf));
  } catch (err) {
    console.error(err);
    toast('Sorry, that book would not open.');
    showLibrary();
  } finally {
    busy(false);
  }
}

async function openSample() {
  busy('Opening your book…');
  try {
    let meta = await store.getBook('sample');
    meta ||= { id: 'sample', name: 'Sample book', kind: 'sample', pageCount: new SampleSource().numPages, lastPage: 0, updated: Date.now() };
    await store.putBook(meta);
    await openBook(meta, new SampleSource());
  } finally {
    busy(false);
  }
}

async function importFile(file) {
  if (!file) return;
  busy('Getting your book ready…');
  try {
    const buf = await file.arrayBuffer();
    const source = await PdfSource.open(buf);
    const id = `pdf:${file.name}:${file.size}:${file.lastModified}`;
    let meta = await store.getBook(id);
    if (!meta) {
      const first = await source.renderLine(0, 320);
      const thumb = await (await toBlob(first)).arrayBuffer();
      meta = { id, name: file.name.replace(/\.pdf$/i, ''), kind: 'pdf', pageCount: source.numPages, lastPage: 0, thumb, updated: Date.now() };
      await store.saveFile(id, buf);
      await store.putBook(meta);
    }
    await openBook(meta, source);
  } catch (err) {
    console.error(err);
    if (err?.name === 'PasswordException') toast('That PDF is locked with a password.');
    else if (err?.name === 'InvalidPDFException') toast("That file doesn't look like a PDF.");
    else toast('Sorry, that PDF would not open.');
    if (!S.book) showLibrary();
  } finally {
    busy(false);
    el.file.value = '';
  }
}

function bindLibrary() {
  $('addBtn').addEventListener('click', () => el.file.click());
  $('sampleBtn').addEventListener('click', openSample);
  el.file.addEventListener('change', () => importFile(el.file.files[0]));
  $('hintOk').addEventListener('click', () => {
    el.hint.hidden = true;
    try { localStorage.setItem('cb.hintSeen', '1'); } catch { /* ignore */ }
  });

  // drag and drop a PDF anywhere on a computer
  let depth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  window.addEventListener('dragenter', (e) => { if (hasFiles(e)) { depth++; el.dropzone.hidden = false; } });
  window.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; el.dropzone.hidden = true; } });
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    depth = 0;
    el.dropzone.hidden = true;
    const f = [...(e.dataTransfer?.files || [])].find((x) => x.type === 'application/pdf' || /\.pdf$/i.test(x.name));
    if (f) importFile(f); else if (e.dataTransfer?.files?.length) toast('Please drop a PDF file.');
  });
}

// ------------------------------------------------------------------ full screen, and keeping little hands off the buttons

const rootEl = document.documentElement;
// Safari on iPad does offer full screen, but with an exit button that cannot be hidden and a swipe-down that exits,
// which is wrong for a toddler. On iOS the right answer is Add to Home Screen, so full screen is not offered there.
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// "Installed" (standalone) is NOT full screen on Android: the status bar and the back / home / recents buttons are still
// on screen, and a child's belly can press them. Only display-mode "fullscreen" or the Fullscreen API hides them.
const isInstalled = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
const inFullscreen = () => !!fullscreenElement() || matchMedia('(display-mode: fullscreen)').matches;
const canFullscreen = () => !!(rootEl.requestFullscreen || rootEl.webkitRequestFullscreen);
const requestFs = () => (rootEl.requestFullscreen || rootEl.webkitRequestFullscreen).call(rootEl);

let fsOptOut = false; // a grown-up chose to leave full screen: stop taking the page back to it until the app is reopened

async function toggleFullscreen() {
  try {
    if (fullscreenElement()) { fsOptOut = true; await (document.exitFullscreen || document.webkitExitFullscreen).call(document); }
    else { fsOptOut = false; await requestFs(); }
  } catch {
    toast('This browser will not go full screen. Use "Add to Home screen" to install the app instead.');
  }
}

// Browsers only allow full screen right after a tap, so go full screen on the first tap, and again on the next tap
// if something takes the app out of it (coming back from another app, the system bars being pulled down).
let fsArmed = false;
function armFullscreen() {
  if (fsArmed || fsOptOut || !S.autoFullscreen || isIOS() || !canFullscreen() || inFullscreen()) return;
  fsArmed = true;
  const go = () => {
    document.removeEventListener('pointerup', go, true);
    fsArmed = false;
    if (!fsOptOut && !inFullscreen()) requestFs().catch(() => {});
  };
  document.addEventListener('pointerup', go, true);
}

function setupFullscreen() {
  const ios = isIOS();
  // The Full screen button is shown everywhere it can work, including the installed app (where it was wrongly hidden before).
  $('mFull').hidden = ios || !canFullscreen() || matchMedia('(display-mode: fullscreen)').matches;
  $('mInstallTip').hidden = isInstalled();
  $('mInstallTip').innerHTML = ios
    ? 'For full screen, install it: tap the <b>Share</b> button in Safari, then <b>Add to Home Screen</b>. Open it from the new icon. It also keeps your colors safe.'
    : 'For a true full-screen app, install it: open the Chrome menu and tap <b>Install app</b> or <b>Add to Home screen</b>. Then open it from the new icon.';
  armFullscreen();
  document.addEventListener('fullscreenchange', armFullscreen);
  document.addEventListener('webkitfullscreenchange', armFullscreen);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') armFullscreen(); });
}

// A child lying or leaning on the tablet presses the buttons with their belly or palm. Three things tell that apart from a tap:
//   1. the contact is big (a fingertip is about 40 px across, a belly or palm is far more)
//   2. a finger is already painting or swiping on the picture, so a second touch on the buttons is not a deliberate tap
//   3. the press lasts a long time (a tap is a fraction of a second, something resting on the screen is not)
// Touches caught by these rules are ignored completely, including the click that follows when they lift.
const BIG_TOUCH_PX = 80;     // CSS px: a contact wider or taller than this is not a fingertip
const LONG_PRESS_MS = 900;   // a button press held longer than this is not a tap
function guardButtons() {
  const onButtons = (t) => t instanceof Element && !!t.closest('.topbar, .toolbar');
  const ignored = new Map();   // pointerId -> true while the touch is being ignored
  const downAt = new Map();    // pointerId -> when it went down on the buttons
  let suppress = null;         // { x, y, until }: the one spot whose click is being swallowed
  let ignoreTouchUntil = 0;    // a touch whose pointer was just ignored must not reach the slider either
  let heldOff = 0;             // how many ignored touches are down right now. The size slider is switched off while any is.
  const swallowClickAt = (e) => { suppress = { x: e.clientX, y: e.clientY, until: performance.now() + 300 }; };

  document.addEventListener('pointerdown', (e) => {
    if (!onButtons(e.target)) return;
    const big = e.pointerType === 'touch' && Math.max(e.width || 0, e.height || 0) > BIG_TOUCH_PX;
    if (big || G.pointers.size > 0) {
      ignored.set(e.pointerId, true);
      ignoreTouchUntil = performance.now() + 60;
      // A range slider drags itself from the raw touch, and Chrome will not let a page cancel that touch,
      // but a disabled slider ignores it. So switch the slider off until this touch is over.
      if (heldOff++ === 0) $('sizeSlider').disabled = true;
      e.stopImmediatePropagation(); // nothing after this (shelf, buttons) may see the touch
      e.preventDefault();
    } else {
      downAt.set(e.pointerId, performance.now());
    }
  }, true);

  for (const type of ['pointermove', 'pointerup', 'pointercancel']) {
    document.addEventListener(type, (e) => {
      if (ignored.has(e.pointerId)) {
        e.stopImmediatePropagation(); // nothing after this (shelf, buttons) may see the touch
        if (type !== 'pointermove') {
          ignored.delete(e.pointerId);
          swallowClickAt(e);
          if (--heldOff <= 0) { heldOff = 0; updateUI(); } // updateUI puts the slider back to what it should be
        }
        return;
      }
      if (type !== 'pointermove' && downAt.has(e.pointerId)) {
        const held = performance.now() - downAt.get(e.pointerId);
        downAt.delete(e.pointerId);
        // press-and-hold buttons (grown-ups menu, clear) are meant to be held, and have their own timer
        if (held > LONG_PRESS_MS && type === 'pointerup' && onButtons(e.target) && !e.target.closest('.hold')) swallowClickAt(e);
      }
    }, true);
  }

  // Where the browser allows it, also cancel the raw touch that belongs to an ignored pointer.
  // (The pointer event and its touch event arrive together, so a short window is enough to pair them up.)
  document.addEventListener('touchstart', (e) => {
    if (performance.now() < ignoreTouchUntil && onButtons(e.target) && e.cancelable) e.preventDefault();
  }, { capture: true, passive: false });

  document.addEventListener('click', (e) => {
    // only the click that this touch would have caused: same place, right after. Taps anywhere else, and keyboard clicks, are untouched.
    if (suppress && performance.now() < suppress.until && Math.hypot(e.clientX - suppress.x, e.clientY - suppress.y) < 40 && onButtons(e.target)) {
      e.stopImmediatePropagation(); // nothing after this (shelf, buttons) may see the touch
      e.preventDefault();
    }
  }, true);
}

// If the screen ever ends up pinch-zoomed (everything looks too big and runs off the edge), say how to fix it.
function watchZoom() {
  const vv = window.visualViewport;
  if (!vv) return;
  let warned = false;
  vv.addEventListener('resize', () => {
    if (vv.scale > 1.05 && !warned) { warned = true; toast('The screen is zoomed in. Pinch two fingers together to zoom back out.'); }
    if (vv.scale <= 1.01) warned = false;
  });
}

// ------------------------------------------------------------------ start

function relayout() {
  for (const s of S.slides.values()) fitPaper(s);
  layout(0, false);
}

function flushOnLeave() {
  if (document.visibilityState === 'hidden') flushSaves();
}

loadSettings();
guardButtons(); // first, so its listeners run before any other touch listener on the page
buildTools();
buildPalette();
bindWheel();
bindMenu();
setupFullscreen();
watchZoom();
bindLibrary();
updateUI();
new ResizeObserver(relayout).observe(el.stage);
document.addEventListener('visibilitychange', flushOnLeave);
window.addEventListener('pagehide', () => { flushSaves(); });
showLibrary();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Offline mode unavailable:', err));
}

// For automated tests.
window.__cb = {
  S, goTo, undo,
  setTool: (id) => { selectTool(id); updateUI(); },
  setSize: (t) => { S.sizeT = t; $('sizeSlider').value = String(Math.round(t * 100)); updateUI(); },
};
