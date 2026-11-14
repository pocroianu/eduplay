import type { StorybookConfig } from '@storybook/nextjs-vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: ['@storybook/addon-a11y'],
  framework: {
    name: '@storybook/nextjs-vite',
    options: {},
  },
  staticDirs: ['../public'],
  viteFinal: async (config) => {
    config.resolve ??= {};
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(dirname, '../src'),
      '@edu-play/activity-protocol': path.resolve(
        dirname,
        '../packages/activity-protocol/src/index.ts',
      ),
    };
    return config;
  },
};

export default config;
