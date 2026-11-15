# Recover native Activity completion per submission attempt

Drawing and voice Activities can produce multiple Portfolio artifacts from one
Activity instance. Retry identity therefore belongs to the Activity submission
attempt, rather than the instance or the generic artifact source reference.
The server records the artifact, submission receipt, latest instance result,
and currently eligible Learning Path targets in one SQL transaction after
upload. Authenticated learners can read their own receipts but cannot create
receipts or settle targets directly.

Each target is settled atomically with its existing SQL advancement, including
no-op outcomes. Retries never rescan for matching content: later identical
steps and newly assigned paths cannot join an old attempt. Already-settled
targets never replay after teacher reopening; an unsettled target continues
to follow ADR-0003's existing lock-order semantics. No completion generations
are introduced.

Saved work remains successful when progression fails. The player exposes
pending progression separately, retries it on request or reopening, and keeps
only an opaque attempt identifier in browser storage. Explicit new work gets
a new identifier. Unsaved canvas/recording media is not persisted across reloads.

Storage upload is external to the SQL transaction. An uncertain commit is
reconciled by its durable receipt before retrying, and its media is retained.
Only a confirmed losing concurrent upload can be deleted safely. Process crashes
and persistently uncertain outcomes may leave unreferenced uploads; this decision
does not add a cleanup worker or durable background progression delivery.
