import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Card, CardBody, CardHeader } from './Card';

const meta = {
  title: 'UI Kit/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    mode: { control: 'radio', options: ['standard', 'kid'] },
    tone: {
      control: 'select',
      options: ['surface', 'cream', 'ink', 'lime', 'sun', 'sky', 'glass'],
    },
    padding: { control: 'radio', options: ['none', 'sm', 'md', 'lg'] },
    shadow: { control: 'boolean' },
  },
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Standard: Story = {
  args: {
    mode: 'standard',
    tone: 'surface',
    padding: 'md',
    children: (
      <>
        <CardHeader>
          <h3>Activitate recomandată</h3>
          <p>Potrivită pentru recapitularea de vineri.</p>
        </CardHeader>
        <CardBody>
          <p>Clasa a II-a • Română • 15 minute</p>
        </CardBody>
      </>
    ),
  },
};

export const Tones: Story = {
  args: {
    children: null,
  },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))',
        width: 520,
      }}
    >
      {(['surface', 'cream', 'ink', 'lime', 'sun', 'sky'] as const).map(
        (tone) => (
          <Card key={tone} tone={tone} padding="sm">
            <strong>{tone}</strong>
            <p>Card pentru conținut rapid.</p>
          </Card>
        ),
      )}
    </div>
  ),
};

export const KidModeMobileWidth: Story = {
  args: {
    children: null,
  },
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  render: () => (
    <div style={{ width: 320 }}>
      <Card mode="kid" tone="lime" padding="lg" depth={6}>
        <CardHeader>
          <h3>Misiunea zilei</h3>
        </CardHeader>
        <CardBody>
          <p>Ascultă cuvântul și alege imaginea corectă.</p>
        </CardBody>
      </Card>
    </div>
  ),
};

export const NoPadding: Story = {
  args: {
    padding: 'none',
    children: (
      <div style={{ padding: 24 }}>
        <strong>Conținut personalizat</strong>
        <p>Util pentru suprafețe cu layout propriu.</p>
      </div>
    ),
  },
};
