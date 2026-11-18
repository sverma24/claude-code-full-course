// My Library Books: build an iCalendar (.ics) file. Pure logic, no DOM or storage.

function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function icsDate(s) {
  return s.replace(/-/g, '');
}

function pad(n, w) {
  return String(n).padStart(w, '0');
}

// The day after a YYYY-MM-DD date, as YYYYMMDD (calendar arithmetic, no time zones).
function nextDay(s) {
  let [y, m, d] = s.split('-').map(Number);
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  d += 1;
  if (d > dim) { d = 1; m += 1; }
  if (m > 12) { m = 1; y += 1; }
  return pad(y, 4) + pad(m, 2) + pad(d, 2);
}

function escapeText(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

// Fold to at most 75 octets per physical line, never splitting a code point.
function foldLine(line) {
  const enc = new TextEncoder();
  const out = [];
  let cur = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) {
      out.push(cur);
      cur = '';
      bytes = 0;
      limit = 74; // continuation lines start with one space
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

function uid(book, n) {
  return hash(book.title + '|' + book.author + '|' + book.due) + '-' + n + '@my-library-books';
}

function stamp(now) {
  return new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

// Returns the .ics text, or null when no book has a valid due date.
function buildIcs(books, now) {
  const dated = (books || []).filter((b) => isValidDate(b.due));
  if (dated.length === 0) return null;

  const seen = {};
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//My Library Books//EN'];
  dated.forEach((b) => {
    const key = b.title + '|' + b.author + '|' + b.due;
    seen[key] = (seen[key] || 0) + 1;
    lines.push(
      'BEGIN:VEVENT',
      'UID:' + uid(b, seen[key]),
      'DTSTAMP:' + stamp(now),
      'DTSTART;VALUE=DATE:' + icsDate(b.due),
      'DTEND;VALUE=DATE:' + nextDay(b.due),
      'SUMMARY:' + escapeText('Return: ' + (b.title || '')),
      'DESCRIPTION:' + escapeText('Author: ' + (b.author || '')),
      'END:VEVENT'
    );
  });
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

if (typeof module !== 'undefined') {
  module.exports = { isValidDate, icsDate, nextDay, escapeText, foldLine, buildIcs };
}
