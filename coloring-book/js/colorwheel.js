// A color wheel: angle picks the hue, distance from the center picks how strong the
// color is, and a slider picks dark to bright.

const SIZE = 260; // CSS px

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function hexToHsv(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}

/**
 * Wire up the wheel dialog. Returns { open(hex) }.
 * `onChange(hex)` fires while the person drags, `onDone()` when they close it.
 */
export function setupColorWheel({ root, canvas, dot, slider, swatch, doneButton, onChange, onDone }) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = canvas.height = Math.round(SIZE * dpr);
  const ctx = canvas.getContext('2d');
  const R = (SIZE * dpr) / 2;
  let hsv = { h: 0, s: 0, v: 1 };

  function drawWheel() {
    const img = ctx.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const dx = x + 0.5 - R;
        const dy = y + 0.5 - R;
        const dist = Math.hypot(dx, dy);
        const j = (y * canvas.width + x) * 4;
        if (dist > R) continue;
        const [r, g, b] = hsvToRgb(((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360, Math.min(1, dist / (R - 1)), hsv.v);
        img.data[j] = r;
        img.data[j + 1] = g;
        img.data[j + 2] = b;
        img.data[j + 3] = Math.max(0, Math.min(255, (R - dist) * 255));
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function show() {
    const hex = rgbToHex(hsvToRgb(hsv.h, hsv.s, hsv.v));
    const a = (hsv.h * Math.PI) / 180;
    dot.style.left = `${SIZE / 2 + Math.cos(a) * hsv.s * (SIZE / 2)}px`;
    dot.style.top = `${SIZE / 2 + Math.sin(a) * hsv.s * (SIZE / 2)}px`;
    dot.style.background = hex;
    swatch.style.background = hex;
    slider.style.setProperty('--hue', rgbToHex(hsvToRgb(hsv.h, hsv.s, 1)));
    return hex;
  }

  function pick(e) {
    const r = canvas.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    hsv.h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    hsv.s = Math.min(1, Math.hypot(dx, dy) / (r.width / 2));
    onChange(show());
  }

  let dragging = false;
  canvas.addEventListener('pointerdown', (e) => { dragging = true; canvas.setPointerCapture(e.pointerId); pick(e); });
  canvas.addEventListener('pointermove', (e) => { if (dragging) pick(e); });
  const stop = () => { dragging = false; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  slider.addEventListener('input', () => { hsv.v = slider.value / 100; drawWheel(); onChange(show()); });

  const close = () => { root.hidden = true; onDone(); };
  doneButton.addEventListener('click', close);
  root.addEventListener('pointerdown', (e) => { if (e.target === root) close(); });

  return {
    /** Opens at full brightness so new picks are vivid, unless `keepBrightness` (re-editing a wheel color). */
    open(hex, keepBrightness = false) {
      hsv = hexToHsv(hex);
      if (!keepBrightness) hsv.v = 1;
      slider.value = Math.round(hsv.v * 100);
      drawWheel();
      show();
      root.hidden = false;
    },
  };
}
