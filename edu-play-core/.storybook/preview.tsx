import type { Preview } from '@storybook/react';
import type { CSSProperties } from 'react';
import '@mantine/core/styles.css';
import { MantineProvider } from '@mantine/core';
import '../src/app/globals.css';
import { eduPlayMantineTheme } from '../src/shared/theme';

const storybookFontVariables = {
  '--font-lexend': '"Lexend", system-ui, -apple-system, sans-serif',
  '--font-baloo': '"Baloo 2", system-ui, -apple-system, sans-serif',
  '--font-mono':
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
} satisfies CSSProperties;

const preview: Preview = {
  parameters: {
    layout: 'centered',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'todo',
    },
    nextjs: {
      appDirectory: true,
    },
  },
  decorators: [
    (Story) => (
      <MantineProvider theme={eduPlayMantineTheme}>
        <div className="antialiased" style={storybookFontVariables}>
          <Story />
        </div>
      </MantineProvider>
    ),
  ],
};

export default preview;
