const test = require('node:test');
const assert = require('node:assert/strict');
const { daysLeft, lateFee, isOverdue, sortByDue, isDueSoon, returnBook } = require('./books.js');

// Both dates are YYYY-MM-DD strings so they parse as UTC and stay deterministic.
const TODAY = '2026-01-31';
const lateBy = (n) => {
  const d = new Date(Date.parse(TODAY) - n * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
};

test('lateFee: $0.25 per day after the due date', () => {
  assert.equal(lateFee(lateBy(0), TODAY), 0);
  assert.equal(lateFee(lateBy(1), TODAY), 0.25);
  assert.equal(lateFee(lateBy(10), TODAY), 2.5);
});

test('lateFee: not late yet is free', () => {
  assert.equal(lateFee(lateBy(-3), TODAY), 0);
});

test('lateFee: capped at $5.00', () => {
  assert.equal(lateFee(lateBy(20), TODAY), 5);
  assert.equal(lateFee(lateBy(40), TODAY), 5);
});

test('lateFee: missing or invalid due date is $0, not NaN', () => {
  assert.equal(lateFee('', TODAY), 0);
  assert.equal(lateFee(undefined, TODAY), 0);
  assert.equal(lateFee('not-a-date', TODAY), 0);
});

test('isOverdue: missing due date is not overdue', () => {
  assert.equal(isOverdue('', TODAY), false);
});

test('sortByDue: soonest first', () => {
  const books = [
    { title: 'c', due: '2026-03-01' },
    { title: 'a', due: '2026-01-05' },
    { title: 'e', due: '2026-12-25' },
    { title: 'b', due: '2026-02-10' },
    { title: 'd', due: '2026-03-15' }
  ];
  assert.deepEqual(sortByDue(books).map((b) => b.title), ['a', 'b', 'c', 'd', 'e']);
});

test('sortByDue: does not mutate its input', () => {
  const books = [{ due: '2026-02-01' }, { due: '2026-01-01' }];
  sortByDue(books);
  assert.equal(books[0].due, '2026-02-01');
});

test('sortByDue: books with no due date go last', () => {
  const books = [{ title: 'none', due: '' }, { title: 'x', due: '2026-05-01' }, { title: 'y', due: '2026-04-01' }];
  assert.deepEqual(sortByDue(books).map((b) => b.title), ['y', 'x', 'none']);
});

test('sortByDue: equal due dates keep both books', () => {
  const books = [{ title: 'a', due: '2026-01-01' }, { title: 'b', due: '2026-01-01' }];
  assert.equal(sortByDue(books).length, 2);
});

test('returnBook: returning one of two copies of a title keeps the other', () => {
  const books = [
    { title: 'Dune', author: 'Frank Herbert', due: '2026-02-01' },
    { title: 'Dune', author: 'Frank Herbert', due: '2026-02-15' },
    { title: 'Emma', author: 'Jane Austen', due: '2026-02-10' }
  ];
  const result = returnBook(books, 'Dune');
  assert.deepEqual(result.map((b) => b.title), ['Dune', 'Emma']);
  assert.equal(books.length, 3); // input not mutated
});

test('returnBook: unknown title changes nothing', () => {
  const books = [{ title: 'Emma', due: '2026-02-10' }];
  assert.deepEqual(returnBook(books, 'Dune'), books);
});

// isDueSoon uses a fixed UTC timestamp for "today" so results never depend on the clock.
const NOW = '2026-01-31T00:00:00Z';

test('isDueSoon: due within the window is true', () => {
  assert.equal(isDueSoon('2026-02-03', NOW, 7), true);
});

test('isDueSoon: due exactly `days` days away is true', () => {
  assert.equal(isDueSoon('2026-02-07', NOW, 7), true);
});

test('isDueSoon: due beyond the window is false', () => {
  assert.equal(isDueSoon('2026-02-08', NOW, 7), false);
});

test('isDueSoon: due today counts as due soon, not overdue', () => {
  assert.equal(isDueSoon('2026-01-31', NOW, 3), true);
  assert.equal(isDueSoon('2026-01-31', NOW, 0), true);
});

test('isDueSoon: overdue books are never due soon', () => {
  assert.equal(isDueSoon('2026-01-30', NOW, 7), false);
  assert.equal(isDueSoon('2025-12-01', NOW, 7), false);
});

test('isDueSoon: missing or invalid due date is false', () => {
  assert.equal(isDueSoon('', NOW, 7), false);
  assert.equal(isDueSoon(undefined, NOW, 7), false);
  assert.equal(isDueSoon('not-a-date', NOW, 7), false);
});

// Regression: a mid-day "now" must not shift day counts. A book due tomorrow
// said "Due today" and fees started a day early.
const MIDDAY = '2026-03-10T15:00:00Z';

test('daysLeft: mid-day counts calendar days, not elapsed 24h periods', () => {
  assert.equal(daysLeft('2026-03-11', MIDDAY), 1); // due tomorrow
  assert.equal(daysLeft('2026-03-10', MIDDAY), 0); // due today
  assert.equal(daysLeft('2026-03-09', MIDDAY), -1); // due yesterday
});

test('lateFee: mid-day, fee starts the day after the due date', () => {
  assert.equal(lateFee('2026-03-10', MIDDAY), 0); // due today: free
  assert.equal(lateFee('2026-03-09', MIDDAY), 0.25); // one day late
  assert.equal(isOverdue('2026-03-10', MIDDAY), false);
});
