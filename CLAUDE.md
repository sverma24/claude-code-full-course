# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A static, dependency-free page for tracking borrowed library books (due dates, overdue status, late fees). No build step or server: open `index.html` in a browser. Books persist in `localStorage` under the key `my-library-books`.

## Commands

- Run: open `index.html` directly in a browser.
- Test: `npm test` (runs `node --test`; Node's built-in runner, no dependencies). Single file: `node --test path/to/file.test.js`. Tests live in `books.test.js` (covers `lateFee` and `sortByDue`).

## Architecture

Two plain scripts loaded in order by `index.html` (no modules/bundler):

- `books.js`: pure business logic (`daysLeft`, `isOverdue`, `lateFee`, `sortByDue`). It ends with a guarded `module.exports`, so it works as a browser global *and* is `require()`-able from Node tests. Keep it free of DOM/`localStorage` access to preserve that.
- `app.js`: DOM and storage layer. Relies on the globals from `books.js`. `render()` re-reads from `localStorage` and rebuilds the whole list on every change; add/return handlers call `save()` then `render()`.

## Library rules (from README, implemented in `books.js`)

- Late fee is $0.25/day, starting the day *after* the due date.
- Fee is capped at $5.00 per book (`FEE_CAP`).
- List is sorted soonest-due first.

## Known issues in the current code

These look like bugs rather than intended behavior; verify before relying on them:

- `app.js` builds HTML via string concatenation with unescaped `title`/`author` (XSS/quote-breaking), and "Returned" removes books by title, so duplicate titles are all removed.
- `daysLeft` parses date-only strings as UTC but compares against a local `new Date()`, so day counts can be off depending on time of day/timezone.
