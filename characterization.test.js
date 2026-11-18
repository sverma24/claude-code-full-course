// Characterization tests: pin down what daysLeft and statusText do TODAY.
// These record current behavior, not intended behavior. Where a result looks
// like a bug, the assertion keeps the current value and a BUG? comment says why.
//
// "Now" is always a fixed UTC timestamp, so nothing depends on the clock.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { daysLeft } = require('./books.js');

// statusText lives in app.js, which touches the DOM when loaded and exports
// nothing. Pull just that function's source out and run it in a sandbox
// that has daysLeft, without modifying app.js.
const appSource = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const match = appSource.match(/function statusText[\s\S]*?\n}\n/);
assert.ok(match, 'could not find statusText in app.js');
const sandbox = { daysLeft };
vm.runInNewContext(match[0], sandbox);
const statusText = sandbox.statusText;

const utc = (s) => new Date(s);
const MIDNIGHT = utc('2026-03-10T00:00:00Z');
const AFTERNOON = utc('2026-03-10T15:00:00Z');

test('daysLeft: exact whole-day differences at midnight UTC', () => {
  assert.equal(daysLeft('2026-03-10', MIDNIGHT), 0); // due today
  assert.equal(daysLeft('2026-03-11', MIDNIGHT), 1);
  assert.equal(daysLeft('2026-03-20', MIDNIGHT), 10);
  assert.equal(daysLeft('2026-03-09', MIDNIGHT), -1);
  assert.equal(daysLeft('2026-03-05', MIDNIGHT), -5);
});

test('daysLeft: accepts a Date or a string for "today"', () => {
  assert.equal(daysLeft('2026-03-11', '2026-03-10'), 1);
  assert.equal(daysLeft('2026-03-11', MIDNIGHT.getTime()), 1);
});

test('daysLeft: due today later in the day is still 0', () => {
  // Fixed: this used to be -1 (book due today read as late) because elapsed
  // time was floored. Day counts now compare calendar days.
  assert.equal(daysLeft('2026-03-10', AFTERNOON), 0);
});

test('daysLeft: later-in-the-day readings are not shifted', () => {
  // Fixed: these used to be 0, -2 and 9; the time of day no longer matters.
  assert.equal(daysLeft('2026-03-11', AFTERNOON), 1);
  assert.equal(daysLeft('2026-03-09', AFTERNOON), -1);
  assert.equal(daysLeft('2026-03-20', AFTERNOON), 10);
});

test('daysLeft: a full-timestamp due date is not treated as date-only', () => {
  assert.equal(daysLeft('2026-03-10T12:00:00Z', MIDNIGHT), 0); // 12h ahead
  assert.equal(daysLeft('2026-03-09T12:00:00Z', MIDNIGHT), -1); // 12h behind
});

test('daysLeft: empty, missing or invalid due date is NaN', () => {
  assert.ok(Number.isNaN(daysLeft('', MIDNIGHT)));
  assert.ok(Number.isNaN(daysLeft(undefined, MIDNIGHT)));
  assert.ok(Number.isNaN(daysLeft('not a date', MIDNIGHT)));
});

test('statusText: due today (at midnight UTC)', () => {
  assert.equal(statusText({ due: '2026-03-10' }, MIDNIGHT), 'Due today');
});

test('statusText: due tomorrow and later', () => {
  assert.equal(statusText({ due: '2026-03-11' }, MIDNIGHT), 'Due tomorrow');
  assert.equal(statusText({ due: '2026-03-12' }, MIDNIGHT), 'Due in 2 days');
  assert.equal(statusText({ due: '2026-03-20' }, MIDNIGHT), 'Due in 10 days');
});

test('statusText: one day late', () => {
  // BUG? Grammar: "1 days". There is no singular branch for overdue.
  assert.equal(statusText({ due: '2026-03-09' }, MIDNIGHT), 'Overdue by 1 days');
});

test('statusText: several days late', () => {
  assert.equal(statusText({ due: '2026-03-05' }, MIDNIGHT), 'Overdue by 5 days');
});

test('statusText: due today, checked in the afternoon, says due today', () => {
  // Fixed: used to say 'Overdue by 1 days' because daysLeft was -1.
  assert.equal(statusText({ due: '2026-03-10' }, AFTERNOON), 'Due today');
});

test('statusText: due tomorrow, checked in the afternoon, says due tomorrow', () => {
  // Fixed: used to say 'Due today' because daysLeft was 0. This is the report.
  assert.equal(statusText({ due: '2026-03-11' }, AFTERNOON), 'Due tomorrow');
});

test('statusText: empty due date', () => {
  // BUG? NaN falls through every comparison, so the text is nonsense.
  assert.equal(statusText({ due: '' }, MIDNIGHT), 'Due in NaN days');
});

test('statusText: missing due date', () => {
  // BUG? Same as the empty string.
  assert.equal(statusText({}, MIDNIGHT), 'Due in NaN days');
});
