# Issue tracker: GitHub

Issues and specs live in GitHub Issues for `pocroianu/eduplay`.
Use the `gh` CLI from this repository.

## Conventions

- Verify the target before creating issues:
  `gh repo view --json nameWithOwner`.
  It must be `pocroianu/eduplay`.
- Create: `gh issue create --title "..." --body-file <path>`.
  Use a UTF-8 file for multiline bodies.
- Read: `gh issue view <number> --json number,title,body,labels,comments`.
- List: `gh issue list --state open --json number,title,body,labels`.
  Add label and state filters as needed.
- Comment: `gh issue comment <number> --body-file <path>`.
- Apply or remove labels:
  `gh issue edit <number> --add-label "..."` or `--remove-label "..."`.
- Close: post the explanation as a comment, then run
  `gh issue close <number>`. Post comments separately even if already closed.

Follow repository command-wrapper instructions when executing these commands.

File issues only in this repository. Never file into `mattpocock/skills`.

## Parent issues and blockers

Use GitHub native sub-issues and issue dependencies when available.
Otherwise, put `Part of #<parent>` and `Blocked by: #<number>` at the
top of the child body, and link children in the parent's task list.

A ticket is startable only when all blockers are closed.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Skill operations

When a skill says "publish to the issue tracker", create a GitHub issue.
When it says "fetch the relevant ticket", read the GitHub issue.

## Wayfinding operations

- Map: one issue labelled `wayfinder:map`, containing Notes,
  Decisions-so-far, and Fog.
- Child tickets: link to the map as sub-issues, using the fallback above
  when needed. Use `wayfinder:<type>` labels for research, prototype,
  grilling, or task.
- Frontier: select the first open child in map order with no open
  blockers and no assignee.
- Claim: assign the ticket to the driving developer.
- Resolve: comment with the result, close the ticket, and append a
  summary and link to the map's Decisions-so-far.
