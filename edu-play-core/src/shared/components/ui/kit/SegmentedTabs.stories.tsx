import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SegmentedTabs, type SegmentedTab } from './SegmentedTabs';

const roleTabs: SegmentedTab[] = [
  { value: 'teacher', label: 'Profesor', icon: 'GraduationCap' },
  { value: 'parent', label: 'Părinte', icon: 'Users' },
  { value: 'student', label: 'Elev', icon: 'User' },
];

const meta = {
  title: 'UI Kit/SegmentedTabs',
  component: SegmentedTabs,
  tags: ['autodocs'],
} satisfies Meta<typeof SegmentedTabs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Standard: Story = {
  args: {
    tabs: roleTabs,
    value: 'teacher',
    onChange: () => {},
    ariaLabel: 'Alege rolul',
  },
  render: () => {
    const [value, setValue] = useState('teacher');

    return (
      <div style={{ width: 480 }}>
        <SegmentedTabs
          tabs={roleTabs}
          value={value}
          onChange={setValue}
          ariaLabel="Alege rolul"
        />
      </div>
    );
  },
};

export const KidMode: Story = {
  args: {
    tabs: roleTabs,
    value: 'student',
    onChange: () => {},
    ariaLabel: 'Alege rolul pentru conectare',
    mode: 'kid',
  },
  render: () => {
    const [value, setValue] = useState('student');

    return (
      <div style={{ width: 520 }}>
        <SegmentedTabs
          mode="kid"
          tabs={roleTabs}
          value={value}
          onChange={setValue}
          ariaLabel="Alege rolul pentru conectare"
        />
      </div>
    );
  },
};

export const MobileWidth: Story = {
  args: {
    tabs: roleTabs.slice(0, 2),
    value: 'parent',
    onChange: () => {},
    ariaLabel: 'Alege contul',
  },
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  render: () => {
    const [value, setValue] = useState('parent');

    return (
      <div style={{ width: 320 }}>
        <SegmentedTabs
          tabs={roleTabs.slice(0, 2)}
          value={value}
          onChange={setValue}
          ariaLabel="Alege contul"
        />
      </div>
    );
  },
};
