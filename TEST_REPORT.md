# Discipline Ladder v4.5 QA Report

## Scope of this pass
v4.4 fixed the architecture (single runtime, one capture-phase dispatcher, boolean-attribute detection).
That was necessary but not sufficient: v4.4's own report noted it could only run static/syntax checks,
because the sandbox blocked Chromium from navigating to `localhost`. Static checks confirm the *plumbing*
works; they cannot catch bugs that only appear after a sequence of real actions across a simulated day.

This pass runs the app in an actual headless Chromium engine (Playwright) with the system clock mocked,
and drives it through realistic multi-step days: pick a target, complete tasks, miss a task, close the
app and reopen it, let the clock run past bedtime, etc. That surfaced four real logic bugs that static
checks could not have found. All four are fixed below, and the test suite (`test.js`, included) proves
each one fails on the old code and passes on the new code — not just asserted, run and shown.

## Bugs found and fixed

**1. Picking a higher target and then working could silently discard it (data-loss bug)**
Sequence: open the app, tap "Standard" (without pressing Commit), check off your first task, close the
app, reopen it later. The saved record was seeded from the old `state.prefTier` instead of the target you
had just picked, so on reopen the app quietly reverted you to Floor. This is exactly the kind of bug that
never shows up in a single-session click-test but breaks trust the first time someone actually uses the
app across a day. **Fixed:** new-day records now seed from the live selected target.

**2. Marking something "Missed" didn't actually let you move on**
`nextUp()` excluded `done` and `skipped` from the "still needs attention" list, but not `missed`. So a
task you explicitly marked missed kept counting toward "N earlier items still open" and kept blocking the
day from ever reaching a settled state — the opposite of what the "Mark missed" button is for.
**Fixed:** `missed` is now a resolved terminal state like `skipped`.

**3. "Day closed" screen existed in the CSS/copy but could never appear (dead code)**
There was a fully-written `.hero.over` state ("Day closed — log what happened, protect sleep") but nothing
in the code ever produced that state — `nextUp()` had no path that returned it. In practice this meant the
app would keep shouting "Late!" about a 6am block at 11pm forever, which directly contradicts the app's
own stated philosophy ("stopping is a valid finish"). **Fixed:** once the clock passes the day's last
scheduled block, or once every item has been resolved one way or another, the app now shows the calm
"Day closed" card instead of continuing to nag — with a **Review today** button that jumps straight to
the evening review section, since that's the actual point of that moment.

**4. Skipping every task falsely showed "Floor complete" / "Ladder complete"**
The old "done" check was just "nothing left open," which is also true if everything was *skipped* rather
than done. That let the hero show a congratulatory "You kept the floor" message for a day where literally
nothing was completed — inconsistent with the streak/ladder logic elsewhere, which correctly requires
actual completion. **Fixed:** the celebratory state now requires every item to be genuinely done.

## Hardening (not a bug users would trigger often, but a real risk)
**Routine editor could silently corrupt the schedule.** Clearing a task-name field or a time field and
pressing Save wrote the blank value straight into the schedule (blank names, `NaN` times breaking that
task's scheduling permanently until manually reset). **Fixed:** Save now validates each field and keeps
the previous value for anything blank/invalid, and tells you how many fields it had to ignore.

## Minor consistency fix
The "Asleep" task and the Sunday wind-down task both said "by 9:00" but their actual end time was 9:30,
so the "day closed" cutoff (see #3) wouldn't line up with the bedtime the app is telling you to protect.
Both now end at 21:00 to match the stated deadline.

## Verification
`test.js` is a Playwright script that loads the real `index.html`/`app.js` in headless Chromium, mocks
the clock, and runs 7 scenarios end-to-end (see file for details). Result:

- Against this fixed build: **7/7 pass**
- Against the original v4.4 `app.js`, same test suite: **0/7 pass** (1 borderline scenario partially masked
  the bug on first assertion attempt; corrected assertion also fails cleanly on v4.4)

This is a genuine before/after regression proof, not a static syntax check.

## Still true from v4.4
- One canonical `app.js`, loaded with `defer`, no duplicated inline runtime.
- One document-level capture-phase action dispatcher; boolean `data-*` actions detected by attribute
  presence, not truthiness.
- Service worker cache bumped (v9) so installed PWAs actually pick up this build instead of serving the
  stale cached `app.js`.

## Known limitation, stated plainly
This was tested in headless Chromium via Playwright, not in your actual phone browser/installed PWA. The
logic bugs above are engine-independent (they're pure JS state bugs, not rendering quirks), so this is
strong evidence, but a first real-world day of use is still the final test. If anything looks off, the
most useful thing you can tell me is *what you did and what you expected vs. what happened* — that's
exactly the kind of report that found bugs #1–#4 above.
