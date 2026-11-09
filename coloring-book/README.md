# Coloring Book

A coloring book app for little hands. Import a black and white PDF, then color it by tapping shapes or painting with a highlighter style brush. Swipe left and right to change pictures.

It is a web app (it also installs to a phone or tablet home screen). There is no account, no ads, and nothing is uploaded anywhere. Your PDFs and colors stay on the device.

## What it does

- **Import a PDF.** Every page becomes a picture. Vector PDFs and scanned or photographed pages both work.
- **Fill.** Tap a color, then tap a shape. The color stops at the lines.
  - A tap that lands on the line itself (easy to do with a small finger) fills the nearest shape.
  - Tiny gaps in a drawing are sealed, so color does not leak out of an almost closed shape.
- **Paint.** A big translucent brush like a highlighter. The black lines always stay visible on top of the color. Three sizes.
- **Erase** and **Undo** (30 steps per page).
- **Swipe between pages.** See the gesture table below. Big arrow buttons and a "pick a picture" grid are always available too.
- **Saves automatically.** Close the app and come back later. The book and every colored page are still there.
- **Works offline** after the first visit.
- **Grown-ups menu.** Hidden behind a press-and-hold lock button so a toddler cannot wander off. It has: all books, add a PDF, save the picture as a PNG (or share it), clear the page, sounds on/off, and "paint brush stays inside the lines".

### Gestures

| Tool | One finger | Two fingers |
| --- | --- | --- |
| Fill | tap = fill, drag sideways = turn the page | turn the page |
| Paint / Erase | drag = draw, drag starting in the margin around the paper = turn the page | turn the page |

A second finger that lands a moment after painting started (like a resting palm) is ignored, so it will not cancel the stroke.

## Run it

You need [Node.js](https://nodejs.org). It was tested on version 22, and there is nothing else to install.

```sh
cd coloring-book
node server.js
```

Open <http://localhost:8080>. The app must be served over http, so opening `index.html` straight from disk will not work.

### Use it on a tablet or phone

Browsers only allow offline mode and "Add to Home Screen" on **HTTPS** (or `localhost`). A `http://192.168.x.x` address on your home network will let you try the app, but it will not install or work offline. To really put it on a tablet, host the `coloring-book` folder on any static host with HTTPS, for example GitHub Pages, Netlify or Cloudflare Pages. It is just static files, so there is no build step. Then open the address on the tablet and choose **Add to Home Screen** (Safari: Share, then Add to Home Screen. Chrome: menu, then Install app).

Installing it to the home screen is also the best way to use it with a toddler, because it opens full screen with no browser bars to tap by accident.

## Project layout

```
index.html        page structure and icons
styles.css        look and layout (phone, tablet, landscape)
js/app.js         screens, swipe gestures, tools, undo, saving
js/fill.js        pure pixel code: line detection, flood fill, gap sealing
js/sources.js     where pages come from: PDF (pdf.js) and the built-in sample book
js/store.js       IndexedDB storage for books and colors
lib/              pdf.js 4.10.38 (Apache-2.0), bundled so it works offline
sw.js             offline cache (bump CACHE when you change app files)
server.js         tiny local web server
test/             unit tests for the fill code
```

### How the layers work

Each page is two canvases stacked on a white sheet: your **color layer** at the bottom and the **line art** on top. The PDF page is rendered to a canvas, then converted so that black becomes lines and white becomes transparent. Because the lines sit above the color, nothing you paint can cover them. That is what gives the highlighter effect.

## Tests

```sh
npm test
```

Unit tests cover the fill logic: staying inside a shape, not leaking through a small gap, snapping from a tap on a line, and speed.

## Known limits

- No zoom. Very detailed pages (mandalas with hundreds of tiny shapes) are hard to fill with a finger.
- Fill treats every enclosed area as one shape. A PDF whose lines are very faint or broken by wide gaps will leak. In that case use the Paint brush with "stays inside the lines" switched on, or paint by hand.
- Colors are saved per device and browser. Clearing the browser's site data erases them.
- Page images are rendered at about 1800 pixels on the long side. Pages with very different aspect ratios are fitted to the screen.
- The palm rejection (ignoring a large touch contact) is a best effort that depends on what the device reports.

## Credits

PDF rendering by [pdf.js](https://github.com/mozilla/pdf.js) from Mozilla, included under the Apache License 2.0 (see `lib/PDFJS-LICENSE.txt`).
