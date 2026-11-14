# @edu-play/phaser-ui

Duo design tokens and Phaser-side chrome primitives mirrored from
[`edu-play-core/src/shared/components/ui/kit/`](../../../edu-play-core/src/shared/components/ui/kit/).

This package gives Phaser games a token-and-primitive surface that matches the
Duo system used by every non-game surface in `edu-play-core`. Game canvases
cannot read CSS custom properties directly, so the values from
`edu-play-core/src/app/globals.css` are mirrored as TypeScript constants here.

## Layout

```
src/
├── tokens/        # Color, spacing, type, motion constants (mirror of globals.css)
├── primitives/    # Phaser GameObjects equivalent to the Duo React kit
└── index.ts       # Barrel export
```

## When to add a token

Add to `src/tokens/` only when the value already exists in
`edu-play-core/src/app/globals.css` under the Duo (non-legacy) block. Names
mirror the CSS custom property name with the `--` prefix dropped and `-` swapped
for camelCase (`--color-primary-dim` → `colors.primary.dim`).

For Phaser, every color is exposed twice:

- as a `#RRGGBB` string for `Phaser.Text` / DOM-style tints
- as a `0xRRGGBB` number for graphics fills/strokes

## Primitives

Phaser-side analogues of the Duo React kit. Each primitive extends
`Phaser.GameObjects.Container` and accepts a config object that mirrors the
React component's prop conventions (`variant`, `tone`, `size`, `mood`).

| Phaser primitive | Mirrors |
| ---------------- | ------- |
| `ChunkyButton`   | `kit/ChunkyButton.tsx` |
| `DuoCard`        | `kit/DuoCard.tsx` |
| `SubjectPill`    | `kit/SubjectPill.tsx` |
| `DuoProgress`    | `kit/DuoProgress.tsx` (bar variant) |
| `DuoGlyph`       | `kit/DuoGlyph.tsx` (heart / gem / xp / trophy / flame) |
| `Vulpita`        | `kit/Vulpita.tsx` (Vulpița mascot, mood prop preserved) |

## Source of truth

When `edu-play-core/src/app/globals.css` changes, this package's `tokens/`
must be updated to match. Run a quick diff check before each merge:

```
diff <(grep -E '^\s*--color' edu-play-core/src/app/globals.css | sort) \
     <(grep -E "'#" phaser-projects/packages/phaser-ui/src/tokens/colors.ts | sort)
```

The Vulpița mascot SVG is sourced from `edu-play-core/src/shared/components/ui/kit/Vulpita.tsx`.
