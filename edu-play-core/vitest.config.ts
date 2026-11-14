import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vitest configuration for EduPlay unit and component tests
 * @see https://vitest.dev/config/
 */
export default defineConfig({
  plugins: [react()],

  test: {
    // Test environment (jsdom for React components)
    environment: 'jsdom',

    // Global test setup file
    setupFiles: ['./tests/setup.tsx'],

    // Include patterns for test files
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'tests/unit/**/*.{test,spec}.{ts,tsx}',
    ],

    // Exclude patterns
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],

    // Enable globals (describe, it, expect, etc.)
    globals: true,

    // CSS handling
    css: {
      // Include CSS in tests for component styling verification
      include: [/.+/],
    },

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',

      // Files to include in coverage
      include: [
        'src/features/**/*.{ts,tsx}',
        'src/shared/**/*.{ts,tsx}',
        'src/components/**/*.{ts,tsx}',
        'src/lib/**/*.{ts,tsx}',
      ],

      // Files to exclude from coverage
      exclude: [
        '**/*.d.ts',
        '**/index.ts',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/types/**',
        '**/node_modules/**',
      ],

      // Coverage thresholds
      // NOTE: Incremental Coverage Approach
      // ----------------------------------
      // EduPlay is currently at ~45% implementation (as of April 2025).
      // Coverage expanded in April 2025: added tests for teacher-management
      // schemas, auth register/parent-login schemas, game type utilities,
      // and StudentStatusBadge component.
      //
      // Target coverage progression:
      // - Phase 1 (Baseline, Jan 2025): 5% lines, 10% functions
      // - Phase 2 (Current, Apr 2025): 10% lines, 15% functions - after initial coverage expansion
      // - Phase 3 (50% impl): 30% lines, 30% functions - as more features are tested
      // - Phase 4 (75% impl): 50% lines, 50% functions - approaching production
      // - Phase 5 (100% impl): 80% lines, 80% functions - production target
      //
      // When adding new features, aim for 80%+ coverage on new code.
      // Increase these thresholds as test coverage improves.
      thresholds: {
        lines: 10,
        functions: 15,
        branches: 5,
        statements: 10,
      },
    },

    // Test timeout
    testTimeout: 10000,

    // Hook timeout
    hookTimeout: 10000,

    // Pool options for better isolation
    pool: 'forks',

    // Clear mocks between tests
    clearMocks: true,

    // Restore mocks after each test
    restoreMocks: true,

    // Mock reset
    mockReset: true,
  },

  resolve: {
    alias: {
      // Match tsconfig.json paths
      '@': path.resolve(__dirname, './src'),
      '@edu-play/activity-protocol': path.resolve(
        __dirname,
        './packages/activity-protocol/src/index.ts',
      ),
      // Next.js's server-only guard is a no-op under jsdom so pure helpers
      // colocated with server modules can still be unit-tested.
      'server-only': path.resolve(__dirname, './tests/stubs/server-only.ts'),
    },
  },
});
