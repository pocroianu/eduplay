import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LibraryActivityCard } from './LibraryActivityCard';

const meta = {
  title: 'UI Kit/LibraryActivityCard',
  component: LibraryActivityCard,
  tags: ['autodocs'],
} satisfies Meta<typeof LibraryActivityCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Activity: Story = {
  args: {
    href: '/teacher/library/sunetul-initial',
    title: 'Sunetul inițial',
    creator: 'Biblioteca EduPlay',
    meta: 'Română • Clasa I',
    actionHref: '/teacher/assignments/new?activityId=sunetul-initial',
    actionLabel: 'Atribuie',
    thumbnailTone: 'green',
  },
};

export const RailDesktop: Story = {
  args: {
    href: '/teacher/library/sunetul-initial',
    title: 'Sunetul inițial',
  },
  render: () => (
    <div style={{ display: 'flex', gap: 16, width: 640 }}>
      <LibraryActivityCard
        href="/teacher/activities/create"
        title="Creează o activitate sau evaluare automată"
        variant="create"
      />
      <LibraryActivityCard
        href="/teacher/library/idei"
        title="Descoperă idei pentru lecția de azi"
        meta="Colecții recomandate"
        variant="ideas"
        thumbnailTone="purple"
      />
      <LibraryActivityCard
        href="/teacher/library/numere"
        title="Numere până la 100"
        creator="Biblioteca EduPlay"
        meta="Matematică"
        actionHref="/teacher/assignments/new?activityId=numere"
        actionLabel="Atribuie"
        thumbnailTone="blue"
      />
    </div>
  ),
};

export const MobileWidth: Story = {
  args: {
    href: '/teacher/library/poveste',
    title: 'Povestește ce vezi în imagine',
  },
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  render: () => (
    <div style={{ width: 320 }}>
      <LibraryActivityCard
        href="/teacher/library/poveste"
        title="Povestește ce vezi în imagine"
        creator="Biblioteca EduPlay"
        meta="Comunicare"
        actionHref="/teacher/assignments/new?activityId=poveste"
        actionLabel="Atribuie"
        thumbnailTone="pink"
      />
    </div>
  ),
};
