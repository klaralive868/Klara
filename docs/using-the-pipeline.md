# Using the Matt Pocock Skills Pipeline — Practical Instructions

> A condensed, practical reference for actually running this pipeline day-to-day. Full skill descriptions live in the skills package itself (`ask-matt` router inside Claude Code); this is the "what do I actually type, in what order" version.

---

## One-time install (per machine)

In a regular terminal (not inside a `claude` session), from the repo root:

```bash
npx skills add mattpocock/skills
```

This installs all 39 skills into `.agents/skills/`. Ignore any `--skill=` flag attempts to install just one — it installs everything regardless.

**Restart your `claude` session after installing** — skills load at startup, they don't hot-reload into an already-running session.

## One-time setup (per repo)

Inside a running `claude` session:

```
/setup-matt-pocock-skills
```

Answer its questions (issue tracker — pick GitHub if you have a real remote; triage labels — accept the defaults; domain docs — accept single-context unless this is a monorepo). This writes `CLAUDE.md` and `docs/agents/*.md`, which every other skill reads from. Commit and push the result.

**Also, right after setup:** manually point `docs/agents/domain.md` at your actual architecture/standards docs (e.g. `klara-architecture-brief-v2.md`, `klara-standards-v2.md`), since the seed template only knows about a generic `CONTEXT.md` by default.

You'll also need GitHub CLI authenticated (`gh auth login`) for the tracker integration to work, and Greptile installed as a GitHub App on the repo, pointed at your Standards doc as its custom review ruleset.

---

## The main chain — this is 90% of daily use

```
grill-with-docs → to-spec → to-tickets → implement → code-review
```

**1. `/grill-with-docs`** — start here for any new feature/module. Describe what you're building in one message, referencing your architecture/standards docs. It interviews you one question at a time — answer honestly, push back on its recommendations when you disagree, let it write resolved decisions to `CONTEXT.md` as you go. Don't rush this; every gap it catches now is cheaper than catching it in code.

**2. `/to-spec`** — once the grill is done, this writes the actual spec (problem statement, solution shape, user stories, decisions, test plan) and publishes it as a GitHub issue.

**3. `/to-tickets`** — point at the spec issue. Breaks it into small, vertical, independently-demoable tickets with declared blocking dependencies. It'll show you the proposed breakdown and ask you to confirm before publishing — actually read it, don't rubber-stamp; check the dependency order makes sense and nothing's been merged together that shouldn't be.

**4. `/implement #<issue-number>`** — builds one ticket, test-first, against the frontier (whichever tickets have no unresolved blockers). It opens a real PR when done — **confirm it's actually opening a PR, not committing straight to `main`**; this is required for Greptile to ever see the work.

**5. Automatic:** `implement` runs its own in-session `code-review` (Standards + Spec axes, checked separately) before the PR opens.

---

## After the PR opens

1. **Wait for Greptile** to comment automatically (a few minutes). If it doesn't fire, check it's actually installed/enabled on this specific repo.
2. **Read every finding seriously**, even ones scored low-severity — several real bugs (a race condition, a silent email misconfiguration, a data-duplication gap) were caught this way and would have shipped invisibly otherwise.
3. **For anything Greptile flags as a genuine judgment call** (not just a clear bug) — decide deliberately, and if you're keeping something as an intentional exception to a Standards rule, tell Claude Code to document that exception in the Standards doc itself, not just fix it silently.
4. **Tell Claude Code to apply the fix**, verify it live (not just re-read the code), commit, push — this re-triggers Greptile automatically if you've enabled "retrigger on new commits."
5. **You merge.** Greptile and the automated tests are gates that must pass, not an auto-merge trigger — final call is always yours.

---

## When to reach for something other than the main chain

- **`/ask-matt`** — when you're not sure which skill fits a situation. Describe what's going on, it routes you.
- **`/wayfinder`** — only when an effort is too large and foggy to spec directly (you can feel the shape but can't write it down yet). If a grill surfaces no real fog, skip this — most well-scoped modules don't need it.
- **`/diagnosing-bugs`** — for a real, hard-to-pin-down bug. It insists on building a tight, repeatable failure loop *before* theorizing — don't skip straight to guessing at fixes.
- **`/prototype`** — a throwaway exploration to answer one design question ("does this state model feel right," "what should this screen look like") — explicitly disposable code, never merged as-is.
- **`/research`** — delegate reading legwork (how does an API actually behave, what does a spec really say) to a background agent instead of stopping your own thread to look it up.
- **`/handoff`** — before closing a session that's getting long, or before a deliberate restart — compresses the live thread into a document a fresh session can pick up, referencing files/issues rather than restating them.

---

## The one rule that matters most

**Never let a ticket skip the PR → Greptile → your-review gate**, even when it feels obviously simple or fast. The bugs this pipeline has caught so far were never the ones anyone expected to be wrong.
