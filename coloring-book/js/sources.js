// A "source" gives the app black-and-white line art for each page.
//   source.numPages
//   source.renderLine(index, longSide) -> Promise<canvas> (black art on white)
//
// PdfSource reads a real PDF with pdf.js. SampleSource draws a few simple
// pictures by code so there is something to color before importing a PDF.

import * as pdfjsLib from '../lib/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../lib/pdf.worker.min.mjs', import.meta.url).href;

function newCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export class PdfSource {
  static async open(arrayBuffer) {
    // pdf.js takes ownership of the buffer it is given, so hand it a copy.
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) }).promise;
    return new PdfSource(doc);
  }

  constructor(doc) {
    this.doc = doc;
    this.numPages = doc.numPages;
  }

  async renderLine(index, longSide) {
    const page = await this.doc.getPage(index + 1);
    const base = page.getViewport({ scale: 1 });
    const scale = longSide / Math.max(base.width, base.height);
    const vp = page.getViewport({ scale });
    const canvas = newCanvas(Math.round(vp.width), Math.round(vp.height));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    page.cleanup();
    return canvas;
  }
}

// ---------------------------------------------------------------- sample book

const W = 850;
const H = 1100;
const LW = 7;

function setup(ctx) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#000';
  ctx.lineWidth = LW;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}
const circle = (ctx, x, y, r, fill) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); fill ? ctx.fill() : ctx.stroke(); };
const ellipse = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.stroke(); };
// Outline of several overlapping circles merged into one blobby shape (clouds, bushes).
function blob(ctx, circles) {
  ctx.save();
  ctx.lineWidth = LW * 2;
  circles.forEach(([x, y, r]) => circle(ctx, x, y, r));
  ctx.fillStyle = '#fff';
  circles.forEach(([x, y, r]) => circle(ctx, x, y, r, true));
  ctx.restore();
}
const poly = (ctx, pts, close = true) => {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (close) ctx.closePath();
  ctx.stroke();
};
function star(ctx, cx, cy, R, r = R * 0.45) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r : R;
    pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
  }
  poly(ctx, pts);
}
function grass(ctx, y) {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.stroke();
  for (let x = 40; x < W; x += 90) poly(ctx, [[x, y], [x + 14, y - 34], [x + 28, y]], false);
}

const SAMPLE_PAGES = [
  function sun(ctx) {
    ctx.save(); ctx.translate(425, 430);
    for (let i = 0; i < 12; i++) {
      ctx.save(); ctx.rotate((i * Math.PI) / 6);
      poly(ctx, [[-34, -215], [0, -330], [34, -215]]);
      ctx.restore();
    }
    ctx.restore();
    circle(ctx, 425, 430, 200);
    circle(ctx, 350, 390, 18, true); circle(ctx, 500, 390, 18, true);
    ctx.beginPath(); ctx.arc(425, 450, 100, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    circle(ctx, 320, 470, 28); circle(ctx, 530, 470, 28);
    blob(ctx, [[170, 880, 70], [250, 850, 90], [340, 880, 70], [250, 910, 70]]);
    blob(ctx, [[600, 930, 60], [680, 900, 80], [760, 930, 60], [680, 960, 60]]);
  },
  function house(ctx) {
    ctx.strokeRect(215, 520, 420, 380);
    poly(ctx, [[185, 520], [425, 300], [665, 520]]);
    ctx.strokeRect(500, 330, 60, 110);
    ctx.strokeRect(370, 690, 110, 210); circle(ctx, 458, 800, 9, true);
    for (const x of [255, 520]) { ctx.strokeRect(x, 590, 95, 95); ctx.beginPath(); ctx.moveTo(x + 47, 590); ctx.lineTo(x + 47, 685); ctx.moveTo(x, 637); ctx.lineTo(x + 95, 637); ctx.stroke(); }
    circle(ctx, 120, 160, 70);
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; ctx.beginPath(); ctx.moveTo(120 + 90 * Math.cos(a), 160 + 90 * Math.sin(a)); ctx.lineTo(120 + 125 * Math.cos(a), 160 + 125 * Math.sin(a)); ctx.stroke(); }
    ctx.strokeRect(745, 760, 36, 140); blob(ctx, [[763, 700, 70], [715, 740, 55], [812, 740, 55]]);
    grass(ctx, 900);
  },
  function fish(ctx) {
    ellipse(ctx, 400, 520, 250, 160);
    poly(ctx, [[640, 520], [790, 400], [770, 520], [790, 640]]);
    circle(ctx, 280, 480, 26); circle(ctx, 288, 480, 9, true);
    ctx.beginPath(); ctx.arc(210, 540, 60, -0.3, 0.9); ctx.stroke();
    poly(ctx, [[350, 365], [420, 250], [500, 375]], false);
    for (const [x, y] of [[400, 470], [470, 520], [400, 570], [330, 520], [540, 470], [540, 570]]) { ctx.beginPath(); ctx.arc(x, y, 38, -0.9 * Math.PI, -0.1 * Math.PI); ctx.stroke(); }
    [[110, 330, 26], [150, 250, 18], [90, 190, 12]].forEach(([x, y, r]) => circle(ctx, x, y, r));
    for (const x of [140, 240, 700]) { ctx.beginPath(); ctx.moveTo(x, 1000); ctx.bezierCurveTo(x - 60, 940, x + 60, 880, x, 820); ctx.bezierCurveTo(x - 50, 770, x + 40, 740, x, 700); ctx.stroke(); }
    ellipse(ctx, 560, 860, 90, 55); poly(ctx, [[640, 860], [710, 810], [710, 910]]); circle(ctx, 520, 845, 10, true);
    ctx.beginPath(); ctx.moveTo(0, 1030); ctx.lineTo(W, 1030); ctx.stroke();
  },
  function butterfly(ctx) {
    ellipse(ctx, 425, 520, 32, 190);
    ellipse(ctx, 300, 410, 160, 105, -0.5); ellipse(ctx, 550, 410, 160, 105, 0.5);
    ellipse(ctx, 320, 620, 120, 85, 0.55); ellipse(ctx, 530, 620, 120, 85, -0.55);
    circle(ctx, 280, 400, 42); circle(ctx, 570, 400, 42); circle(ctx, 325, 625, 30); circle(ctx, 525, 625, 30);
    circle(ctx, 425, 320, 38);
    ctx.beginPath(); ctx.moveTo(410, 290); ctx.bezierCurveTo(380, 220, 350, 200, 320, 205); ctx.moveTo(440, 290); ctx.bezierCurveTo(470, 220, 500, 200, 530, 205); ctx.stroke();
    circle(ctx, 320, 205, 9, true); circle(ctx, 530, 205, 9, true);
    for (const [x, y] of [[170, 960], [425, 990], [680, 950]]) {
      ctx.beginPath(); ctx.moveTo(x, 1060); ctx.lineTo(x, y + 40); ctx.stroke();
      for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; ellipse(ctx, x + 40 * Math.cos(a), y + 40 * Math.sin(a), 24, 24); }
      circle(ctx, x, y, 22);
    }
  },
  function rocket(ctx) {
    ctx.beginPath(); ctx.moveTo(425, 160); ctx.bezierCurveTo(560, 280, 580, 520, 560, 760); ctx.lineTo(290, 760); ctx.bezierCurveTo(270, 520, 290, 280, 425, 160); ctx.closePath(); ctx.stroke();
    circle(ctx, 425, 430, 70); circle(ctx, 425, 430, 46);
    poly(ctx, [[290, 640], [190, 780], [190, 860], [290, 760]]); poly(ctx, [[560, 640], [660, 780], [660, 860], [560, 760]]);
    poly(ctx, [[340, 760], [425, 960], [510, 760]]); poly(ctx, [[380, 760], [425, 850], [470, 760]], false);
    star(ctx, 120, 200, 45); star(ctx, 700, 150, 32); star(ctx, 720, 560, 40); star(ctx, 110, 560, 28); star(ctx, 640, 960, 30);
    circle(ctx, 120, 930, 60); ellipse(ctx, 120, 930, 105, 24, -0.4);
  },
  function icecream(ctx) {
    poly(ctx, [[300, 520], [550, 520], [425, 960]]);
    for (let i = 1; i < 5; i++) { const t = i / 5; const y = 520 + 440 * t; const half = 125 * (1 - t); poly(ctx, [[425 - half, y], [425 + half, y]], false); }
    poly(ctx, [[360, 520], [470, 810]], false); poly(ctx, [[490, 520], [380, 810]], false); poly(ctx, [[425, 520], [425, 960]], false);
    blob(ctx, [[425, 440, 140]]);
    blob(ctx, [[425, 300, 115]]);
    circle(ctx, 425, 170, 32); ctx.beginPath(); ctx.moveTo(430, 140); ctx.quadraticCurveTo(470, 80, 520, 70); ctx.stroke();
    for (const [x, y] of [[360, 280], [470, 255], [420, 340]]) circle(ctx, x, y, 7, true);
    for (const [x, y] of [[340, 440], [440, 410], [505, 470], [400, 490]]) circle(ctx, x, y, 7, true);
    star(ctx, 130, 160, 40); star(ctx, 720, 220, 34); star(ctx, 700, 700, 38); star(ctx, 150, 700, 30);
  },
];

export class SampleSource {
  constructor() {
    this.numPages = SAMPLE_PAGES.length;
  }

  async renderLine(index, longSide) {
    const scale = longSide / H;
    const canvas = newCanvas(Math.round(W * scale), Math.round(H * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.scale(scale, scale);
    setup(ctx);
    SAMPLE_PAGES[index](ctx);
    return canvas;
  }
}
