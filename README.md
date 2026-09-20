# Discipline Ladder v4.5

A local-first daily execution PWA built around Floor, Standard and Full.

## v4.5 — logic fixes found by simulating real days of use
- Fixed a data-loss bug: picking a higher target without committing, then completing a task, could
  silently revert the day's target back to your old default after closing/reopening the app.
- Marking a task "Missed" now actually resolves it — it no longer keeps counting as "still open" forever.
- The "Day closed" evening state (present in the styling since v4.4 but never reachable) now actually
  triggers once the day's window has passed, replacing endless "Late!" nagging with a calm summary and a
  one-tap **Review today** button that opens the weekly review.
- The review/history section now auto-opens in the evening (from 7pm), matching the app's intended
  "review your day" moment.
- Fixed a false-positive "Floor/Ladder complete" message that could appear even if every task that day was
  skipped rather than actually done.
- The routine editor no longer lets a blank or invalid field (an empty name, a cleared time) silently
  corrupt a task's schedule — invalid edits are now skipped and reported instead of saved.
- Aligned the "Asleep" / Sunday wind-down deadlines (label vs. actual end time) so the new day-close cutoff
  lines up with the stated 9:00 bedtime.
- Service-worker cache bumped to v9 so installed PWAs actually pick up this build.

See `TEST_REPORT.md` for how each of these was found and verified (headless-browser, before/after).

## v4.4 final debug release
- Replaced split `#app` / `#modal` click handling with one document-level capture-phase action dispatcher.
- Fixed boolean `data-*` actions (`data-settings`, `data-close`, etc.) by checking attribute presence instead of truthiness; empty `dataset` values were the direct cause of the Settings/Close regression.
- Settings now routes through `openSettings()` and is resilient to app re-renders and modal separation.
- Close, history, focus, task, routine, import/export and reminder actions use the same event-routing path.
- Escape closes an open modal from anywhere in the document.
- `index.html` now loads the single canonical `app.js`; the previous duplicated inline runtime was removed.
- Bumped service-worker cache to v8 to avoid stale v4.3 runtime code.
- Added defensive modal rendering and Settings error reporting.

## Run
Serve this folder from a normal local/static web server or deploy it to HTTPS for full PWA capabilities.

## Data
All routine and day data is stored locally in the browser. Use Export backup regularly for portability.
