# Own Learning Path definitions and Portfolio publication transitions

## Decision

Learning Path append ordering belongs to Postgres. Append, reorder, and publish
serialize on the Learning Path row. Concurrent appends both survive in database
order. Publication includes appends that commit first and rejects later appends.
Authenticated callers cannot directly insert, edit, delete, or move steps in a
published sequence, or reopen its definition as a draft. Trusted database
maintenance and fixtures retain their existing privileges.

Action adapters own input validation, friendly errors, and cache refreshes;
callers no longer supply an append position. This extends core ADR-0003's SQL
mutation authority. Root ADR-0003 continues to govern learner progress, which
is separate from the authored definition.

Portfolio artifact visibility changes lock the artifact and return both the
saved artifact and whether it actually entered family visibility. Same-state
retries do not change review metadata or authorize another notification.
Archiving and genuinely publishing again permits a new notification attempt.

The notification adapter runs after commit, only for a winning transition.
Delivery stays best effort: notification errors cannot turn a committed
publication into failure. A process crash after commit can lose notification
delivery; this decision does not introduce an outbox or promise durable delivery.

## Alternatives and verification

Caller-side draft checks and prior-visibility reads are insufficient because
another transaction can commit between a read and its write. Shared database
locks concentrate the rules without adding a generic persistence abstraction.

pgTAP covers transitions, privileges, ownership, and direct-write guards.
The local concurrency script exercises simultaneous appends, both append/publish
arrival orders, and overlapping publication with one notification eligibility
result. Existing learner-cursor concurrency checks remain in place.
