# Own complete authoring and submission workflows

Activity draft saving treats content and ordered live resources as one atomic
operation in Postgres. It locks the same Activity row as the existing ready
operation, so a ready snapshot cannot read a partially replaced draft. Create
and edit callers share this operation; ready snapshots remain immutable.

Assignment creation has one owner for roster checks, Activity Version pinning,
target fanout and persistence. Teacher actions and request handlers retain their
response formatting and cache refreshes. Both notify linked parents after a
successful write. Notifications are best effort: failure must not turn a committed
Assignment into an apparent creation failure and encourage duplicate creation.

Free-response submission coordination owns media uploads, commit outcomes and
compensation independently of canvas/microphone capture and rendering. Known
upload or submission rejection permits awaited cleanup. Cleanup failures remain
observable and block additional uploads until cleanup succeeds.

A lost response or server failure is an uncertain commit. Keep its exact response
and media while the page is open; reconcile through a read-only, learner-scoped
submission query before retrying. A submitted or approved server response locks
the editor. Unresolved commits never trigger media deletion. Local draft cleanup
cannot turn a committed submission into failure. This does not promise durable
retries after closing the page or add a background cleanup process.

Existing submission SQL continues to own authoritative status transitions.
This follows core ADR-0003's SQL mutation authority and preserves the earlier
Play session timing decision, which concerns a different workflow.
