# Coloring Book

A coloring book app for little hands. Import a black and white PDF, then color it by tapping shapes or painting with a highlighter style brush. Swipe left and right to change pictures.

It is a web app (it also installs to a phone or tablet home screen). There is no account, no ads, and nothing is uploaded anywhere. Your PDFs and colors stay on the device.

## What it does

- **Import a PDF.** Every page becomes a picture. Vector PDFs and scanned or photographed pages both work.
- **Fill.** Tap a color, then tap a shape. The color stops at the lines.
  - A tap that lands on the line itself (easy to do with a small finger) fills the nearest shape.
  - Gaps in the lines are handled. If a shape is almost closed (a gap up to about 0.1 inch on a letter page) the fill stays inside the shape. Tapping the background does not flood into such a shape either.
- **Paint tools.** Pick a texture, a color and one of three sizes. The black lines always stay visible on top of the color.
  - **Paint**: a translucent highlighter.
  - **Spray**: a speckled spray can. Hold still and it gets denser.
  - **Roller**: a wide flat ribbon with paint streaks.
  - **Crayon**: waxy and grainy, the paper shows through.
  - **Sparkle**: a trail of little stars and dots.
- **Color wheel.** Tap the rainbow circle to pick any color, and slide from dark to bright.
- **Erase** and **Undo** (30 steps per page).
- **Save** (download arrow) saves the page as a PNG, or opens the share sheet where the device has one. **Clear** (trash can) wipes the page and needs a press and hold. Undo brings the page back.
- **Swipe between pages.** See the gesture table below. Big arrow buttons and a "pick a picture" grid are always available too.
- **Saves automatically.** Close the app and come back later. The book and every colored page are still there.
- **Works offline** after the first visit.
- **Grown-ups menu.** Hidden behind a press-and-hold lock button so a toddler cannot wander off. It has: all books, add a PDF, save the picture, clear the page, sounds on/off, and "painting tools stay inside the lines".

### Gestures

| Tool | One finger | Two fingers |
| --- | --- | --- |
| Fill | tap = fill, drag sideways = turn the page | turn the page |
| Paint tools / Erase | drag = draw, drag starting in the margin around the paper = turn the page | turn the page |

Nothing moves the page until a finger has traveled about 48 pixels sideways, so the wobble of a small hand tapping or scribbling never nudges it. A second finger that only rests on the screen (like a palm) is ignored. Two fingers must both move the same way to count as a swipe.

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
js/app.js         screens, swipe gestures, strokes, undo, saving
js/brushes.js     the tool list and how each texture is drawn
js/colorwheel.js  the color wheel dialog
js/fill.js        pure pixel code: line detection, flood fill, gap closing
js/sources.js     where pages come from: PDF (pdf.js) and the built-in sample book
js/store.js       IndexedDB storage for books and colors
lib/              pdf.js 4.10.38 (Apache-2.0), bundled so it works offline
sw.js             offline cache (bump CACHE when you change app files)
server.js         tiny local web server
test/             unit tests for the fill code
```

### How the layers work

Each page is two canvases stacked on a white sheet: your **color layer** at the bottom and the **line art** on top. The PDF page is rendered to a canvas, then converted so that black becomes lines and white becomes transparent. Because the lines sit above the color, nothing you paint can cover them. That is what gives the highlighter effect.

## Adding to it

- **A new brush or texture.** Add an entry to `TOOLS` in `js/brushes.js` (name, icon, sizes, how it blends) and an icon symbol in `index.html`. If it needs its own look, handle its `id` in `dot()` and `seg()`. The toolbar, undo, saving and "stay inside the lines" all pick it up with no other changes.
- **A new source of pages.** Anything with `numPages` and `renderLine(index, longSide)` that returns a canvas of black art on white works. See `js/sources.js`.
- **A new color.** Edit `COLORS` at the top of `js/app.js`.
- **Pages shipped inside the app** (for example a starter pack): add a source class like `SampleSource`, or bundle PDFs and open them through `PdfSource`.

## Tests

```sh
npm test
```

Unit tests cover the fill logic: staying inside a shape, not leaking through a gap in either direction, snapping from a tap on a line, and speed.

## Known limits

- No zoom. Very detailed pages (mandalas with hundreds of tiny shapes) are hard to fill with a finger.
- Fill treats every enclosed area as one shape. Gaps wider than about 0.1 inch (on a letter-size page) are not closed, so a shape with a big opening will still leak. The same gap closing means a very narrow corridor between two shapes is treated as closed too.
- Colors are saved per device and browser. Clearing the browser's site data erases them.
- Page images are rendered at about 1800 pixels on the long side. Pages with very different aspect ratios are fitted to the screen.
- The palm rejection (ignoring a large touch contact) is a best effort that depends on what the device reports.

## Credits

PDF rendering by [pdf.js](https://github.com/mozilla/pdf.js) from Mozilla, included under the Apache License 2.0 (see `lib/PDFJS-LICENSE.txt`).

## Publish with GitHub Pages

The workflow in `.github/workflows/coloring-book-pages.yml` publishes this folder whenever changes to it land on the repo's default branch. One-time setup: in the repo go to **Settings, Pages, Build and deployment** and set **Source** to **GitHub Actions**. The address will be `https://<your-user>.github.io/<repo-name>/`. You can also run it by hand from the **Actions** tab.
