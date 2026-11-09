// Saves books and colors in IndexedDB so progress survives closing the app.
// Everything here fails soft: if storage is blocked (some private modes), the
// app still works, it just forgets things when closed.

const DB_NAME = 'coloring-book';
let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('no indexedDB'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('books', { keyPath: 'id' }); // small records
        db.createObjectStore('files');                    // the PDF bytes, keyed by book id
        db.createObjectStore('paint');                    // PNG of the colors, keyed "<bookId>/<page>"
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch((err) => {
      console.warn('Storage unavailable, progress will not be saved:', err);
      return null;
    });
  }
  return dbPromise;
}

async function run(storeName, mode, fn) {
  const db = await open();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, mode);
      const result = fn(tx.objectStore(storeName));
      tx.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
      tx.onerror = tx.onabort = () => { console.warn('Storage error', tx.error); resolve(undefined); };
    } catch (err) {
      console.warn('Storage error', err);
      resolve(undefined);
    }
  });
}

// Books: { id, name, kind: 'pdf' | 'sample', pageCount, lastPage, thumb?: ArrayBuffer, updated }
export const putBook = (book) => run('books', 'readwrite', (s) => s.put(book));
export const getBook = (id) => run('books', 'readonly', (s) => s.get(id));
export async function listBooks() {
  const all = (await run('books', 'readonly', (s) => s.getAll())) || [];
  return all.sort((a, b) => b.updated - a.updated);
}
export const saveFile = (id, buf) => run('files', 'readwrite', (s) => s.put(buf, id));
export const getFile = (id) => run('files', 'readonly', (s) => s.get(id));
export async function deleteBook(id) {
  await run('books', 'readwrite', (s) => s.delete(id));
  await run('files', 'readwrite', (s) => s.delete(id));
  await run('paint', 'readwrite', (s) => s.delete(IDBKeyRange.bound(`${id}/`, `${id}/￿`)));
}

// Paint layers: PNG bytes keyed "<bookId>/<pageIndex>"
export const savePaint = (bookId, page, buf) => run('paint', 'readwrite', (s) => (buf ? s.put(buf, `${bookId}/${page}`) : s.delete(`${bookId}/${page}`)));
export const getPaint = (bookId, page) => run('paint', 'readonly', (s) => s.get(`${bookId}/${page}`));
