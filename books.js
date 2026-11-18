// My Library Books: the rules for due dates and late fees.

const FEE_PER_DAY = 0.25; // dollars
const FEE_CAP = 5.0; // never charge more than this per book
const DAY = 24 * 60 * 60 * 1000;

// Whole days from today until the due date. Negative means late.
function daysLeft(dueDate, today) {
  return Math.floor((new Date(dueDate) - new Date(today)) / DAY);
}

function isOverdue(dueDate, today) {
  return daysLeft(dueDate, today) < 0;
}

// True when due within the next `days` days (today included) and not overdue.
// A missing or invalid due date gives NaN, so every comparison is false.
function isDueSoon(dueDate, today, days) {
  const left = daysLeft(dueDate, today);
  return left >= 0 && left <= days;
}

// 25 cents for every day after the due date.
function lateFee(dueDate, today) {
  const daysLate = -daysLeft(dueDate, today);
  if (!(daysLate > 0)) return 0; // also catches NaN (missing/invalid due date)
  return Math.min(daysLate * FEE_PER_DAY, FEE_CAP);
}

// Soonest due first.
function sortByDue(books) {
  const key = (b) => b.due || '9999-12-31'; // no date sorts last
  return books.slice().sort((a, b) => key(a).localeCompare(key(b)));
}

// Remove just one copy of a title (the first match), leaving duplicates alone.
function returnBook(books, title) {
  const i = books.findIndex((b) => b.title === title);
  return i === -1 ? books : books.filter((_, j) => j !== i);
}

if (typeof module !== 'undefined') {
  module.exports = { FEE_PER_DAY, FEE_CAP, daysLeft, isOverdue, isDueSoon, lateFee, sortByDue, returnBook };
}
