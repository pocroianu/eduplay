# PROTOTYPE — Odd one out activity type

Question: can a kid-facing "find the item that does not match the rule" activity feel clear and fun as a Phaser Activity-host renderer before we commit to a production schema/template?

Run:

```bash
npm run start:activities
```

Open:

- `http://localhost:5173/activities/prototype-odd-one-out-01` — chosen card-stage direction

Notes:

- This is intentionally throwaway and should not be promoted directly to production.
- The Activity `config.json` uses the existing `counting` schema only as a validation carrier; the prototype scene owns its sample rounds in code.
- Variant A won. Losing variants and the dev switcher were removed to focus on the selected direction.

Verdict:

- Chosen direction: airy 2 × 2 card-stage layout with one short instruction, one rule pill, and no debug stats/pause chrome.
