# DESIGN.md — EduPlay Design System

> Single-system spec for EduPlay product UI. Teacher, parent, admin, public,
> auth, student, play, and game surfaces use the EduPlay system:
> Lexend, EduPlay purple, classroom-white cards, quiet canvas surfaces, soft shadows,
> and gentle motion.

## Design Direction

EduPlay is developing its own design identity. The tokens and components below
are the current implementation baseline, not a requirement to imitate another
product. Evolve them intentionally around learner needs, teacher workflows,
and an original EduPlay voice.

## 1. Source Of Truth

Production implementation authority lives in:

- `src/app/globals.css` — Tailwind 4 token source of truth.
- `src/shared/components/ui/kit/` — primitive implementations and prop contracts.
- `src/shared/components/ui/Icon.tsx` and `Icon.registry.ts` — approved icon wrapper and glyph registry.
- `docs/ui-kit.md` — import and extension rules.

Keep imports stable through `@/shared/components/ui/kit`. Component names such
as `DuoCard`, `DuoProgress`, and `DuoAvatar` are compatibility names, not design
system branding.

## 2. Modes

| Mode | Surfaces | Rules |
| --- | --- | --- |
| Standard | Teacher, parent, admin, auth, and public surfaces. | Lexend, purple primary, soft shadows, calm motion, token cards, and denser route-appropriate spacing. Primary touch targets follow the primitive contract for non-child dashboards. |
| Kid mode | Student routes, play routes, games, and child-facing rewards/errors. | Same EduPlay visual language and tokens, with 64px minimum primary touch targets, 18px minimum body text, larger spacing, reduced-motion-aware animation, and simpler choices for children. Use kit props such as `Button mode="kid" size="lg"` rather than parallel styling. |

There is no runtime theme switch. Routes and primitives use the same EduPlay token spine with surface-specific sizing.

## 3. Tokens

Use token classes from `src/app/globals.css`. Do not put raw hex values,
arbitrary radii, or arbitrary shadows in production UI components.

### Standard palette

| Token | Use |
| --- | --- |
| `--color-primary` / `bg-primary` | Purple spine: primary CTAs, active nav, focus accents. |
| `--color-class-header` / `bg-class-header` | Deep class-context header and dark standard chrome. |
| `--color-success-journal` | Post-to-journal / saved-work accent. |
| `--color-notification` | Notification dots and destructive attention only. |
| `--color-gold` | New badges, warm highlights, rewards. |
| `--color-surface` | App/page canvas. |
| `--color-surface-container-lowest` | White cards and controls. |
| `--color-surface-container` | Inset panels, hover fills, skeletons. |
| `--color-on-surface` | Primary text. |
| `--color-on-surface-variant` | Secondary text and resting nav labels. |
| `--color-outline` / `--color-outline-variant` | 1px borders and dividers. |

### Typography

- Standard mode uses Lexend through `--font-body`, `--font-display`, and
  `--font-headline`.
- Standard body weight is 400; labels/buttons use 600; headings use 700/800.
- Sentence case is default for buttons, nav, cards, and menu items.
- Uppercase is reserved for small labels/eyebrows with wide tracking.

## 4. Layout

- Standard app shell uses a fixed desktop sidebar (`--nav-rail-wide`, 240px)
  and mobile bottom navigation where already established.
- Page headers are white strips on top of a quiet `bg-surface` canvas.
- Cards sit on the canvas; they do not rely on colored border accents.
- Class drill-in surfaces may use a deep `bg-class-header` context band.
- Avoid backdrop blur in teacher/admin/parent chrome.

## 5. Primitives

Mantine is the foundation for reusable DOM controls, cards, overlays, tables,
fields, progress, and status components. Keep EduPlay APIs in the shared kit;
implement their behavior with Mantine rather than building parallel native
controls. The Mantine Styles API and token classes preserve EduPlay's own visual
identity. Use `MantineBoundary` for standalone components that need a themed
fallback; the application already supplies the provider.

Native semantic layout elements, hidden form inputs, SVG brand artwork, drawing
canvases, and Phaser game objects remain appropriate. A component that composes
Mantine-backed kit primitives does not need a redundant direct Mantine import.
Run `npm run audit:mantine` to inspect direct and indirect adoption and remaining
visible native controls. Import counts measure dependencies, not visual quality.

- Use `Button` or `ChunkyButton` for actions. Both render EduPlay chrome
  with soft shadows; student/play callsites keep larger sizing via props.
- Use `Card` or `DuoCard` for card surfaces. Both render white cards,
  12-16px radii, and `shadow-soft-sm` / `shadow-soft`.
- Use `TextField`, `SelectField`, and `TextareaField` for form controls. They
  are rectangular, labeled, keyboard-focusable, and error-aware.
- Use `Badge`, `Pill`, and `SubjectPill` for labels/chips.
- Use `DashboardShell`, `TopAppBar`, and `SideNavBar` for dashboard chrome.
- Use `Icon`; do not use emoji as icons or raw icon-font names.

## 6. Motion

- Standard easing is `cubic-bezier(0.4, 0, 0.2, 1)`.
- Standard transitions are 120-200ms for color/shadow and 300ms for layout.
- Standard hover raises or softens shadow; it does not bounce or scale.
- Respect `prefers-reduced-motion` for all non-essential motion.

## 7. Copy

- User-facing copy is Romanian, informal where appropriate, and uses correct
  comma-below diacritics (`ă â î ș ț`).
- Teacher surfaces are encouraging but not cheerleading. Avoid exclamation marks
  in chrome unless the product moment genuinely needs one.
- Buttons use short imperatives; status copy is declarative.
- No emoji in product chrome.

## 8. Review Blocks

- Raw hex in production components.
- Arbitrary Tailwind radii/shadows when a token exists.
- New deep imports from `src/shared/components/ui/kit/*` in feature code.
- Emoji-as-icon or icon-font usage outside the approved `Icon` wrapper.
- New Duo-branded API names, comments, or docs except when documenting retained
  compatibility exports.
- Chunky 3D offset shadows or uppercase CTA copy.
- Student/play routes with touch targets below 64px for primary actions.
