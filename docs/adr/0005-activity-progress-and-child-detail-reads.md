# Concentrate Activity progress meaning and child-detail scope

## Decision

Activity progress averages include only completed Activities with non-null
scores. A genuine zero score participates. Teacher, parent, and report views
share that population and round averages to one decimal place. Saved play time
includes completed and unfinished Activities; seconds remain the underlying
measure, with minutes and subject hours derived for display.

Activity progress reads and projections live behind the Activities read
interface; report-specific projection stays inside Reports. Routes retain
authentication, role, roster, and navigation decisions. The existing Activity
streak module continues to own learner-day policy from ADR-0001.

Parent child-detail reads verify the active parent-child link, then query
progress and the recent feed for that child. Child scope is applied before
either feed stream is limited, merged, and capped. The parent-wide dashboard
remains a separate use case. Thumbnail signing and family visibility rules are
preserved, as are authenticated reads and RLS.

## Alternatives and consequences

The previous averages mixed completed-only, all-row, and non-null populations;
the report also displayed zero durations despite saved play time. Shared
projection makes score population and time conversion one change.

Filtering a capped parent-wide feed loses selected-child history when a busy
sibling occupies the cap. Increasing the global limit cannot guarantee complete
selected-child results. Scoping at the read interface removes that ordering
knowledge from the page and avoids fetching every sibling's progress.

Tests cover mixed completion states, null and zero scores, real saved durations,
unauthorized child reads, and a sibling with more than twenty newer entries.
This does not add a historical event log: the feed still reflects latest saved
Activity progress and published Portfolio artifacts.
