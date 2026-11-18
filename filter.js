// My Library Books: search and "due soon" filtering (pure; no DOM or localStorage).
// In the browser, books.js is loaded first and provides isDueSoon as a global.

const DUE_SOON_DAYS = 7;

// Node: take it from books.js. Browser: use the global from books.js.
const dueSoon = typeof module !== 'undefined' ? require('./books.js').isDueSoon : isDueSoon;

// Books whose title or author contains the query (case-insensitive, literal text),
// optionally only those due within DUE_SOON_DAYS. Keeps input order; never mutates.
function filterBooks(books, query, dueSoonOnly, now) {
  const q = String(query || '').trim().toLowerCase();
  return books.filter((book) => {
    if (q) {
      const title = String(book.title || '').toLowerCase();
      const author = String(book.author || '').toLowerCase();
      if (!title.includes(q) && !author.includes(q)) return false;
    }
    if (dueSoonOnly && !dueSoon(book.due, now, DUE_SOON_DAYS)) return false;
    return true;
  });
}

if (typeof module !== 'undefined') {
  module.exports = { DUE_SOON_DAYS, filterBooks };
}
