# Current task

_None — nothing in progress._

Two things landed on main and are awaiting your confirmation on production (klara.live):
- Customers page crash fix (commit a14c5fc) — awaiting your check that /dashboard/customers loads.
- Root "/" now 308-redirects to /sign-in instead of the SvelteKit scaffold page (commit 646fb04) — verified locally (curl showed 308 -> /sign-in, resolved before render), not yet confirmed live.

# Plan

_(empty)_

# State as of last update

_(empty)_

# Files touched this task

_(empty)_

# Blockers / waiting on

Simmo to confirm both fixes above are working on klara.live once Vercel finishes deploying.
