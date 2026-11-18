// My Library Books: the page.

const STORAGE_KEY = 'my-library-books';

const SAMPLE_BOOKS = [
  { title: 'Pride and Prejudice', author: 'Jane Austen', due: offset(9) },
  { title: 'Moby-Dick', author: 'Herman Melville', due: offset(-12) },
  { title: 'Frankenstein', author: 'Mary Shelley', due: offset(1) },
  { title: 'Walden', author: 'Henry David Thoreau', due: offset(-40) },
  { title: 'Little Women', author: 'Louisa May Alcott', due: offset(20) }
];

// a date n days from today, as YYYY-MM-DD
function offset(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function load() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : SAMPLE_BOOKS;
}

function save(books) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

function statusText(book, now) {
  const left = daysLeft(book.due, now);
  if (left < 0) return 'Overdue by ' + -left + ' days';
  if (left === 0) return 'Due today';
  if (left === 1) return 'Due tomorrow';
  return 'Due in ' + left + ' days';
}

function sumFees(books, now) {
  let total = 0;
  books.forEach((book) => {
    total += lateFee(book.due, now);
  });
  return total;
}

function buildRow(book, now) {
  const fee = lateFee(book.due, now);
  const li = document.createElement('li');
  li.className = isOverdue(book.due, now) ? 'book late' : 'book';
  li.innerHTML =
    '<div><strong>' + book.title + '</strong><span>' + book.author + '</span></div>' +
    '<div class="status">' + statusText(book, now) +
    (fee > 0 ? '<b>$' + fee.toFixed(2) + '</b>' : '') + '</div>' +
    '<button data-title="' + book.title + '">Returned</button>';
  return li;
}

function buildEmpty(message) {
  const li = document.createElement('li');
  li.className = 'empty';
  li.textContent = message;
  return li;
}

// Filter state lives in the DOM only; it is never saved.
const searchEl = document.getElementById('search');
const dueSoonEl = document.getElementById('due-soon');

function render() {
  const now = new Date();
  const all = sortByDue(load());
  const visible = filterBooks(all, searchEl.value, dueSoonEl.checked, now);
  const list = document.getElementById('books');
  list.innerHTML = '';

  if (all.length === 0) {
    list.appendChild(buildEmpty('No books borrowed.'));
  } else if (visible.length === 0) {
    list.appendChild(buildEmpty('No books match your search.'));
  } else {
    visible.forEach((book) => {
      list.appendChild(buildRow(book, now));
    });
  }

  // The total covers every stored book, not just the visible ones.
  const total = sumFees(all, now);
  const totalEl = document.getElementById('total');
  totalEl.textContent = '$' + total.toFixed(2);
  totalEl.parentElement.classList.toggle('high', total > 5);
}

document.getElementById('add').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const books = load();
  books.push({ title: form.title.value, author: form.author.value, due: form.due.value });
  save(books);
  form.reset();
  render();
});

searchEl.addEventListener('input', render);
dueSoonEl.addEventListener('change', render);
dueSoonEl.addEventListener('input', render);

document.getElementById('books').addEventListener('click', (e) => {
  if (e.target.tagName !== 'BUTTON') return;
  save(returnBook(load(), e.target.dataset.title));
  render();
});

render();
