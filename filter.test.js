const test = require('node:test');
const assert = require('node:assert/strict');
const { DUE_SOON_DAYS, filterBooks } = require('./filter.js');
const { sortByDue } = require('./books.js');

const NOW = '2026-01-31T00:00:00Z';

const BOOKS = [
  { title: 'Pride and Prejudice', author: 'Jane Austen', due: '2026-02-05' },
  { title: 'Dune', author: 'Frank Herbert', due: '2026-01-31' }, // due today
  { title: 'Moby-Dick', author: 'Herman Melville', due: '2026-01-19' }, // overdue
  { title: 'Emma', author: 'Jane Austen', due: '2026-02-07' }, // exactly 7 days
  { title: 'Walden', author: 'Henry David Thoreau', due: '2026-02-08' }, // 8 days
  { title: 'Ulysses (Unabridged)', author: 'James Joyce', due: '' }, // no due date
  { title: 'Dune', author: 'Someone Else', due: '2026-03-01' }, // duplicate title
  { title: 'Notes *draft*', author: 'A. Writer', due: '2026-04-01' }
];

const titles = (list) => list.map((b) => b.title);

test('DUE_SOON_DAYS is 7', () => {
  assert.equal(DUE_SOON_DAYS, 7);
});

test('empty query with the box unchecked returns every book', () => {
  assert.equal(filterBooks(BOOKS, '', false, NOW).length, BOOKS.length);
  assert.equal(filterBooks(BOOKS, undefined, false, NOW).length, BOOKS.length);
});

test('whitespace-only query returns every book', () => {
  assert.equal(filterBooks(BOOKS, '   ', false, NOW).length, BOOKS.length);
});

test('query is trimmed', () => {
  assert.deepEqual(titles(filterBooks(BOOKS, '  austen ', false, NOW)), ['Pride and Prejudice', 'Emma']);
});

test('matches title case-insensitively', () => {
  assert.deepEqual(titles(filterBooks(BOOKS, 'DUNE', false, NOW)), ['Dune', 'Dune']);
});

test('matches author case-insensitively', () => {
  assert.deepEqual(titles(filterBooks(BOOKS, 'herbert', false, NOW)), ['Dune']);
});

test('substring matches', () => {
  assert.deepEqual(titles(filterBooks(BOOKS, 'ride', false, NOW)), ['Pride and Prejudice']);
});

test('regex characters are literal and do not throw', () => {
  assert.deepEqual(titles(filterBooks(BOOKS, '.', false, NOW)), ['Notes *draft*']); // only "A. Writer"
  assert.deepEqual(titles(filterBooks(BOOKS, '(', false, NOW)), ['Ulysses (Unabridged)']);
  assert.deepEqual(titles(filterBooks(BOOKS, '*', false, NOW)), ['Notes *draft*']);
});

test('an HTML query is a literal match', () => {
  assert.deepEqual(filterBooks(BOOKS, '<b>', false, NOW), []);
});

test('no matches returns an empty array', () => {
  assert.deepEqual(filterBooks(BOOKS, 'zzzz', false, NOW), []);
});

test('dueSoonOnly keeps due today and due in 7 days, drops the rest', () => {
  const got = titles(filterBooks(BOOKS, '', true, NOW));
  assert.deepEqual(got, ['Pride and Prejudice', 'Dune', 'Emma']);
  assert.ok(!got.includes('Walden')); // 8 days
  assert.ok(!got.includes('Moby-Dick')); // overdue
  assert.ok(!got.includes('Ulysses (Unabridged)')); // no due date
});

test('query and dueSoonOnly combine with AND', () => {
  assert.deepEqual(titles(filterBooks(BOOKS, 'austen', true, NOW)), ['Pride and Prejudice', 'Emma']);
  assert.deepEqual(titles(filterBooks(BOOKS, 'dune', true, NOW)), ['Dune']); // other Dune is not due soon
});

test('input order is kept', () => {
  const sorted = sortByDue(BOOKS);
  const got = filterBooks(sorted, '', false, NOW);
  assert.deepEqual(got, sorted);
  const soon = filterBooks(sorted, '', true, NOW).map((b) => b.due);
  assert.deepEqual(soon, [...soon].sort());
});

test('duplicate titles that match are both returned', () => {
  assert.equal(filterBooks(BOOKS, 'dune', false, NOW).length, 2);
});

test('does not mutate the input array', () => {
  const copy = BOOKS.map((b) => ({ ...b }));
  filterBooks(BOOKS, 'dune', true, NOW);
  assert.deepEqual(BOOKS, copy);
});

test('missing title or author does not throw', () => {
  const odd = [{ author: 'Nobody', due: '2026-02-01' }, { title: 'Untitled', due: '2026-02-01' }, {}];
  assert.deepEqual(filterBooks(odd, 'nobody', false, NOW), [odd[0]]);
  assert.deepEqual(filterBooks(odd, 'untitled', false, NOW), [odd[1]]);
  assert.doesNotThrow(() => filterBooks(odd, 'x', true, NOW));
});
