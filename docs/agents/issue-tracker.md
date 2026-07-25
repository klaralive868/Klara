# Issue tracker: GitHub Issues

Issues and specs for this repo live in **GitHub Issues** (`klaralive868/Klara`), via the `gh` CLI — already authenticated in this environment. (An earlier version of this doc claimed Linear; that was never actually true in practice — every real ticket in this repo, from #1 onward, has lived in GitHub Issues. Corrected here after the mismatch surfaced mid-`/to-tickets` session.)

## Conventions

- **Create a spec/parent issue**: `gh issue create --repo klaralive868/Klara --title "..." --body-file <path> --label "ready-for-agent"`. A parent issue holds the full spec content (Problem Statement, Solution, User Stories, Implementation Decisions, Testing Decisions, Out of Scope, Further Notes) inline in its body — not just a link to a doc file.
- **Create a child ticket**: same `gh issue create` form. Reference the parent via `## Parent\n\n#<N>` in the body, and sibling blockers via `## Blocked by\n\n#<N> (title)` or `None — can start immediately`. There is no native GitHub sub-issue relationship in use here — the `## Parent` / `## Blocked by` text is the whole mechanism, so publish in dependency order (blockers before the tickets that reference them) to have real numbers to reference.
- **Read an issue**: `gh issue view <number> --repo klaralive868/Klara`.
- **List issues**: `gh issue list --repo klaralive868/Klara [--state all] [--label ...]`.
- **Comment on an issue**: `gh issue comment <number> --repo klaralive868/Klara --body "..."`.
- **Apply / remove labels**: `gh issue edit <number> --repo klaralive868/Klara --add-label "..."` / `--remove-label "..."`.
- **Close**: `gh issue close <number> --repo klaralive868/Klara`.

## Triage labels

See `docs/agents/triage-labels.md` — the label strings there (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) already exist on this repo (`gh label list` to confirm before assuming a new one needs creating).

## When a skill says "publish to the issue tracker"

Create the issue(s) directly via `gh issue create`, per the conventions above.

## When a skill says "fetch the relevant ticket"

Fetch it directly via `gh issue view`.

## Pull requests as a request surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_
