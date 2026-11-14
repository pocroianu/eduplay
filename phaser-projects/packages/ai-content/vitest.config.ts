import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test file patterns
    include: ['src/**/*.test.ts'],

    // Exclude patterns
    exclude: ['node_modules', 'dist'],

    // Enable globals for describe, it, expect
    globals: true,

    // Use Node.js environment
    environment: 'node',

    // Reporter configuration
    reporters: ['verbose'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/providers/**/*.ts', 'src/training/**/*.ts', 'src/batch/**/*.ts', 'src/generators/**/*.ts'],
      exclude: [
        'src/providers/**/*.test.ts',
        'src/providers/mocks/**',
        'src/providers/index.ts',
        'src/training/**/*.test.ts',
        'src/training/__tests__/**',
        'src/training/index.ts',
        'src/batch/**/*.test.ts',
        'src/batch/__tests__/**',
        'src/batch/index.ts',
        'src/generators/**/*.test.ts',
        'src/generators/__tests__/**',
        'src/generators/index.ts'
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70
      }
    },

    // Test timeout (30 seconds for integration tests)
    testTimeout: 30000,

    // Parallel execution
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true // Use single fork for integration tests
      }
    }
  }
});
