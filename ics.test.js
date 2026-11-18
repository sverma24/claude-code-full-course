const test = require('node:test');
const assert = require('node:assert');
const { icsDate, nextDay, isValidDate, escapeText, foldLine, buildIcs } = require('./ics.js');

const NOW = '2026-01-31T00:00:00Z';
const lines = (s) => s.split('\r\n');
const unfold = (s) => s.replace(/\r\n /g, '');

test('icsDate strips dashes', () => {
  assert.strictEqual(icsDate('2026-03-05'), '20260305');
});

test('nextDay handles month, year and leap boundaries', () => {
  assert.strictEqual(nextDay('2026-03-05'), '20260306');
  assert.strictEqual(nextDay('2026-12-31'), '20270101');
  assert.strictEqual(nextDay('2028-02-29'), '20280301');
  assert.strictEqual(nextDay('2026-02-28'), '20260301');
});

test('isValidDate', () => {
  assert.strictEqual(isValidDate('2026-03-05'), true);
  for (const bad of ['', undefined, 'not-a-date', '2026-02-30', '2026-13-01']) {
    assert.strictEqual(isValidDate(bad), false, String(bad));
  }
});

test('escapeText', () => {
  assert.strictEqual(escapeText('a\\b'), 'a\\\\b');
  assert.strictEqual(escapeText('a;b'), 'a\\;b');
  assert.strictEqual(escapeText('a,b'), 'a\\,b');
  assert.strictEqual(escapeText('a\nb'), 'a\\nb');
  assert.strictEqual(escapeText('a\r\nb'), 'a\\nb');
});

test('foldLine leaves short lines alone', () => {
  const s = 'x'.repeat(75);
  assert.strictEqual(foldLine(s), s);
});

test('foldLine folds long lines at 75 octets and round-trips', () => {
  const s = 'SUMMARY:' + 'x'.repeat(300);
  const folded = foldLine(s);
  const parts = folded.split('\r\n');
  assert.ok(parts.length > 1);
  parts.forEach((p, i) => {
    assert.ok(Buffer.byteLength(p) <= 75);
    if (i > 0) assert.ok(p.startsWith(' '));
  });
  assert.strictEqual(unfold(folded), s);
});

test('foldLine never splits multi-byte characters', () => {
  for (const ch of ['é', '日', '😀']) {
    const s = 'SUMMARY:' + ch.repeat(100);
    const folded = foldLine(s);
    folded.split('\r\n').forEach((p) => {
      assert.strictEqual(Buffer.from(p).toString(), p);
      assert.ok(Buffer.byteLength(p) <= 75);
    });
    assert.strictEqual(unfold(folded), s);
  }
});

const book = (o) => Object.assign({ title: 'Dune', author: 'Frank Herbert', due: '2026-03-05' }, o);

test('buildIcs has a valid calendar envelope with CRLF endings', () => {
  const out = buildIcs([book()], NOW);
  const l = lines(out);
  assert.strictEqual(l[0], 'BEGIN:VCALENDAR');
  assert.strictEqual(l[1], 'VERSION:2.0');
  assert.ok(l[2].startsWith('PRODID:'));
  assert.strictEqual(l[l.length - 2], 'END:VCALENDAR');
  assert.strictEqual(l[l.length - 1], '');
  assert.ok(!/(^|[^\r])\n/.test(out));
});

test('buildIcs writes an all-day event per dated book', () => {
  const out = buildIcs([book(), book({ title: 'Emma', due: '' }), book({ title: 'X', due: 'bad' }), { title: 'Y' }], NOW);
  assert.strictEqual(lines(out).filter((x) => x === 'BEGIN:VEVENT').length, 1);
  assert.ok(out.includes('DTSTART;VALUE=DATE:20260305\r\n'));
  assert.ok(out.includes('DTEND;VALUE=DATE:20260306\r\n'));
  assert.ok(out.includes('SUMMARY:Return: Dune\r\n'));
  assert.ok(out.includes('DESCRIPTION:') && out.includes('Frank Herbert'));
  assert.ok(out.includes('DTSTAMP:20260131T000000Z\r\n'));
});

test('buildIcs exports overdue books on their past date', () => {
  const out = buildIcs([book({ due: '2025-01-02' })], NOW);
  assert.ok(out.includes('DTSTART;VALUE=DATE:20250102'));
});

const uids = (out) => lines(out).filter((x) => x.startsWith('UID:'));

test('duplicate books get different, stable UIDs', () => {
  const books = [book(), book()];
  const a = uids(buildIcs(books, NOW));
  const b = uids(buildIcs(books, NOW));
  assert.strictEqual(a.length, 2);
  assert.notStrictEqual(a[0], a[1]);
  assert.deepStrictEqual(a, b);
});

test('buildIcs escapes and folds titles', () => {
  const title = 'A,B;C\\D\nE ' + 'long '.repeat(40);
  const out = buildIcs([book({ title })], NOW);
  assert.ok(out.includes('SUMMARY:Return: A\\,B\\;C\\\\D\\nE'));
  const summary = lines(unfold(out)).find((x) => x.startsWith('SUMMARY:'));
  assert.strictEqual(summary, 'SUMMARY:Return: ' + escapeText(title));
  lines(out).forEach((p) => assert.ok(Buffer.byteLength(p) <= 75));
});

test('buildIcs returns null when nothing is exportable', () => {
  assert.strictEqual(buildIcs([], NOW), null);
  assert.strictEqual(buildIcs([book({ due: '' }), { title: 'x' }], NOW), null);
});
