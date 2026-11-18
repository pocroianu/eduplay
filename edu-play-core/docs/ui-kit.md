# EduPlay UI Kit

`src/shared/components/ui/kit/` is the canonical EduPlay UI kit for
EduPlay product surfaces. It is source-owned in this repo, typed with
TypeScript, styled with Tailwind 4 plus `src/app/globals.css` tokens, and
exported through one barrel. Kit primitives wrap Mantine Core internals behind
the same EduPlay API while preserving EduPlay tokens and stable imports:

```tsx
import {
  Button,
  ChunkyButton,
  DuoCard,
  DuoProgress,
  SubjectPill,
  StatBlock,
  SectionHeader,
  Vulpita,
} from '@/shared/components/ui/kit';
```

Do not deep-import kit files from feature code. If a primitive needs a new
variant, extend the primitive in the kit and export the new prop type from
`src/shared/components/ui/kit/index.ts`.

## EduPlay contract

- Runtime code imports from `@/shared/components/ui/kit`; it never imports the prototype bundle.
- Primary is EduPlay purple; Post-to-Journal green is reserved for journal capture.
- Cards are white, 12–16px radius, low shadow, no thick borders.
- Buttons darken on hover/press; cards raise shadow; neither scales on hover.
- Teacher shell uses fixed left rail + 72px page header + optional 88px class-context header.
- Parent/auth/landing inherit tokens and primitive anatomy; student surfaces adapt with kid-size touch targets.

## Design Authority

Mantine supplies the behavior and structure for reusable DOM UI; the kit keeps
EduPlay's public API and token styling. Buttons, cards, dialogs, tables, fields,
badges, avatars, and progress indicators should use the corresponding Mantine
primitives. Pure layout, brand SVGs, and canvas rendering do not require a
library wrapper. Composition of a Mantine-backed kit component already counts
as adoption; do not add imports merely to increase coverage.

`MantineBoundary` reuses the app provider and supplies the EduPlay theme to
standalone embeds. `npm run audit:mantine` reports static direct and indirect
dependencies, remaining visible native controls, and intentional exceptions.

The active design system is **EduPlay**. The implementation source
of truth is the code shipped in `src/shared/components/ui/kit/`,
`src/shared/components/ui/Icon.tsx`, `src/shared/components/ui/Icon.registry.ts`,
`src/app/globals.css`.

The palette uses the app font stack, EduPlay purple, quiet off-white classroom surfaces, soft
shadows, and rectangular 8-16px radii across teacher, parent, admin, public,
auth, student, play, and game surfaces. Student/play surfaces keep larger touch
targets and child-facing interaction models without chunky 3D styling.

Older Duo, Aventura, Prism, Joy, and M3-era names are legacy migration context
only. Do not introduce those names in new component APIs, comments, CSS classes,
docs, or issue comments unless you are explicitly documenting a retirement path.

## Import Rules

- Import primitives from `@/shared/components/ui/kit`.
- Import icons through `Icon` from `@/shared/components/ui/Icon`; add new glyphs
  to `Icon.registry.ts` before using them.
- Use EduPlay token utilities such as `bg-primary`,
  `bg-success-journal`, `text-on-surface`, `shadow-soft-sm`, and `rounded-md`,
  or `var(--color-*)` for computed styles.
- Do not add raw hex colors, raw radius values, emoji-as-icons, or one-off
  styled wrappers when a kit primitive already exists.

## Canonical Primitives

| Primitive | Use |
| --- | --- |
| `Button` / `ChunkyButton` | Primary action surfaces. Both render EduPlay flat/soft-shadow chrome. `Button` supports `mode`, `variant`, `size`, `tone`, `href`, `fullWidth`, and `isPending`; student/play primary callsites use `mode="kid"` with `size="lg"` or `size="xl"`. `ChunkyButton` is retained for compatibility and supports its existing `icon`, `iconRight`, `full`, and `loading` props. |
| `DuoCard` / `Card` | General card surfaces. The names are retained for API compatibility; styling now follows the EduPlay white-card-on-quiet-canvas model. |
| `LibraryActivityCard` | Mantine-backed EduPlay library rail card for teacher activity libraries. Supports create, activity, and ideas variants with optional separate action links such as `Atribuie`, using CSS-module hover/focus feedback instead of global page selectors. |
| `LibraryExploreCard` | Reusable EduPlay Explore Libraries card for collection and activity grids. Supports collection/activity variants, thumbnail tones, metadata, and a separate motion-ready action button such as `Atribuie`. |
| `Pill` | Generic chip with optional leading/trailing slots. Prefer this over `PillBadge` for new generic chips. |
| `SubjectPill` | Subject chip for the Romanian curriculum keys in `SUBJECT_KEYS`: `romana`, `math`, `stiinte`, `arte`, `muzica`, `sport`. |
| `DuoProgress` / `DuoProgressRing` | Progress indicators. They clamp `value` to 0-100 and render `role="progressbar"`. |
| `DuoAvatar` | Deterministic initials avatar. Use CSS token strings for `ring`, such as `var(--color-gold)`. |
| `StatBlock` | Canonical compact stat tile for dashboard metrics. |
| `SectionHeader` | Eyebrow/title/subtitle/action pattern for product sections. |
| `HeroBanner` | EduPlay hero surface for dashboard and celebratory page headers. |
| `DashboardShell` | Role dashboard shell and navigation frame. |
| `RewardGlyph` / `DuoFlame` | Brand-specific reward symbols that should not be replaced by Phosphor icons. |
| `RewardModal` | Kid-mode reward and level-up modal. Backdrop click is intentionally ignored. |
| `Vulpita` | Mascot SVG. Keep spelling as `Vulpița`; use one mascot per viewport. |
| `ConfirmDialog`, `PinDotRow`, `Numpad`, `TextField`, `Checkbox`, `DataTable`, `ToolbarRow`, `Toast` | Shared product controls. Keep copy and feature behavior outside the primitive. |

Kit primitives currently wrap Mantine Core primitives internally. New or
migrated feature code may import Mantine Core directly when the shared EduPlay
Mantine theme covers the component behavior; keep using kit primitives when they
encode EduPlay-specific semantics, compatibility names, or product contracts.

## Usage Patterns

EduPlay example:

```tsx
<DuoCard tone="green">
  <SectionHeader
    eyebrow="Privire rapidă"
    title="Clasa de azi"
    subtitle="Urmărește progresul și trimite activități noi."
  />
  <Button size="md">
    Trimite lecție
  </Button>
</DuoCard>
```

Student/play callsites use kid mode for primary actions. `size="lg"` is the
minimum primary CTA size there because it renders a 64px touch target; use
`size="xl"` when the action is the main play/start control.

```tsx
<DuoCard tone="gold">
  <Vulpita mood="happy" size={160} />
  <Button mode="kid" size="lg" tone="sun" fullWidth>
    Joacă acum
  </Button>
</DuoCard>
```

Keep user-facing copy Romanian, informal, and with diacritics. English is
acceptable only in developer-only surfaces such as `/dev/duo-kit`.

## Deprecated Surfaces

### `PillBadge`

`PillBadge` remains exported only for older student pages that have not migrated
yet. Do not use it in new surfaces. For generic labels use `Pill`; for subject
labels use `SubjectPill`.

Migration:

```tsx
// Before
<PillBadge tone="secondary" leading={<Icon name="Sparkle" size={18} />}>
  Premiu nou
</PillBadge>

// After
<Pill mode="kid" tone="sun" leading={<Icon name="Sparkle" size={18} />}>
  Premiu nou
</Pill>
```

### Non-kit `StatCard`

`src/shared/components/ui/StatCard.tsx` is a deprecated wrapper around
`StatBlock`. Do not import it in new code. Migrate existing consumers to:

```tsx
import { StatBlock } from '@/shared/components/ui/kit';

<StatBlock label="Jocuri" value={12} icon="GameController" variant="primary" />
```

The kit-local `StatCard` export exists for transitional dashboard consumers. Use
`StatBlock` for new compact metrics unless a ticket explicitly asks for the
larger `StatCard` treatment.

## Adding Or Extending A Primitive

1. Confirm `DESIGN.md` already describes the behavior. If it does not, ask the
   CTO before changing the kit contract.
2. Add or update the component in `src/shared/components/ui/kit/`.
3. Keep props semantic and typed. Prefer lookup tables over ad hoc class
   concatenation.
4. Use EduPlay tokens only. Computed styles may use `var(--color-*)`; component code
   must not introduce raw hex.
5. Colocate a focused `*.test.tsx` next to the primitive.
6. Add the primitive to `tests/unit/a11y/kit-a11y.test.tsx` (vitest-axe; only the page-level `region` rule is disabled). Use the `focus-ring` utility for keyboard focus.
6. Export the component and prop types from `src/shared/components/ui/kit/index.ts`.
7. Update this document when the public contract changes.

Useful local checks:

```bash
npm run test:unit -- src/shared/components/ui/kit
npm run lint
```

Include a screenshot in the PR when you add or materially change a primitive’s
appearance.
