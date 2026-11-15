# Domain docs

This repository uses a single-context domain documentation layout.

## Before exploring

- Read `GLOSSARY.md` at the repository root.
- Read relevant decisions in the root `docs/adr/`.
- Also consult existing ADRs in `edu-play-core/docs/adr/` and
  `phaser-projects/docs/adr/` when working in those areas.

If domain documents are missing, proceed silently. Do not suggest
creating them upfront. The domain-modeling skill creates them lazily
as terms and decisions are resolved.

## File structure

- `GLOSSARY.md`: shared domain vocabulary.
- `docs/adr/`: repository-wide architecture decisions.

The existing application ADRs remain in their current locations.

## Use the glossary's vocabulary

Use defined domain terms in issue titles, proposals, hypotheses,
and test names. Avoid synonyms the glossary explicitly rejects.

If a needed concept is absent, reconsider whether it belongs to the
domain or note the gap for domain-modeling.

## Flag ADR conflicts

Explicitly identify proposals that contradict an existing ADR.
Reference the decision and explain why it should be reconsidered.
