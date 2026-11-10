pdf.js (pdfjs-dist) 4.10.38, the "legacy" build, Apache-2.0. See PDFJS-LICENSE.txt. https://github.com/mozilla/pdf.js
The legacy build is used on purpose: the regular build needs Promise.withResolvers, which Safari only has from iPadOS 17.4,
so on an older iPad the regular build cannot open any PDF. The legacy build includes its own fallbacks.
