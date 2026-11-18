# SPEC: Search/filter and calendar export

Two new features for My Library Books. This is a spec only; no code yet.

## Shared decisions

- Pure logic goes in `books.js` (no DOM or `localStorage`) and is unit-tested in `books.test.js`; wiring goes in `app.js` and `index.html`.
- Filtering is a view concern only. It never changes what is stored in `localStorage`.
- Filter state (search text, checkbox) is not persisted; a reload starts unfiltered.
- A book's `due` is a calendar date string (`YYYY-MM-DD`) and may be empty or missing.
- Do not build new markup from unescaped `title`/`author` (see "Known issues" in CLAUDE.md). Use `textContent` or escape.

---

## Feature 1: Search and filter

A search box filters the list by title or author as you type. A "Due soon" checkbox keeps only books due within 7 days.

### Acceptance criteria

1. A text input labelled "Search" sits above the book list. A checkbox labelled "Due soon" sits next to it.
2. On every `input` event the list re-renders with no submit button or Enter key needed.
3. A book matches the search when the query is a case-insensitive substring of its title or its author.
4. With "Due soon" checked, only books for which `isDueSoon(book.due, now, 7)` is true are shown. Overdue books are excluded, because `isDueSoon` excludes them.
5. Search and "Due soon" combine with AND.
6. Sort order (soonest due first) is preserved in the filtered list.
7. The "Returned" button still removes exactly one book from storage and the list re-renders with the current filters still applied.
8. The late-fee total keeps showing the fees for all stored books, not just visible ones. Filtering hides rows only.
9. The matching logic is a pure function (for example `filterBooks(books, query, dueSoonOnly, now)`) with unit tests for the cases below.

### Edge cases

| Case | Expected behavior |
| --- | --- |
| Empty search | Same as no search: all books shown (subject to the checkbox). |
| Whitespace-only search | Trimmed to empty, so treated as an empty search. |
| Leading or trailing spaces in a query | Trimmed before matching. |
| No matches | The list shows a single "No books match your search." message, not a blank area. The total is unaffected. |
| Library is empty (no stored books) | Show the existing empty state, not the "no matches" message. |
| Book with no due date | Never matches "Due soon" (`isDueSoon` returns false for a missing or invalid date). Still shown when the checkbox is off and the search matches. |
| Query contains regex characters (`.`, `(`, `*`) | Treated as literal text. No regex is built from user input. |
| Query contains HTML (`<b>`) | Treated as literal text and never injected into the page. |
| Book due today | Included by "Due soon" (0 days left). |
| Book due in exactly 7 days | Included. Due in 8 days is excluded. |
| Duplicate titles | Both shown if they match. Returning one removes only one. |
| Last matching book is returned | Filters stay active and the "no matches" message appears. |

---

## Feature 2: Calendar export

An "Export due dates" button downloads `books.ics` with one all-day event per book on its due date.

### Acceptance criteria

1. An "Export due dates" button is visible near the list.
2. Clicking it downloads a file named `books.ics` with MIME type `text/calendar`.
3. The file is a valid iCalendar document: `BEGIN:VCALENDAR`, `VERSION:2.0`, a `PRODID`, one `VEVENT` per exported book, then `END:VCALENDAR`. Lines end with CRLF.
4. Each event is all-day:
   - `DTSTART;VALUE=DATE:YYYYMMDD` is the due date.
   - `DTEND;VALUE=DATE:YYYYMMDD` is the day after the due date (the end of an all-day event is exclusive).
5. Each event has `SUMMARY` set to something like `Return: <title>`, a `DESCRIPTION` that includes the author, a `DTSTAMP`, and a stable, unique `UID` (so re-importing does not create duplicates).
6. Text values escape backslash, semicolon, comma and newline per RFC 5545, and long lines are folded.
7. The export covers all stored books that have a due date, regardless of the current search or "Due soon" filter.
8. Building the file content is a pure function (for example `buildIcs(books, now)`) with unit tests. Only the download wiring touches the DOM.

### Edge cases

| Case | Expected behavior |
| --- | --- |
| Book with no due date (empty or missing) | Skipped. No event is written with a blank or invalid date. |
| Invalid date string | Skipped, same as no date. |
| No books at all, or no book has a date | The button does nothing except show a short "Nothing to export" message. No empty file is downloaded. |
| Overdue book | Exported on its past due date as normal. |
| Title or author contains `,` `;` `\` or a newline | Escaped so the file still parses. |
| Very long title | Line folded at 75 octets. Content is unchanged after unfolding. |
| Non-ASCII title (accents, CJK, emoji) | Preserved as UTF-8. Folding never splits a multi-byte character. |
| Duplicate titles with the same due date | Two events with different `UID`s. |
| Due date at a month or year end (for example `2026-12-31`) | `DTEND` rolls over correctly to `20270101`. |
| Leap day (`2028-02-29`) | `DTEND` is `20280301`. |
| Export clicked while a filter hides some books | Hidden books are still exported (criterion 7). |

---

## Out of scope

- Reminders or alarms in the events.
- Importing from `.ics`.
- Persisting filter state.
- Fixing `daysLeft` date parsing (tracked separately in CLAUDE.md "Known issues").
