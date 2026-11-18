# Plan: build SPEC.md as two parallel pieces

## Context

SPEC.md specifies two features: **search/filter** and **calendar export**. We want two agents to build them at the same time in separate git worktrees, each test-first, without editing the same functions, and then merge both into `main` cleanly.

The main collision risk is that SPEC.md puts all pure logic in `books.js` and all tests in `books.test.js`. If both agents append to those files, they both edit the end of `books.js` and its single `module.exports` line, so the merge would conflict. To avoid that, **each piece gets its own pure-logic file and test file.** They follow the same pattern as `books.js`: a plain browser global plus a guarded `module.exports`, with no DOM or `localStorage` access. This is a small departure from the letter of SPEC.md and CLAUDE.md, so the merge step updates CLAUDE.md to record it.

## File ownership

| File | Piece A: Search & filter | Piece B: Calendar export |
| --- | --- | --- |
| `filter.js` (new, pure) | **owns** | — |
| `filter.test.js` (new) | **owns** | — |
| `ics.js` (new, pure) | — | **owns** |
| `ics.test.js` (new) | — | **owns** |
| `export.js` (new, DOM wiring for download) | — | **owns** |
| `app.js` | **owns** (`render`, new listeners) | does not touch |
| `index.html` | adds controls *above* `<ul id="books">` + `filter.js` script tag right after `books.js` | adds button *below* `<p class="total">` + `ics.js`/`export.js` script tags after `app.js` |
| `style.css` | appends a `/* search & filter */` block at the end | — (uses the existing `button` style) |
| `books.js`, `books.test.js` | read-only (reuses `isDueSoon`, `sortByDue`) | read-only |

The only shared file is `index.html`, and each piece edits a different region of it, separated by unchanged lines. Neither piece changes an existing function in `books.js`. Piece B never touches `app.js`: `export.js` runs after `app.js` and calls its global `load()`.

**Must not change:** `statusText` in `app.js`. `characterization.test.js` pulls that function's source out of `app.js` with a regex.

---

## Piece A: Search and filter (branch `feature/search-filter`)

### A1. Tests first: `filter.test.js` (write these and watch them fail)

Use `require('./filter.js')` and a fixed `NOW = '2026-01-31T00:00:00Z'`, the same constant `books.test.js` uses for `isDueSoon`. Fixture: a small list that includes duplicate titles, a book with no `due`, an overdue book, a book due today, one due in exactly 7 days, and one due in 8 days.

Cases for `filterBooks(books, query, dueSoonOnly, now)`:
- Empty query, with the box unchecked, returns every book. A whitespace-only query does the same.
- A query with spaces before or after it is trimmed (`'  austen '` matches).
- Matching is case-insensitive on the title (`'DUNE'`) and on the author (`'herbert'`).
- A substring matches (`'ride'` → "Pride and Prejudice").
- Regex characters are literal: `'.'` and `'('` and `'*'` match only titles that contain them, and don't throw.
- An HTML query `'<b>'` is a literal match and returns nothing for normal books.
- No matches returns `[]`.
- `dueSoonOnly`: keeps the books due today and in 7 days. Excludes the ones due in 8 days, overdue, or with no due date.
- Query AND `dueSoonOnly` combine.
- Input order is kept: `filterBooks(sortByDue(x), …)` stays sorted.
- Duplicate titles that match are both returned.
- The input array is not mutated.
- Books with a missing `title` or `author` don't throw.

### A2. Implement `filter.js`

- `DUE_SOON_DAYS = 7`.
- `filterBooks(books, query, dueSoonOnly, now)`:
  - `q = String(query || '').trim().toLowerCase()`.
  - `books.filter(...)`: if `q` is non-empty, `(title||'').toLowerCase().includes(q) || (author||'').toLowerCase().includes(q)`. No regex.
  - If `dueSoonOnly`, also require `isDueSoon(book.due, now, DUE_SOON_DAYS)`, which reuses the global from `books.js`. In Node, `require('./books.js')` inside a `typeof module` guard.
- Guarded `module.exports = { DUE_SOON_DAYS, filterBooks }`.

### A3. Wire up (`index.html`, `app.js`, `style.css`)

- `index.html`: add `<div class="filters">` before `<ul id="books">`. It holds `<label>Search <input id="search" type="search"></label>` and `<label><input id="due-soon" type="checkbox"> Due soon</label>`. Add `<script src="filter.js"></script>` between `books.js` and `app.js`.
- `app.js` `render()`:
  - `all = sortByDue(load())`.
  - Build `visible = filterBooks(all, searchEl.value, dueSoonEl.checked, now)`. The filter state is read from the DOM and never persisted.
  - If `all` is empty, show an empty-state `<li class="empty">` ("No books borrowed."). The code has no empty state today, so this adds one.
  - Otherwise, if `visible` is empty, show `<li class="empty">No books match your search.</li>`. Set this text with `textContent`.
  - The total still uses `sumFees(all, now)`, not the visible books.
- Add `input` listeners on `#search` and `change`/`input` listeners on `#due-soon`. Each one calls `render()`.
- The existing "Returned" handler already calls `render()`, so the filters stay applied after a return.
- `style.css`: append the `.filters` and `.empty` rules. The checkbox needs `width:auto; display:inline` because the global `input` rule sets `width:100%`.

---

## Piece B: Calendar export (branch `feature/calendar-export`)

### B1. Tests first: `ics.test.js` (write these and watch them fail)

Use `require('./ics.js')` and a fixed `NOW = '2026-01-31T00:00:00Z'`. Split the output on `\r\n` for the line assertions.

Unit helpers:
- `icsDate('2026-03-05')` → `'20260305'`.
- `nextDay`: `'2026-03-05'`→`'20260306'`, `'2026-12-31'`→`'20270101'`, `'2028-02-29'`→`'20280301'`, `'2026-02-28'`→`'20260301'`.
- `isValidDate`: true for `'2026-03-05'`. False for `''`, `undefined`, `'not-a-date'`, `'2026-02-30'`, `'2026-13-01'`.
- `escapeText`: `\`→`\\`, `;`→`\;`, `,`→`\,`, a newline (`\n`, `\r\n`) → literal `\n`. The backslash is escaped first, so it is not double-escaped.
- `foldLine`:
  - A line of 75 octets or fewer is unchanged.
  - A longer line is split so every physical line is at most 75 octets, and continuation lines start with one space.
  - Unfolding (remove `\r\n `) gives back the original.
  - Lines made of `é`, CJK, and emoji never split a multi-byte character. Check that each piece is valid UTF-8, i.e. `Buffer.from(piece).toString() === piece`, and that its byte length is at most 75.

`buildIcs(books, now)`:
- Starts with `BEGIN:VCALENDAR`, `VERSION:2.0`, `PRODID:…`. Ends with `END:VCALENDAR`. Every line ends with CRLF, and there is no bare `\n`.
- Writes one `VEVENT` for each book that has a valid date. A book with an empty, missing, or invalid date is skipped.
- Each event has `DTSTART;VALUE=DATE:` set to the due date and `DTEND;VALUE=DATE:` set to the next day.
- `SUMMARY:Return: <escaped title>`. `DESCRIPTION` contains the escaped author. `DTSTAMP` is derived from `now` (`20260131T000000Z`).
- An overdue book is exported on its past date.
- Duplicate title+author+due → two events with **different** UIDs.
- UIDs are **stable**: calling it twice with the same input gives the same UIDs.
- A title with `,;\` and a newline is escaped. A long title is folded, and the summary comes back the same after unfolding.
- Returns `null` when there are no books, or when no book has a valid date. That is the "Nothing to export" signal.

### B2. Implement `ics.js`

- `isValidDate(s)`: `/^\d{4}-\d{2}-\d{2}$/` plus a round-trip check on the year, month and day parts. That rejects dates like `2026-02-30`.
- `icsDate(s)` strips the dashes. `nextDay(s)` does integer calendar arithmetic on the year/month/day parts (days in month, leap year) and returns `YYYYMMDD`.
- `escapeText(s)`: replace in order `\\`, `;`, `,`, then `\r\n|\r|\n` → `\\n`.
- `foldLine(line)`: walk the string by code point (`for…of`), track the UTF-8 byte length with `TextEncoder`, and break before a code point that would push the line past 75 octets. The first line gets 75 octets and continuation lines get 74 plus the leading space.
- `uid(book, n)`: a small deterministic string hash (djb2) of `title|author|due`, plus an occurrence counter `n` for identical tuples → `<hash>-<n>@my-library-books`.
- `buildIcs(books, now)`:
  - Filter to valid dates, then build the lines.
  - Run every content line through `foldLine`, then join with `\r\n` and add a trailing `\r\n`.
  - Returns `null` when there are no events.
- Guarded `module.exports`.

### B3. Wire up (`index.html`, `export.js`)

- `index.html`: after `<p class="total">`, add `<p class="export"><button id="export" type="button">Export due dates</button> <span id="export-msg" role="status"></span></p>`. After the `app.js` script tag, add `<script src="ics.js"></script><script src="export.js"></script>`.
- `export.js`: a click handler that runs `ics = buildIcs(load(), new Date())`.
  - If `ics` is `null`, set `#export-msg.textContent = 'Nothing to export'` and don't download anything.
  - Otherwise create a `Blob([ics], {type: 'text/calendar;charset=utf-8'})`, then use an object URL and a temporary `<a download="books.ics">` to click, then revoke the URL.
  - It always uses `load()` (all stored books), so filters never affect the export.

---

## Running in parallel and merging

1. Both worktrees branch from the current `main` (`fd6ce33`). Each agent works only on its own branch.
2. In each worktree, commit the failing tests first (`test: …`), then the implementation, then the wiring. `npm test` must pass before handing off. It picks up the new `*.test.js` files automatically.
3. **Merge order:** merge `feature/search-filter` into `main` first, then `feature/calendar-export`.
   - The only file both pieces touch is `index.html`, and they edit separate regions. If git flags the script-tag block anyway, the fix is to keep both, in this order: `books.js`, `filter.js`, `app.js`, `ics.js`, `export.js`.
4. Post-merge commit on `main`: update CLAUDE.md
   - Architecture: list `filter.js`, `ics.js` and `export.js`, and their load order.
   - Tests: mention `filter.test.js` and `ics.test.js`.
   - "Next features": mark both as done.

## Verification

- `npm test` passes in each worktree, and again on `main` after both merges. That run covers `books.test.js`, `characterization.test.js`, `filter.test.js` and `ics.test.js`.
- Manual check in `index.html` after merging:
  - Typing in Search filters the list live, and the "Due soon" checkbox narrows it further.
  - With nothing matching, the list shows the "no matches" message, and the total doesn't change.
  - "Returned" removes one book and keeps the filters.
  - "Export due dates" downloads `books.ics`, and the downloaded file still includes books hidden by a filter.
  - Clearing all books shows the empty state, and Export shows "Nothing to export".
- Import `books.ics` into a calendar app. Each book should appear as an all-day event on its due date, and re-importing it should not create duplicates.
