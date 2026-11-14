import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from './Button';

const meta = {
  title: 'UI Kit/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    mode: {
      control: 'radio',
      options: ['kid', 'standard'],
    },
    variant: {
      control: 'radio',
      options: ['primary', 'secondary', 'ghost', 'icon'],
    },
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg', 'xl'],
    },
    tone: {
      control: 'radio',
      options: ['lime', 'sun', 'sky', 'cream', 'ink'],
      if: { arg: 'mode', eq: 'kid' },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const StandardPrimary: Story = {
  args: {
    mode: 'standard',
    variant: 'primary',
    size: 'md',
    children: 'Sign in',
  },
};

export const StandardSecondary: Story = {
  args: {
    mode: 'standard',
    variant: 'secondary',
    size: 'md',
    children: 'Cancel',
  },
};

export const KidPrimary: Story = {
  args: {
    mode: 'kid',
    variant: 'primary',
    size: 'lg',
    tone: 'lime',
    children: 'Start activity',
  },
};

export const AsLink: Story = {
  args: {
    mode: 'standard',
    variant: 'primary',
    href: '/login',
    children: 'Go to login',
  },
};

export const Pending: Story = {
  args: {
    mode: 'standard',
    variant: 'primary',
    isPending: true,
    children: 'Saving…',
  },
};
