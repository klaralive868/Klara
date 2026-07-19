# Issue tracker: Linear

Issues and PRDs for this repo live in **Linear**.

No Linear MCP server or CLI is connected yet. Until one is connected, skills should **describe issues in prose** (title, body, labels) and hand them to the user to create/manage in Linear manually, rather than assuming an automated create/read/comment/close cycle.

## Connecting Linear

To let skills operate on Linear directly, connect the official remote MCP server once (interactive, run by the user — not by an agent):

```
claude mcp add --transport sse linear https://mcp.linear.app/sse
```

This opens a browser OAuth flow against the Linear workspace. Once connected, Linear's MCP tools (create issue, search, comment, etc.) become available in future sessions, and this file should be updated to describe the concrete tool calls to use for each operation below.

## Conventions (once connected)

- **Create an issue**: use the Linear MCP "create issue" tool with team/project as configured in Linear.
- **Read an issue**: use the Linear MCP "get issue" / "search issues" tools.
- **List issues**: use the Linear MCP "list issues" tool, filtered by state/label as needed.
- **Comment on an issue**: use the Linear MCP "create comment" tool.
- **Apply / remove labels**: use the Linear MCP "update issue" tool's labels field.
- **Close**: update issue state to the workspace's "Done"/"Canceled" state.

## When a skill says "publish to the issue tracker"

Without MCP connected: present the issue title + body + labels to the user as a block they can paste into Linear.
With MCP connected: create the issue directly via the Linear MCP tools.

## When a skill says "fetch the relevant ticket"

Without MCP connected: ask the user to paste the ticket's title, description, and comments.
With MCP connected: fetch it via the Linear MCP "get issue" tool.

## Pull requests as a request surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_
