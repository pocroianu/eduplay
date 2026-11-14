import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}));

const supabaseGetUserMock = vi.fn();
const profileSingleMock = vi.fn();

const profilesBuilder: Record<string, unknown> = {};
profilesBuilder.select = vi.fn(() => profilesBuilder);
profilesBuilder.eq = vi.fn(() => profilesBuilder);
profilesBuilder.single = () => profileSingleMock();

const supabase = {
  auth: { getUser: () => supabaseGetUserMock() },
  from: vi.fn((table: string) => {
    if (table === 'profiles') return profilesBuilder;
    throw new Error(`unexpected table=${table}`);
  }),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve(supabase),
}));
vi.mock('@/lib/i18n/server', () => ({
  getServerLanguage: () => Promise.resolve('en'),
  getServerTranslation: (_lang: string, _namespace: string, key: string) => Promise.resolve({
    'utility.language.metadataTitle': 'Select Language · EduPlay',
    'utility.language.close': 'Close language selector',
    'utility.language.eyebrow': 'Language',
    'utility.language.heading': 'Select Language',
    'utility.language.description': 'Choose the language used across the teacher interface.',
    'utility.language.available': 'Available languages',
    'utility.language.current': 'Current',
    'utility.language.cancel': 'Cancel',
    'utility.language.setLanguage': 'Set Language',
    'utility.language.options.romanian': 'Romanian',
    'utility.language.options.english': 'English',
  }[key] ?? key),
}));


import TeacherLanguagePage from './page';

beforeEach(() => {
  redirectMock.mockClear();
  supabaseGetUserMock.mockReset();
  profileSingleMock.mockReset();
  supabase.from.mockClear();
});

describe('/teacher/language', () => {
  it('redirects unauthenticated users to login', async () => {
    supabaseGetUserMock.mockResolvedValue({ data: { user: null } });

    await expect(TeacherLanguagePage()).rejects.toThrowError(/NEXT_REDIRECT:\/login/);
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  it('renders the reference-style language picker rows and footer actions with i18n copy', async () => {
    supabaseGetUserMock.mockResolvedValue({ data: { user: { id: 'teacher-1' } } });
    profileSingleMock.mockResolvedValue({
      data: { id: 'teacher-1', role: 'teacher' },
    });

    render(await TeacherLanguagePage());

    expect(screen.getByRole('heading', { name: 'Select Language', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /close language selector/i })).toHaveAttribute('href', '/teacher');

    const picker = screen.getByRole('radiogroup', { name: /available languages/i });
    const radios = within(picker).getAllByRole('radio');
    expect(radios).toHaveLength(2);

    expect(within(picker).getByRole('radio', { name: /Română.*Romanian/i })).not.toBeChecked();
    expect(within(picker).getByRole('radio', { name: /English.*Current: English/i })).toBeChecked();
    expect(within(picker).getByText('Romanian')).toBeInTheDocument();
    expect(within(picker).getAllByText('English')).toHaveLength(1);
    expect(within(picker).getByText('Current')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/teacher');
    expect(screen.getByRole('button', { name: 'Set Language' })).toBeEnabled();
  });
});
