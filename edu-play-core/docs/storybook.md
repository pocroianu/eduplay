# Storybook

Component catalog for the EduPlay UI kit and other shared UI. Stories live next to components as `*.stories.tsx` under `src/`.

## Setup

Install dev dependencies (once):

```bash
npm install
```

## Commands

| Script | Description |
| --- | --- |
| `npm run storybook` | Dev server at [http://localhost:6006](http://localhost:6006) |
| `npm run build-storybook` | Static build to `storybook-static/` |

## Conventions

- **Location:** `ComponentName.stories.tsx` beside the component (e.g. `kit/Button.stories.tsx`).
- **Title:** Use the `UI Kit/…` prefix for primitives in `src/shared/components/ui/kit/`.
- **Providers:** Global decorators in `.storybook/preview.tsx` load Mantine, app fonts, and `globals.css` so stories match production styling.
- **Next.js:** The `@storybook/nextjs-vite` framework handles `next/link`, `next/image`, and App Router parameters.

See also [ui-kit.md](./ui-kit.md) for import rules and primitive usage.
