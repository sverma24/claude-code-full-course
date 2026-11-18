const test = require('node:test');
const assert = require('node:assert/strict');
const { lateFee, isOverdue, sortByDue } = require('./books.js');

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
