import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import storybook from "eslint-plugin-storybook";

const BLOCKED_ANALYTICS_PACKAGES = [
  "@vercel/analytics",
  "@vercel/speed-insights",
  "posthog-js",
  "@posthog/react",
  "react-ga",
  "react-ga4",
  "@segment/analytics-next",
  "@amplitude/analytics-browser",
  "mixpanel-browser",
  "@datadog/browser-rum",
  "@hotjar/browser",
  "@google-analytics/data",
  "@googletagmanager/google-tag",
];

const ARBITRARY_RADIUS_REGEX = String.raw`rounded(-(?:t|b|l|r|tl|tr|bl|br|s|e|ss|se|es|ee))?-\[\d+(\.\d+)?(px|rem)\]`;
const ARBITRARY_RADIUS_MESSAGE =
  "Use Seesaw/EduPlay radius tokens (rounded-xs|sm|md|lg|xl|pill|kid-card|kid-button) — see DESIGN.md. Arbitrary rounded-[Npx] / rounded-[Nrem] values are banned.";
const BLOCKED_ANALYTICS_MESSAGE =
  "Third-party analytics are banned in child-accessible routes (PRIVACY.md §8). Children's data must never reach external trackers.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...storybook.configs["flat/recommended"],
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-syntax": ["error",
        {
          selector: `Literal[value=/${ARBITRARY_RADIUS_REGEX}/]`,
          message: ARBITRARY_RADIUS_MESSAGE,
        },
        {
          selector: `TemplateElement[value.raw=/${ARBITRARY_RADIUS_REGEX}/]`,
          message: ARBITRARY_RADIUS_MESSAGE,
        },
      ],
    },
  },
  {
    // Analytics guard: routes directly accessible to children
    // AND feature modules rendered into those routes (otherwise a feature
    // file could import posthog-js cleanly and ship into /student/**).
    files: [
      "src/app/(dashboard)/student/**/*.{ts,tsx}",
      "src/app/games/**/*.{ts,tsx}",
      "src/app/play/**/*.{ts,tsx}",
      "src/features/student-dashboard/**/*.{ts,tsx}",
      "src/features/games/**/*.{ts,tsx}",
      "src/features/learning-map/**/*.{ts,tsx}",
      "src/features/lessons/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": ["error", {
        paths: BLOCKED_ANALYTICS_PACKAGES.map((pkg) => ({
          name: pkg,
          message: BLOCKED_ANALYTICS_MESSAGE,
        })),
        patterns: BLOCKED_ANALYTICS_PACKAGES.map((pkg) => ({
          group: [`${pkg}/*`],
          message: BLOCKED_ANALYTICS_MESSAGE,
        })),
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Test artifacts
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    // Bundled game files (Construct 3, Phaser exports, etc.)
    // These are third-party or auto-generated bundles that should not be linted
    "public/games/**",
    // Development scripts (Node.js utilities, not part of the app)
    "scripts/**",
    // Design handoff bundles: HTML/JSX design references, not production code.
    // README files state these prototypes should be recreated, not copied verbatim.
    "design_handoff_eduplay_duo/**",
    "src/shared/components/ui/seesaw-design-system/**",
  ]),
]);

export default eslintConfig;
