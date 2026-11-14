const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'src/**/__tests__/**',
      'src/batch/**',
      'src/validation/**',
      'src/cli/commands/analyze.ts',
      'src/cli/commands/batch.ts',
      'src/cli/commands/build-dataset.ts',
      'src/cli/commands/extract.ts',
      'src/cli/commands/metrics.ts',
      'src/cli/commands/models.ts',
      'src/cli/commands/train-lora.ts',
      'src/cli/commands/validate-game.ts',
      'src/cli/commands/validate.ts',
      'src/cli/commands/workflow.ts',
      'src/training/ContentAnalyzer.ts',
      'src/training/DataExtractor.ts',
      'src/training/DatasetBuilder.ts',
      'src/training/index.ts',
      'src/training/LoRATrainer.ts',
      'src/training/ModelManager.ts',
      'src/training/TrainingConfig.ts',
      'src/training/TrainingProgressTracker.ts'
    ]
  },
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
      },
      globals: {
        AbortSignal: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        __dirname: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      'no-console': 'off',
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-control-regex': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }]
    }
  }
];
