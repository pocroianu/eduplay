# Record learner days and retry-safe play sessions

## Decision

Activity streaks use consecutive calendar days in `Europe/Bucharest`, with
yesterday allowed as the latest active day. Count saved learner engagement,
including unfinished Activities, across teacher, parent, student profile, and
report views. Teacher adjustments and seed fixtures do not create learner days.

Persist observed learner days separately from the latest per-Activity progress
summary. Recover historical dates only from authenticated learner writes recorded
in audit history. Earlier coverage can be incomplete; never invent days from an
aggregate attempt count or expose audit records to learner-facing queries.

The host owns active play time: readiness starts the clock, pauses stop it,
completion freezes it, and restart starts a new play session. Renderer-reported
wall-clock time does not override host active time.

Session progress snapshots contain cumulative active seconds and an increasing
sequence number. Serialize saves in the host and atomically deduplicate snapshots
in Postgres. Completion is terminal for that session. Results appear immediately;
failed saves remain visible and retryable while the result is displayed.

## Alternatives and consequences

- Calculating streaks from recent feeds or latest progress timestamps avoids
  additional persistence but loses days when the same Activity is played again.
- Browser-local dates make streaks depend on the viewer. Bucharest dates give
  families and teachers one shared calendar policy, including daylight saving.
- Retrying additive time deltas can double-count a write whose response was lost.
  Cumulative snapshots make that retry safe, at the cost of retaining session
  cursors until learner or Activity deletion.
- Legacy progress callers retain their existing delta contract; only requests
  carrying a session identifier use the cumulative contract.
- Import validation and staged publication do not promise recovery from a process
  crash or concurrent importers; filesystem errors during a running import trigger
  rollback, preserving recovery files if rollback itself fails.

This preserves host ownership from core ADR-0004 and Activity identity and SQL
migration authority from core ADR-0001 and ADR-0003.
