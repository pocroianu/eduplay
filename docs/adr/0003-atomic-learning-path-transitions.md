# Serialize Learning Path advancement and teacher overrides

Learning Path cursor checks and their writes belong in the same Postgres
transaction. Reading progress in application code before a separate privileged
upsert can overwrite a teacher override or reuse stale initialization state.

Advancement and override operations acquire the same transaction-scoped advisory
lock keyed by learner and Learning Path. This also serializes first writes when
no progress row exists. Advancement locks existing progress before checking its
cursor, last completed step, and terminal status. Duplicate and locked-step
completions remain no-ops. A teacher can deliberately reopen a completed path.

Advancement is callable only by the service role after the server's scoped
Activity completion matching. Giving students direct access to that operation
would let them advance without the completion workflow. SQL additionally checks
that the Learning Path is actually assigned to the learner or their class.

Teacher overrides use an authenticated RPC with explicit role, roster, and
Assignment checks. It uses definer privileges because administrators' normal
student reads are hidden by existing RLS. These checks replace reliance on RLS
inside this operation without broadening student-table visibility. A selected
step must still belong to the same Learning Path through the existing foreign
key. Action adapters retain input validation, friendly errors and cache refreshes.

The operations serialize in database lock order. A terminal teacher override
prevents a waiting completion from advancing. Deliberate reopening allows later
completion of the reopened step; it does not introduce completion generations.

Verification covers transition and access rules in pgTAP, plus concurrent
initialization and both arrival orders of advancement and override using two
real local Postgres sessions (`npm run test:db:concurrency` in `edu-play-core`).
