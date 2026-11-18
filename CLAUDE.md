# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A static, dependency-free page for tracking borrowed library books (due dates, overdue status, late fees). No build step or server: open `index.html` in a browser. Books persist in `localStorage` under the key `my-library-books`.

## Commands

- Run: open `index.html` directly in a browser.
- Test: `npm test` (runs `node --test`; Node's built-in runner, no dependencies). Single file: `node --test path/to/file.test.js`. Tests: `books.test.js` (`lateFee`, `sortByDue`), `characterization.test.js`, `filter.test.js` (`filterBooks`) and `ics.test.js` (`buildIcs` and helpers).

## Architecture

Plain scripts loaded in this order by `index.html` (no modules/bundler): `books.js`, `filter.js`, `app.js`, `ics.js`, `export.js`.

- `books.js`: pure business logic (`daysLeft`, `isOverdue`, `lateFee`, `sortByDue`). It ends with a guarded `module.exports`, so it works as a browser global *and* is `require()`-able from Node tests. Keep it free of DOM/`localStorage` access to preserve that.
- `filter.js`: pure `filterBooks(books, query, dueSoonOnly, now)` for search and the "Due soon" checkbox. Same guarded `module.exports` pattern; no DOM access.
- `app.js`: DOM and storage layer. Relies on the globals from `books.js` and `filter.js`. `render()` re-reads from `localStorage` and rebuilds the whole list on every change; add/return handlers call `save()` then `render()`. Filter state is read from the DOM and never persisted.
- `ics.js`: pure calendar logic (`buildIcs`, `escapeText`, `foldLine`, date helpers); returns `null` when there is nothing to export. Guarded `module.exports`, no DOM access.
- `export.js`: DOM wiring for the "Export due dates" button. Runs after `app.js`, uses its global `load()` (all stored books, so filters never affect the export), and downloads `books.ics`.

New pure logic lives in its own file (`filter.js`, `ics.js`) with its own test file rather than in `books.js`, so parallel work does not collide on one `module.exports`.

## Library rules (from README, implemented in `books.js`)

- Late fee is $0.25/day, starting the day *after* the due date.
- Fee is capped at $5.00 per book (`FEE_CAP`).
- List is sorted soonest-due first.

## Features

Search/filter and calendar export (specified in [SPEC.md](SPEC.md)) are implemented. Read SPEC.md for the acceptance criteria and edge cases before changing either. `statusText` in `app.js` must stay as is: `characterization.test.js` extracts its source with a regex.

## Known issues in the current code

These look like bugs rather than intended behavior; verify before relying on them:

- `app.js` builds HTML via string concatenation with unescaped `title`/`author` (XSS/quote-breaking), and "Returned" removes books by title, so duplicate titles are all removed.
- `daysLeft` parses date-only strings as UTC but compares against a local `new Date()`, so day counts can be off depending on time of day/timezone.
